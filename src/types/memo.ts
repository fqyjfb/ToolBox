export interface MemoCategory {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Memo {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  content: string;
  status: 'active' | 'archived' | 'deleted';
  priority: 'high' | 'medium' | 'low';
  reminder_time: string | null;
  category_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMemoCategory {
  user_id: string;
  name: string;
  parent_id?: string | null;
  color?: string;
}

export interface CreateMemo {
  user_id: string;
  category_id?: string | null;
  title: string;
  content?: string;
  priority?: 'high' | 'medium' | 'low';
  reminder_time?: string | null;
}

export interface UpdateMemoCategory {
  name?: string;
  color?: string;
  parent_id?: string | null;
}

export interface UpdateMemo {
  category_id?: string | null;
  title?: string;
  content?: string;
  status?: 'active' | 'archived' | 'deleted';
  priority?: 'high' | 'medium' | 'low';
  reminder_time?: string | null;
}