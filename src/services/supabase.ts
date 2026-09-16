import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { logError } from './loggerService'

// Supabase 环境变量配置（web/手机端使用，桌面端作为默认值）
const envUrl = import.meta.env.VITE_SUPABASE_URL
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!envUrl || !envKey) {
  logError('Supabase 配置缺失，桌面端请在设置中配置', 'supabase')
}

const createSupabaseClient = (url: string, key: string): SupabaseClient =>
  createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })

// 当前生效的客户端（可被 reinitSupabase 替换）
let currentClient = createSupabaseClient(
  envUrl || 'https://placeholder.supabase.co',
  envKey || 'placeholder-anon-key'
)

// 使用 Proxy 让 supabase.xxx 动态指向 currentClient，支持运行时重新初始化
export const supabase: SupabaseClient = new Proxy(currentClient, {
  get(_target, prop) {
    return Reflect.get(currentClient, prop)
  }
})

// 桌面端用户自定义配置后重新初始化客户端
export const reinitSupabase = (url: string, anonKey: string) => {
  currentClient = createSupabaseClient(url, anonKey)
}
