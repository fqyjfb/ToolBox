import { supabase } from './supabase';
import { TodoCategory, Todo, CreateTodoCategoryRequest, CreateTodoRequest } from '../types/todo';

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const categoryService = {
  async getCategories(userId: string): Promise<ServiceResponse<TodoCategory[]>> {
    try {
      const { data, error } = await supabase
        .from('todo_categories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '获取分类失败' };
    }
  },

  async createCategory(userId: string, request: CreateTodoCategoryRequest): Promise<ServiceResponse<TodoCategory>> {
    try {
      const { data, error } = await supabase
        .from('todo_categories')
        .insert({
          user_id: userId,
          name: request.name,
          parent_id: request.parent_id || null
        })
        .select()
        .single();
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '创建分类失败' };
    }
  },

  async updateCategory(userId: string, categoryId: string, request: CreateTodoCategoryRequest): Promise<ServiceResponse<TodoCategory>> {
    try {
      const { data, error } = await supabase
        .from('todo_categories')
        .update({
          name: request.name,
          parent_id: request.parent_id || null
        })
        .eq('id', categoryId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '更新分类失败' };
    }
  },

  async deleteCategory(userId: string, categoryId: string): Promise<ServiceResponse<void>> {
    try {
      const { error } = await supabase
        .from('todo_categories')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', userId);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '删除分类失败' };
    }
  }
};

const todoService = {
  async getTodos(userId: string, filter?: { category_id?: string }, page: number = 1, pageSize: number = 10): Promise<ServiceResponse<{ data: Todo[]; total: number }>> {
    try {
      let query = supabase
        .from('todos')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (filter?.category_id) {
        query = query.eq('category_id', filter.category_id);
      }
      
      const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true, data: { data: data || [], total: count || 0 } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '获取任务失败' };
    }
  },

  async createTodo(userId: string, request: CreateTodoRequest): Promise<ServiceResponse<Todo>> {
    try {
      const { data, error } = await supabase
        .from('todos')
        .insert({
          user_id: userId,
          title: request.title,
          description: request.description || null,
          due_date: request.due_date || null,
          priority: request.priority || '中',
          status: request.status || '待办',
          category_id: request.category_id || null,
          is_completed: false
        })
        .select()
        .single();
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '创建任务失败' };
    }
  },

  async updateTodo(userId: string, todoId: string, request: CreateTodoRequest): Promise<ServiceResponse<Todo>> {
    try {
      const { data, error } = await supabase
        .from('todos')
        .update({
          title: request.title,
          description: request.description || null,
          due_date: request.due_date || null,
          priority: request.priority || '中',
          status: request.status || '待办',
          category_id: request.category_id || null
        })
        .eq('id', todoId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '更新任务失败' };
    }
  },

  async updateTodoStatus(userId: string, todoId: string, isCompleted: boolean): Promise<ServiceResponse<Todo>> {
    try {
      const { data, error } = await supabase
        .from('todos')
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          status: isCompleted ? '已完成' : '待办'
        })
        .eq('id', todoId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '更新任务状态失败' };
    }
  },

  async deleteTodo(userId: string, todoId: string): Promise<ServiceResponse<void>> {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', todoId)
        .eq('user_id', userId);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '删除任务失败' };
    }
  },

  async searchTodos(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ServiceResponse<{ data: Todo[]; total: number }>> {
    try {
      const { data, error, count } = await supabase
        .from('todos')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true, data: { data: data || [], total: count || 0 } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '搜索任务失败' };
    }
  }
};

export const todoServiceWrapper = {
  category: categoryService,
  todo: todoService
};

export type { ServiceResponse, TodoCategory, Todo, CreateTodoCategoryRequest, CreateTodoRequest };