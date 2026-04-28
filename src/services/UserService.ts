import { User, UserListResponse, UserDetailResponse, UserUpdateRequest, GenericResponse } from '../types/user'
import { supabase } from './supabase'

const camelToSnake = (str: string): string => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

const checkAndUpdateMemberStatus = async (user: User): Promise<User> => {
  try {
    if (user.vipExpireAt) {
      const expireDate = new Date(user.vipExpireAt)
      const now = new Date()
      
      if (expireDate < now && user.memberLevel !== '普通') {
        const { error } = await supabase
          .from('users')
          .update({
            member_level: '普通',
            vip_expire_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (!error) {
          return {
            ...user,
            memberLevel: '普通',
            vipExpireAt: '',
            updatedAt: new Date().toISOString()
          }
        }
      }
    }
    return user
  } catch {
    return user
  }
}

const updateExpiredMembers = async (): Promise<void> => {
  try {
    const now = new Date().toISOString()
    await supabase
      .from('users')
      .update({
        member_level: '普通',
        vip_expire_at: null,
        updated_at: new Date().toISOString()
      })
      .lt('vip_expire_at', now)
      .neq('member_level', '普通')
  } catch {
    console.warn('更新过期会员等级失败')
  }
}

export const userService = {
  getUserList: async (
    page: number = 1,
    pageSize: number = 10,
    search: string = '',
    sortBy: string = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc',
    memberLevel: string = '',
    status: string = ''
  ): Promise<UserListResponse> => {
    try {
      await updateExpiredMembers()

      const snakeSortBy = camelToSnake(sortBy)
      
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' })

      if (search) {
        query = query.or(`username.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
      }

      if (memberLevel) {
        query = query.eq('member_level', memberLevel)
      }

      if (status) {
        if (status === 'active') {
          query = query.eq('is_banned', false)
        } else if (status === 'banned') {
          query = query.eq('is_banned', true)
        }
      }

      query = query.order(snakeSortBy, { ascending: sortOrder === 'asc' })

      const startIndex = (page - 1) * pageSize
      query = query.range(startIndex, startIndex + pageSize - 1)

      const { data, error, count } = await query

      if (error) {
        return {
          success: false,
          data: { list: [], total: 0, page, pageSize },
          message: error.message || '获取用户列表失败'
        }
      }

      const users: User[] = (data || []).map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address || '',
        birthday: user.birthday ? user.birthday.toString() : '',
        memberLevel: user.member_level,
        vipExpireAt: user.vip_expire_at ? user.vip_expire_at.toString() : '',
        isBanned: user.is_banned || false,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }))

      return {
        success: true,
        data: { list: users, total: count || 0, page, pageSize }
      }
    } catch {
      return { success: false, data: { list: [], total: 0, page, pageSize } }
    }
  },

  getUserDetail: async (id: string): Promise<UserDetailResponse> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        return { success: false, data: {} as User, message: error.message || '获取用户详情失败' }
      }

      if (data) {
        const user: User = {
          id: data.id,
          username: data.username,
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address || '',
          birthday: data.birthday ? data.birthday.toString() : '',
          memberLevel: data.member_level,
          vipExpireAt: data.vip_expire_at ? data.vip_expire_at.toString() : '',
          isBanned: data.is_banned || false,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }

        const updatedUser = await checkAndUpdateMemberStatus(user)
        return { success: true, data: updatedUser }
      } else {
        return { success: false, data: {} as User, message: '用户不存在' }
      }
    } catch {
      return { success: false, data: {} as User, message: '网络错误，请稍后重试' }
    }
  },

  updateUser: async (id: string, data: UserUpdateRequest): Promise<GenericResponse> => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          birthday: data.birthday,
          member_level: data.memberLevel,
          vip_expire_at: data.vipExpireAt || null,
          is_banned: data.isBanned,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) {
        return { success: false, message: `更新失败: ${error.message || '未知错误'}` }
      }

      return { success: true, message: '更新成功' }
    } catch {
      return { success: false, message: '网络错误，请稍后重试' }
    }
  },

  resetPassword: async (id: string): Promise<GenericResponse> => {
    try {
      const { data: userData, error: getUserError } = await supabase
        .from('users')
        .select('email')
        .eq('id', id)
        .single()

      if (getUserError) {
        return { success: false, message: '获取用户信息失败' }
      }

      if (!userData?.email) {
        return { success: false, message: '用户邮箱不存在' }
      }

      const { error } = await supabase.auth.resetPasswordForEmail(userData.email, {
        redirectTo: `${window.location.origin}/admin/users`
      })

      if (error) {
        return { success: false, message: `重置失败: ${error.message || '未知错误'}` }
      }

      await supabase
        .from('users')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', id)

      return { success: true, message: '密码重置邮件已发送，请检查邮箱' }
    } catch {
      return { success: false, message: '网络错误，请稍后重试' }
    }
  },

  checkAndUpdateMemberStatus
}