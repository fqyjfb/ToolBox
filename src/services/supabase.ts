import { createClient } from '@supabase/supabase-js'

// Supabase配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 检查环境变量
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase配置缺失，请检查.env文件')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// 测试连接
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session)
})
