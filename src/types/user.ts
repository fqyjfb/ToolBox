export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  birthday: string;
  memberLevel: string;
  vipExpireAt: string;
  isBanned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  success: boolean;
  data: {
    list: User[];
    total: number;
    page: number;
    pageSize: number;
  };
  message?: string;
}

export interface UserDetailResponse {
  success: boolean;
  data: User;
  message?: string;
}

export interface UserUpdateRequest {
  name: string;
  email: string;
  phone: string;
  address: string;
  birthday: string;
  memberLevel: string;
  vipExpireAt: string;
  isBanned: boolean;
}

export interface GenericResponse {
  success: boolean;
  message: string;
}