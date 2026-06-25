import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Admin, LoginRequest, RegisterRequest } from '../types/auth'
import { authService } from '../services/AuthService'
import { logError } from '../services/loggerService'
import { getDataAccessLayer } from '../services/dataAccessLayer'

interface AuthState {
  admin: Admin | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (credentials: LoginRequest) => Promise<void>
  register: (userData: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  getCurrentAdmin: () => Promise<void>
  updateAdminProfile: (data: { id: string; name?: string; email?: string; phone?: string; password?: string }) => Promise<boolean>
}

const authStorage = {
  getItem: (key: string): string | null => {
    if (key === 'auth') {
      const storedAdmin = localStorage.getItem('admin')
      if (storedAdmin) {
        try {
          const admin = JSON.parse(storedAdmin)
          return JSON.stringify({
            state: {
              admin,
              isAuthenticated: true,
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
    return localStorage.getItem(key)
  },

  setItem: (key: string, value: string): void => {
    if (key === 'auth') {
      try {
        const parsed = JSON.parse(value)
        if (parsed.state && parsed.state.admin) {
          localStorage.setItem('admin', JSON.stringify(parsed.state.admin))
        }
      } catch {
        localStorage.setItem(key, value)
      }
    } else {
      localStorage.setItem(key, value)
    }
  },

  removeItem: (key: string): void => {
    if (key === 'auth') {
      localStorage.removeItem('admin')
    } else {
      localStorage.removeItem(key)
    }
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      admin: null,
      isAuthenticated: !!localStorage.getItem('admin'),
      isLoading: false,
      error: null,

      login: async (credentials: LoginRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.login(credentials);
          if (response.success && response.data) {
            const dal = getDataAccessLayer(response.data.admin.id);
            await dal.init(response.data.admin.id);

            set({
              admin: response.data.admin,
              isAuthenticated: true,
              isLoading: false
            });
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
            const dal = getDataAccessLayer(response.data.admin.id);
            await dal.init(response.data.admin.id);

            set({
              admin: response.data.admin,
              isAuthenticated: true,
              isLoading: false
            });
          } else {
            set({ error: response.message || '注册失败', isLoading: false });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '注册失败，请检查网络连接';
          logError('注册失败', 'AuthStore', error instanceof Error ? error : undefined);
          set({ error: errorMessage, isLoading: false });
        }
      },

      logout: async () => {
        try {
          await authService.logout()
          set({
            admin: null,
            isAuthenticated: false
          })
        } catch (err) {
          logError('登出失败', 'AuthStore', err as Error);
          set({
            admin: null,
            isAuthenticated: false
          })
        }
      },

      getCurrentAdmin: async () => {
        if (get().isLoading) return;

        set({ isLoading: true });
        try {
          const response = await authService.getCurrentAdmin();
          if (response.success && response.data) {
            const dal = getDataAccessLayer(response.data.id);
            await dal.init(response.data.id);

            set({
              admin: response.data,
              isAuthenticated: true,
              isLoading: false
            });
          } else {
            set({
              admin: null,
              isAuthenticated: false,
              isLoading: false
            });
          }
        } catch (error) {
          logError('获取当前管理员信息失败', 'AuthStore', error instanceof Error ? error : undefined);
          set({
            admin: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      },

      updateAdminProfile: async (data: { id: string; name?: string; email?: string; phone?: string; password?: string }) => {
        try {
          const response = await authService.updateAdminProfile(data)
          if (response.success) {
            const currentAdmin = get().admin
            if (currentAdmin) {
              set({
                admin: {
                  ...currentAdmin,
                  ...data
                }
              })
            }
            return true
          }
          return false
        } catch {
          return false
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

export const useAuthAdmin = () => useAuthStore((state) => state.admin)

export const useAuthStatus = () => useAuthStore(
  (state) => [state.isAuthenticated, state.isLoading]
)