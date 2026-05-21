export interface WebsiteAccountCategory {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  children?: WebsiteAccountCategory[];
}

export interface WebsiteAccount {
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

export interface WebsiteAccountCategoryRequest {
  name: string;
  parent_id?: string | null;
}

export interface WebsiteAccountRequest {
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