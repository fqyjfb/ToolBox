import { create } from 'zustand'
import { persist, type StorageValue } from 'zustand/middleware'
import { Admin, LoginRequest, RegisterRequest, User } from '../types/auth'
import { authService } from '../services/AuthService'
import { logError } from '../services/loggerService'
import { getDataAccessLayer, clearAllDataAccessInstances } from '../services/dataAccessLayer'
import { offlineStorage } from '../services/offlineStorage'
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService'
import { queryClient } from '../services/queryClient'
import { queryKeys } from '../queries/keys'

/** 登录态有效期：2 天未访问则清除，需重新登录 */
const AUTH_TIMEOUT_MS = 2 * 24 * 60 * 60 * 1000
/** 与登录态绑定的最近访问时间戳（毫秒数，字符串存储） */
const AUTH_LAST_ACTIVE_KEY = 'toolbox_auth_last_active'

interface AuthStateData {
  user: User | null
  admin: Admin | null
  isAuthenticated: boolean
  isAdmin: boolean
  isLoading: boolean
  error: string | null
}

interface AuthState extends AuthStateData {
  login: (credentials: LoginRequest) => Promise<void>
  register: (userData: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  getCurrentUser: () => Promise<void>
  updateUserProfile: (data: { id: string; name?: string; email?: string; phone?: string; password?: string }) => Promise<boolean>
  handleAuthSuccess: (user: User, admin: Admin | undefined) => Promise<void>
}

/** 清除与登录态相关的所有 localStorage 条目 */
const clearAuthStorage = (): void => {
  localStorageService.remove(STORAGE_KEYS.USER)
  localStorageService.remove(STORAGE_KEYS.ADMIN)
  localStorageService.remove(AUTH_LAST_ACTIVE_KEY)
}

const authStorage = {
  getItem: (key: string): StorageValue<AuthStateData> | null => {
    if (key !== 'auth') return null

    const storedUser = localStorageService.getString(STORAGE_KEYS.USER)
    const storedAdmin = localStorageService.getString(STORAGE_KEYS.ADMIN)
    if (!storedUser && !storedAdmin) return null

    // 2 天未访问：丢弃残留的登录态数据
    const lastActive = localStorageService.getString(AUTH_LAST_ACTIVE_KEY)
    if (lastActive) {
      const elapsed = Date.now() - parseInt(lastActive, 10)
      if (elapsed > AUTH_TIMEOUT_MS) {
        clearAuthStorage()
        return null
      }
    }
    // 每次访问自动续期，给持续使用的用户滚动宽限期
    localStorageService.setString(AUTH_LAST_ACTIVE_KEY, Date.now().toString())

    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        return {
          state: {
            user,
            admin: user.role ? { ...user, role: user.role as 'super' | 'normal' } : null,
            isAuthenticated: true,
            isAdmin: !!(user.role && (user.role === 'super' || user.role === 'normal')),
            isLoading: false,
            error: null
          },
          version: 0
        }
      } catch {
        clearAuthStorage()
        return null
      }
    }
    if (storedAdmin) {
      try {
        const admin = JSON.parse(storedAdmin)
        return {
          state: {
            user: null,
            admin,
            isAuthenticated: true,
            isAdmin: admin.role === 'super' || admin.role === 'normal',
            isLoading: false,
            error: null
          },
          version: 0
        }
      } catch {
        clearAuthStorage()
        return null
      }
    }
    return null
  },

  setItem: (key: string, value: StorageValue<AuthStateData>): void => {
    if (key !== 'auth' || !value.state) return

    const { user, admin } = value.state
    if (!user && !admin) {
      // 登出或重置：同步清除 localStorage 残留，避免下次启动误恢复
      clearAuthStorage()
      return
    }

    if (user) {
      localStorageService.setString(STORAGE_KEYS.USER, JSON.stringify(user))
    }
    if (admin) {
      localStorageService.setString(STORAGE_KEYS.ADMIN, JSON.stringify(admin))
    }
    localStorageService.setString(AUTH_LAST_ACTIVE_KEY, Date.now().toString())
  },

  removeItem: (key: string): void => {
    if (key === 'auth') clearAuthStorage()
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      admin: null,
      isAuthenticated: !!localStorageService.getString(STORAGE_KEYS.USER) || !!localStorageService.getString(STORAGE_KEYS.ADMIN),
      isAdmin: false,
      isLoading: false,
      error: null,

      login: async (credentials: LoginRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.login(credentials);
          if (response.success && response.data) {
            await get().handleAuthSuccess(response.data.user, response.data.admin);
          } else {
            set({ error: response.message || '登录失败', isLoading: false });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '登录失败，请检查网络连接';
          logError('登录失败', 'AuthStore', error instanceof Error ? error : undefined);
          set({ error: errorMessage, isLoading: false });
        }
      },

      register: async (userData: RegisterRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.register(userData);
          if (response.success && response.data) {
            await get().handleAuthSuccess(response.data.user, response.data.admin);
          } else {
            set({ error: response.message || '注册失败', isLoading: false });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '注册失败，请检查网络连接';
          logError('注册失败', 'AuthStore', error instanceof Error ? error : undefined);
          set({ error: errorMessage, isLoading: false });
        }
      },

      handleAuthSuccess: async (user: User, admin: Admin | undefined) => {
        // 清理所有旧的 StorageContext 实例，确保用户切换时状态完全隔离
        clearAllDataAccessInstances();

        // 丢弃上个账号的私有数据缓存（收藏、待办徽标等），与 logout 成对处理，
        // 覆盖「未走登出就换号登录」的路径
        queryClient.removeQueries({ queryKey: queryKeys.website.favorites() });
        queryClient.removeQueries({ queryKey: queryKeys.todo.all });

        const dbUsername = user.name || user.username || user.id;
        await offlineStorage.init(dbUsername);

        const dal = getDataAccessLayer(user.id);
        await dal.init(user.id);

        set({
          user,
          admin: admin || null,
          isAuthenticated: true,
          isAdmin: !!admin,
          isLoading: false
        });
      },

      logout: async () => {
        // 用户私有数据的查询缓存（收藏、待办徽标等）queryKey 不含 userId，
        // 不移除的话下个账号在 gcTime 内会命中上个账号的缓存。
        // 放在 try 之前：登出接口失败时本地也已置为未登录，同样必须清掉。
        queryClient.removeQueries({ queryKey: queryKeys.website.favorites() });
        queryClient.removeQueries({ queryKey: queryKeys.todo.all });
        try {
          await authService.logout();
          offlineStorage.resetInit();
          clearAllDataAccessInstances();
          set({
            user: null,
            admin: null,
            isAuthenticated: false,
            isAdmin: false
          });
        } catch (err) {
          logError('登出失败', 'AuthStore', err as Error);
          offlineStorage.resetInit();
          clearAllDataAccessInstances();
          set({
            user: null,
            admin: null,
            isAuthenticated: false,
            isAdmin: false
          });
        }
      },

      getCurrentUser: async () => {
        if (get().isLoading) return;

        set({ isLoading: true });
        try {
          const response = await authService.getCurrentUser();
          if (response.success && response.data) {
            // 清理所有旧的 StorageContext 实例，确保用户切换时状态完全隔离
            clearAllDataAccessInstances();

            const dbUsername = response.data.name || response.data.username || response.data.id;
            await offlineStorage.init(dbUsername);

            const dal = getDataAccessLayer(response.data.id);
            await dal.init(response.data.id);

            set({
              user: response.data,
              admin: response.admin || null,
              isAuthenticated: true,
              isAdmin: !!response.admin,
              isLoading: false
            });
          } else {
            offlineStorage.resetInit();
            clearAllDataAccessInstances();
            set({
              user: null,
              admin: null,
              isAuthenticated: false,
              isAdmin: false,
              isLoading: false
            });
          }
        } catch (error) {
          logError('获取当前用户信息失败', 'AuthStore', error instanceof Error ? error : undefined);
          offlineStorage.resetInit();
          clearAllDataAccessInstances();
          set({
            user: null,
            admin: null,
            isAuthenticated: false,
            isAdmin: false,
            isLoading: false
          });
        }
      },

      updateUserProfile: async (data: { id: string; name?: string; email?: string; phone?: string; password?: string }) => {
        try {
          const response = await authService.updateAdminProfile(data);
          if (response.success) {
            const currentUser = get().user;
            if (currentUser) {
              set({
                user: {
                  ...currentUser,
                  ...(data.name && { name: data.name }),
                  ...(data.phone && { phone: data.phone })
                }
              });
            }
            return true;
          }
          return false;
        } catch {
          return false;
        }
      }
    }),
    {
      name: 'auth',
      storage: authStorage
    }
  )
)