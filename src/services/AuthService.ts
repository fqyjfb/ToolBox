import { AuthResponse, LoginRequest, Admin, RegisterRequest, User } from '../types/auth'
import { supabase } from './supabase'
import { logError, logInfo } from './loggerService'
import { localStorageService, STORAGE_KEYS } from './localStorageService'

const parseStoredUser = (): User | null => {
  const storedUser = localStorageService.get<User>(STORAGE_KEYS.USER, null as unknown as User)
  if (!storedUser) return null
  return storedUser
}

interface AuthUser {
  id: string
  email?: string
  created_at?: string
  user_metadata?: { name?: string; phone?: string }
}

interface UserDetails {
  userName: string
  memberLevel: '普通' | 'VIP' | 'SVIP'
  vipExpireAt: string | undefined
  isBanned: boolean
  userPhone: string | undefined
}

const fetchUserDetails = async (userId: string): Promise<UserDetails> => {
  let memberLevel: '普通' | 'VIP' | 'SVIP' = '普通'
  let vipExpireAt: string | undefined
  let isBanned = false
  let userName = ''
  let userPhone: string | undefined

  try {
    const { data: userData } = await supabase
      .from('users')
      .select('username, name, email, phone, member_level, vip_expire_at, is_banned')
      .eq('id', userId)
      .single()

    if (userData) {
      userName = userData.name || userData.username || ''
      memberLevel = (userData.member_level as '普通' | 'VIP' | 'SVIP') || '普通'
      vipExpireAt = userData.vip_expire_at || undefined
      isBanned = userData.is_banned || false
      userPhone = userData.phone || undefined
    }
  } catch {}

  return { userName, memberLevel, vipExpireAt, isBanned, userPhone }
}

const fetchAdminRole = async (userId: string): Promise<'super' | 'normal' | undefined> => {
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (!profileError && profileData?.role && (profileData.role === 'super' || profileData.role === 'normal')) {
      return profileData.role as 'super' | 'normal'
    }
  } catch {}
  return undefined
}

export const authService = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    try {
      if (!navigator.onLine) {
        return {
          success: false,
          message: '网络连接失败，请检查网络设置'
        }
      }

      const email = credentials.username

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: credentials.password
      })

      if (error) {
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

      if (!data.user) {
        return {
          success: false,
          message: '登录失败，无用户数据'
        }
      }

      const { userName, memberLevel, vipExpireAt, isBanned, userPhone } = await fetchUserDetails(data.user.id)

      if (isBanned) {
        return {
          success: false,
          message: '您的账号已被封禁，请联系管理员'
        }
      }

      let finalMemberLevel = memberLevel
      let finalVipExpireAt = vipExpireAt

      if (vipExpireAt) {
        const expireDate = new Date(vipExpireAt)
        if (expireDate < new Date() && memberLevel !== '普通') {
          try {
            await supabase
              .from('users')
              .update({ member_level: '普通', vip_expire_at: null })
              .eq('id', data.user.id)
            finalMemberLevel = '普通'
            finalVipExpireAt = undefined
          } catch {}
        }
      }

      const adminRole = await fetchAdminRole(data.user.id)

      const user: User = {
        id: data.user.id,
        username: data.user.email || '',
        name: userName || data.user.email?.split('@')[0] || '',
        email: data.user.email || '',
        phone: userPhone,
        memberLevel: finalMemberLevel,
        vipExpireAt: finalVipExpireAt,
        isBanned: false,
        createdAt: data.user.created_at || ''
      }

      const result: AuthResponse = {
        success: true,
        data: {
          token: data.session?.access_token || '',
          user
        }
      }

      if (adminRole) {
        result.data!.admin = {
          id: data.user.id,
          username: data.user.email || '',
          role: adminRole,
          createdAt: data.user.created_at || '',
          name: userName,
          email: data.user.email || '',
          phone: userPhone
        }
      }

      logInfo(`用户登录成功: ${data.user.email}`, 'AuthService')
      return result
    } catch (error) {
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

  getCurrentUser: async (): Promise<{ success: boolean; data?: User; admin?: Admin }> => {
    try {
      const parsedStoredUser = parseStoredUser()

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
      } catch {}

      if (!isSessionValid && parsedStoredUser) {
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

      if (!isSessionValid && !parsedStoredUser) {
        return { success: false }
      }

      if (authUser) {
        const { userName, memberLevel, vipExpireAt, isBanned, userPhone } = await fetchUserDetails(authUser.id)

        if (isBanned) {
          return { success: false }
        }

        const user: User = {
          id: authUser.id,
          username: authUser.email || '',
          name: userName || authUser.email?.split('@')[0] || '',
          email: authUser.email || '',
          phone: userPhone,
          memberLevel,
          vipExpireAt,
          isBanned: false,
          createdAt: authUser.created_at || ''
        }

        const adminRole = await fetchAdminRole(authUser.id)
        const admin = adminRole ? {
          id: authUser.id,
          username: authUser.email || '',
          role: adminRole,
          createdAt: authUser.created_at || '',
          name: userName,
          email: authUser.email || '',
          phone: userPhone
        } : undefined

        return { success: true, data: user, admin }
      }

      if (parsedStoredUser) {
        return { success: true, data: parsedStoredUser }
      }

      return { success: false }
    } catch {
      return { success: false }
    }
  },

  logout: async (): Promise<{ success: boolean }> => {
    try {
      try {
        const { error } = await supabase.auth.signOut()
        if (error) {
          if (error.name !== 'AuthSessionMissingError' && !error.message.includes('Auth session missing')) {
            return { success: false }
          }
        }
      } catch (signOutError: unknown) {
        const error = signOutError as Error
        if (error.name === 'AuthSessionMissingError' ||
            error.message.includes('Auth session missing')) {
        } else {
          return { success: false }
        }
      }

      logInfo('用户登出成功', 'AuthService')
      return { success: true }
    } catch {
      return { success: true }
    }
  },

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

      if (!data.user) {
        return {
          success: false,
          message: '注册失败，无用户数据'
        }
      }

      const user: User = {
        id: data.user.id,
        username: userData.username,
        name: userData.username,
        email: userData.email,
        phone: userData.phone,
        memberLevel: '普通',
        isBanned: false,
        createdAt: data.user.created_at || ''
      }

      try {
        await supabase.from('users').insert({
          id: data.user.id,
          username: userData.username,
          name: userData.username,
          email: userData.email,
          phone: userData.phone || '',
          member_level: '普通',
          is_banned: false,
          created_at: new Date(data.user.created_at!).toISOString(),
          updated_at: new Date(data.user.created_at!).toISOString()
        })
      } catch (insertError) {
        logError('保存用户到users表失败', 'AuthService', insertError as Error)
      }

      logInfo(`用户注册成功: ${userData.email}`, 'AuthService')

      return {
        success: true,
        data: {
          token: data.session?.access_token || '',
          user
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

  updateAdminProfile: async (data: { id: string; name?: string; email?: string; phone?: string; password?: string }): Promise<{ success: boolean; message?: string }> => {
    try {
      if (data.password) {
        const { error } = await supabase.auth.updateUser({
          password: data.password
        })

        if (error) {
          logError('更新密码失败', 'AuthService', error as Error)
          return { success: false, message: `更新密码失败: ${error.message}` }
        }
      }

      if (data.email) {
        const { error } = await supabase.auth.updateUser({
          email: data.email
        })

        if (error) {
          logError('更新邮箱失败', 'AuthService', error as Error)
          return { success: false, message: `更新邮箱失败: ${error.message}` }
        }
      }

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