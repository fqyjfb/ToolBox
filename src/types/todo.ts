export interface TodoCategory {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface Todo {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: '高' | '中' | '低';
  status: '待办' | '进行中' | '已完成' | '已取消';
  is_completed: boolean;
  completed_at: string | null;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTodoCategoryRequest {
  name: string;
  parent_id?: string | null;
}

export interface CreateTodoRequest {
  title: string;
  description?: string;
  due_date?: string;
  priority?: '高' | '中' | '低';
  status?: '待办' | '进行中' | '已完成' | '已取消';
  category_id?: string | null;
}