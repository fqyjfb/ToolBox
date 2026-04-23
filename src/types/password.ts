export interface PasswordCategory {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  children?: PasswordCategory[];
}

export interface Password {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  url: string;
  username: string;
  password: string;
  email: string;
  phone: string;
  security_question: string;
  date: string;
  status: 'active' | 'inactive' | 'expired';
  notes: string;
  created_at: string;
  updated_at: string;
  category_name?: string;
}

export interface PasswordCategoryRequest {
  name: string;
  parent_id?: string | null;
}

export interface PasswordRequest {
  category_id: string | null;
  name: string;
  url: string;
  username: string;
  password: string;
  email: string;
  phone: string;
  security_question: string;
  date: string;
  status: 'active' | 'inactive' | 'expired';
  notes: string;
}