export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  phone?: string;
  memberLevel: '普通' | 'VIP' | 'SVIP';
  vipExpireAt?: string;
  isBanned: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Admin {
  id: string;
  username: string;
  role: 'super' | 'normal';
  createdAt: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    token: string;
    user: User;
    admin?: Admin;
  };
  message?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  phone?: string;
}