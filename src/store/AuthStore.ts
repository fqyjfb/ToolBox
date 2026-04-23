import { create } from 'zustand'
import { Admin, LoginRequest, RegisterRequest } from '../types/auth'
import { authService } from '../services/AuthService'

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

export const useAuthStore = create<AuthState>((set, get) => {
  // 直接使用 set 函数，不使用防抖

  return {
    admin: null,
    isAuthenticated: !!localStorage.getItem('admin'),
    isLoading: false,
    error: null,

    login: async (credentials: LoginRequest) => {
      set({ isLoading: true, error: null })
      try {
        const response = await authService.login(credentials)
        if (response.success && response.data) {
          set({
            admin: response.data.admin,
            isAuthenticated: true,
            isLoading: false
          })
        } else {
          set({ error: response.message || '登录失败', isLoading: false })
        }
      } catch (error) {
        set({ error: '登录失败，请检查网络连接', isLoading: false })
      }
    },

    register: async (userData: RegisterRequest) => {
      set({ isLoading: true, error: null })
      try {
        const response = await authService.register(userData)
        if (response.success && response.data) {
          set({
            admin: response.data.admin,
            isAuthenticated: true,
            isLoading: false
          })
        } else {
          set({ error: response.message || '注册失败', isLoading: false })
        }
      } catch (error) {
        set({ error: '注册失败，请检查网络连接', isLoading: false })
      }
    },

    logout: async () => {
      try {
        await authService.logout()
        // 清除localStorage中的用户信息，但保留账号和密码信息（如果用户选择了记住密码）
        localStorage.removeItem('admin')
        set({
          admin: null,
          isAuthenticated: false
        })
      } catch (error) {
        console.error('登出失败:', error)
        // 即使失败也清除状态和localStorage，但保留账号和密码信息（如果用户选择了记住密码）
        localStorage.removeItem('admin')
        set({
          admin: null,
          isAuthenticated: false
        })
      }
    },

    getCurrentAdmin: async () => {
      // 避免重复请求
      if (get().isLoading) return
      
      set({ isLoading: true })
      try {
        const response = await authService.getCurrentAdmin()
        if (response.success && response.data) {
          set({
            admin: response.data,
            isAuthenticated: true,
            isLoading: false
          })
        } else {
          set({
            admin: null,
            isAuthenticated: false,
            isLoading: false
          })
        }
      } catch (error) {
        set({
          admin: null,
          isAuthenticated: false,
          isLoading: false
        })
      }
    },

    updateAdminProfile: async (data: { id: string; name?: string; email?: string; phone?: string; password?: string }) => {
      try {
        const response = await authService.updateAdminProfile(data)
        if (response.success) {
          // 更新本地admin数据
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
      } catch (error) {
        return false
      }
    }
  }
})

// 函数式选择器
export const useAuth = () => useAuthStore()

export const useAuthAdmin = () => useAuthStore((state) => state.admin)

export const useAuthStatus = () => useAuthStore(
  (state) => [state.isAuthenticated, state.isLoading]
)
