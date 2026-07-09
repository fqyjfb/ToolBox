import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Admin, LoginRequest, RegisterRequest, User } from '../types/auth'
import { authService } from '../services/AuthService'
import { logError } from '../services/loggerService'
import { getDataAccessLayer } from '../services/dataAccessLayer'
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService'

interface AuthState {
  user: User | null
  admin: Admin | null
  isAuthenticated: boolean
  isAdmin: boolean
  isLoading: boolean
  error: string | null
  login: (credentials: LoginRequest) => Promise<void>
  register: (userData: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  getCurrentUser: () => Promise<void>
  updateUserProfile: (data: { id: string; name?: string; email?: string; phone?: string; password?: string }) => Promise<boolean>
  handleAuthSuccess: (user: User, admin: Admin | undefined) => Promise<void>
}

const authStorage = {
  getItem: (key: string): string | null => {
    if (key === 'auth') {
      const storedUser = localStorageService.getString(STORAGE_KEYS.USER)
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser)
          return JSON.stringify({
            state: {
              user,
              admin: user.role ? { ...user, role: user.role as 'super' | 'normal' } : null,
              isAuthenticated: true,
              isAdmin: !!(user.role && (user.role === 'super' || user.role === 'normal')),
              isLoading: false,
              error: null
            },
            version: 0
          })
        } catch {
          return null
        }
      }
      const storedAdmin = localStorageService.getString(STORAGE_KEYS.ADMIN)
      if (storedAdmin) {
        try {
          const admin = JSON.parse(storedAdmin)
          return JSON.stringify({
            state: {
              user: null,
              admin,
              isAuthenticated: true,
              isAdmin: admin.role === 'super' || admin.role === 'normal',
              isLoading: false,
              error: null
            },
            version: 0
          })
        } catch {
          return null
        }
      }
    }
    return localStorageService.getString(key) ?? null
  },

  setItem: (key: string, value: string): void => {
    if (key === 'auth') {
      try {
        const parsed = JSON.parse(value)
        if (parsed.state) {
          if (parsed.state.user) {
            localStorageService.setString(STORAGE_KEYS.USER, JSON.stringify(parsed.state.user))
          }
          if (parsed.state.admin) {
            localStorageService.setString(STORAGE_KEYS.ADMIN, JSON.stringify(parsed.state.admin))
          }
        }
      } catch {
        localStorageService.setString(key, value)
      }
    } else {
      localStorageService.setString(key, value)
    }
  },

  removeItem: (key: string): void => {
    if (key === 'auth') {
      localStorageService.remove(STORAGE_KEYS.USER)
      localStorageService.remove(STORAGE_KEYS.ADMIN)
    } else {
      localStorageService.remove(key)
    }
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
        try {
          await authService.logout();
          set({
            user: null,
            admin: null,
            isAuthenticated: false,
            isAdmin: false
          });
        } catch (err) {
          logError('登出失败', 'AuthStore', err as Error);
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
      storage: authStorage as any
    }
  )
)

export const useAuth = () => useAuthStore()

export const useAuthUser = () => useAuthStore((state) => state.user)
export const useAuthAdmin = () => useAuthStore((state) => state.admin)
export const useAuthStatus = () => useAuthStore(
  (state) => [state.isAuthenticated, state.isLoading, state.isAdmin]
)