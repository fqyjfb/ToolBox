// 管理员数据模型
export interface Admin {
  id: string;
  username: string;
  role: 'super' | 'normal';
  createdAt: string;
  name?: string;
  email?: string;
  phone?: string;
}

// 认证响应模型
export interface AuthResponse {
  success: boolean;
  data?: {
    token: string;
    admin: Admin;
  };
  message?: string;
}

// 登录请求模型
export interface LoginRequest {
  username: string;
  password: string;
}

// 注册请求模型
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  phone?: string;
}
