export interface BaseEntity {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ListResponse<T> {
  list: T[];
  total: number;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}