import { AuthResponse, LoginRequest, Admin, RegisterRequest } from '../types/auth'
import { supabase } from './supabase'
import { logError, logInfo } from './loggerService'

const parseStoredAdmin = (): Admin | null => {
  const storedAdmin = localStorage.getItem('admin')
  if (!storedAdmin) return null

  try {
    return JSON.parse(storedAdmin)
  } catch {
    return null
  }
}

const validateAdminRole = (role: string | null | undefined): boolean => {
  return !!role && (role === 'super' || role === 'normal')
}

interface AuthUser {
  id: string
  email?: string
  created_at?: string
  user_metadata?: { name?: string; phone?: string }
}

const buildAdminFromProfile = (authUser: AuthUser, role: string): Admin => {
  return {
    id: authUser.id,
    username: authUser.email || '',
    role: role as 'super' | 'normal',
    createdAt: authUser.created_at || '',
    name: authUser.user_metadata?.name || '',
    email: authUser.email || '',
    phone: authUser.user_metadata?.phone || ''
  }
}

const fetchUserRole = async (userId: string): Promise<string | null> => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)

    if (error || !profiles || profiles.length === 0) return null
    return profiles[0].role || null
  } catch {
    return null
  }
}

export const authService = {
  // 登录
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    try {
      // 检查网络连接
      if (!navigator.onLine) {
        return {
          success: false,
          message: '网络连接失败，请检查网络设置'
        }
      }

      // 使用用户输入的用户名作为邮箱（真实连接数据库）
      const email = credentials.username

      // 使用Supabase自带的认证系统
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: credentials.password
      })

      if (error) {
        // 分类处理不同类型的错误
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          return {
            success: false,
            message: '用户名或密码错误'
          }
        } else if (error.code === 'auth/invalid-email') {
          return {
            success: false,
            message: '邮箱格式不正确'
          }
        } else {
          return {
            success: false,
            message: `登录失败: ${error.message}`
          }
        }
      }

      if (data.user) {
        // 尝试获取用户角色信息（从profiles表）
        try {
          const { data: profiles, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
          
          if (error) {
            // 角色获取失败，拒绝登录
            return {
              success: false,
              message: '获取用户权限失败，请联系管理员'
            }
          } else if (profiles && profiles.length > 0) {
            // 检查是否具有管理员角色
            const role = profiles[0].role
            if (!role || (role !== 'super' && role !== 'normal')) {
              return {
                success: false,
                message: '您没有管理员权限'
              }
            }
            
            // 构建管理员对象
            const admin: Admin = {
              id: data.user.id,
              username: data.user.email || '',
              role: role as 'super' | 'normal',
              createdAt: data.user.created_at,
              name: data.user.user_metadata?.name || '',
              email: data.user.email || '',
              phone: data.user.user_metadata?.phone || ''
            }

            logInfo(`用户登录成功: ${data.user.email}`, 'AuthService')

            return {
              success: true,
              data: {
                token: data.session?.access_token || '',
                admin
              }
            }
          } else {
            // 没有找到用户角色信息，拒绝登录
            return {
              success: false,
              message: '您没有管理员权限'
            }
          }
        } catch {
          // 角色获取失败，拒绝登录
          return {
            success: false,
            message: '获取用户权限失败，请联系管理员'
          }
        }
      } else {
        return {
          success: false,
          message: '登录失败，无用户数据'
        }
      }
    } catch (error) {
      // 处理不同类型的异常
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        return {
          success: false,
          message: '网络请求失败，请检查网络连接或Supabase配置'
        }
      } else if (error instanceof Error) {
        return {
          success: false,
          message: `登录失败: ${error.message}`
        }
      } else {
        return {
          success: false,
          message: '登录失败，请检查网络连接'
        }
      }
    }
  },

  // 获取当前管理员信息
  getCurrentAdmin: async (): Promise<{ success: boolean; data?: Admin }> => {
    try {
      const parsedStoredAdmin = parseStoredAdmin()

      let isSessionValid = false
      let authUser: AuthUser | null = null

      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) {
          if (error.code === 'auth/invalid-session' || error.code === 'auth/session-expired') {
            return { success: false }
          }
        } else {
          authUser = data.user
          isSessionValid = !!authUser
        }
      } catch {
        // 网络错误或其他非致命错误，不清除管理员数据
      }

      if (!isSessionValid && parsedStoredAdmin) {
        try {
          const { data, error } = await supabase.auth.refreshSession()
          if (!error && data.user) {
            authUser = data.user
            isSessionValid = true
          } else {
            return { success: false }
          }
        } catch {
          return { success: false }
        }
      }

      if (!isSessionValid && !parsedStoredAdmin) {
        return { success: false }
      }

      if (authUser) {
        const role = await fetchUserRole(authUser.id)

        if (!role) {
          return { success: false }
        }

        if (!validateAdminRole(role)) {
          return { success: false }
        }

        const admin = buildAdminFromProfile(authUser, role)
        return { success: true, data: admin }
      }

      if (parsedStoredAdmin) {
        return { success: false }
      }

      return { success: false }
    } catch (error) {
      return { success: false }
    }
  },

  // 登出
  logout: async (): Promise<{ success: boolean }> => {
    try {
      // 尝试调用signOut，但如果会话不存在，我们也应该继续执行
      try {
        const { error } = await supabase.auth.signOut()
        if (error) {
          // 只有特定的错误才视为登出失败
          if (error.name !== 'AuthSessionMissingError' && !error.message.includes('Auth session missing')) {
            return { success: false }
          }
        }
      } catch (signOutError: unknown) {
        // 处理AuthSessionMissingError或其他会话相关错误
        const error = signOutError as Error
        if (error.name === 'AuthSessionMissingError' || 
            error.message.includes('Auth session missing')) {
          // 会话已经不存在，忽略错误
        } else {
          // 其他错误，视为登出失败
          return { success: false }
        }
      }

      logInfo('用户登出成功', 'AuthService')
      return { success: true }
    } catch {
      return { success: true }
    }
  },

  // 注册
  register: async (userData: RegisterRequest): Promise<AuthResponse> => {
    try {
      if (!navigator.onLine) {
        return {
          success: false,
          message: '网络连接失败，请检查网络设置'
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            username: userData.username,
            phone: userData.phone
          }
        }
      })

      if (error) {
        if (error.code === 'auth/email-already-exists') {
          return {
            success: false,
            message: '该邮箱已被注册'
          }
        } else if (error.code === 'auth/invalid-email') {
          return {
            success: false,
            message: '邮箱格式不正确'
          }
        } else if (error.code === 'auth/weak-password') {
          return {
            success: false,
            message: '密码强度不足'
          }
        } else {
          return {
            success: false,
            message: `注册失败: ${error.message}`
          }
        }
      }

      if (data.user) {
        let role = 'normal'
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single()
          
          if (profileData && profileData.role) {
            role = profileData.role
          }
        } catch (profileError) {
          logError('获取用户角色失败', 'AuthService', profileError as Error)
        }

        const admin: Admin = {
          id: data.user.id,
          username: userData.username,
          role: role as 'super' | 'normal',
          createdAt: data.user.created_at,
          name: userData.username,
          email: data.user.email || '',
          phone: userData.phone || ''
        }

        try {
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              username: userData.username,
              name: userData.username,
              email: userData.email,
              phone: userData.phone,
              member_level: '普通',
              is_banned: false,
              created_at: new Date(data.user.created_at).toISOString(),
              updated_at: new Date(data.user.created_at).toISOString()
            })

          if (insertError) {
            logError('保存用户到users表失败', 'AuthService', insertError as Error)
          }
        } catch (error) {
          logError('保存用户到users表失败', 'AuthService', error as Error)
        }

        logInfo(`用户注册成功: ${userData.email}`, 'AuthService')

        return {
          success: true,
          data: {
            token: data.session?.access_token || '',
            admin
          }
        }
      } else {
        return {
          success: false,
          message: '注册失败，无用户数据'
        }
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        return {
          success: false,
          message: '网络请求失败，请检查网络连接或Supabase配置'
        }
      } else if (error instanceof Error) {
        return {
          success: false,
          message: `注册失败: ${error.message}`
        }
      } else {
        return {
          success: false,
          message: '注册失败，请检查网络连接'
        }
      }
    }
  },

  // 重置密码
  resetPassword: async (email: string): Promise<{ error?: string }> => {
    try {
      if (!navigator.onLine) {
        return { error: '网络连接失败，请检查网络设置' }
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      return { error: error?.message }
    } catch (error) {
      return { error: error instanceof Error ? error.message : '重置密码失败' }
    }
  },

  // 更新管理员个人信息
  updateAdminProfile: async (data: { id: string; name?: string; email?: string; phone?: string; password?: string }): Promise<{ success: boolean; message?: string }> => {
    try {
      // 如果更新密码
      if (data.password) {
        const { error } = await supabase.auth.updateUser({
          password: data.password
        })
        
        if (error) {
          logError('更新密码失败', 'AuthService', error as Error)
          return { success: false, message: `更新密码失败: ${error.message}` }
        }
      }

      // 如果更新邮箱
      if (data.email) {
        const { error } = await supabase.auth.updateUser({
          email: data.email
        })

        if (error) {
          logError('更新邮箱失败', 'AuthService', error as Error)
          return { success: false, message: `更新邮箱失败: ${error.message}` }
        }
      }

      // 更新用户元数据
      if (data.name || data.phone) {
        const { error } = await supabase.auth.updateUser({
          data: {
            name: data.name,
            phone: data.phone
          }
        })

        if (error) {
          logError('更新用户元数据失败', 'AuthService', error as Error)
          return { success: false, message: `更新个人信息失败: ${error.message}` }
        }
      }

      return { success: true, message: '个人信息更新成功' }
    } catch (error) {
      logError('更新个人信息异常', 'AuthService', error as Error)
      return { success: false, message: '网络错误，请稍后重试' }
    }
  }
}
