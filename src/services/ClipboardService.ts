import { supabase } from './supabase';
import { logError } from './loggerService';
import {
  ClipboardCategory,
  ClipboardItem,
  CreateClipboardCategory,
  CreateClipboardItem,
  UpdateClipboardCategory,
  UpdateClipboardItem
} from '../types/clipboard';

class ClipboardService {
  async getCategories(userId: string): Promise<ClipboardCategory[]> {
    const { data, error } = await supabase
      .from('clipboard_categories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logError('获取剪贴板分类失败', 'ClipboardService', error);
      throw error;
    }

    return data;
  }

  async createCategory(category: CreateClipboardCategory): Promise<ClipboardCategory> {
    const { data, error } = await supabase
      .from('clipboard_categories')
      .insert(category)
      .select()
      .single();

    if (error) {
      logError('创建剪贴板分类失败', 'ClipboardService', error);
      throw error;
    }

    return data;
  }

  async updateCategory(id: string, updates: UpdateClipboardCategory): Promise<ClipboardCategory> {
    const { data, error } = await supabase
      .from('clipboard_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logError('更新剪贴板分类失败', 'ClipboardService', error);
      throw error;
    }

    return data;
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('clipboard_categories')
      .delete()
      .eq('id', id);

    if (error) {
      logError('删除剪贴板分类失败', 'ClipboardService', error);
      throw error;
    }
  }

  async getItems(userId: string, categoryId?: string | null, page: number = 1, pageSize: number = 10): Promise<{ items: ClipboardItem[], total: number }> {
    let query = supabase
      .from('clipboard_items')
      .select('*, clipboard_categories(name)', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    } else if (categoryId === null) {
      query = query.is('category_id', null);
    }

    const { data, error, count } = await query
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      logError('获取剪贴板项目失败', 'ClipboardService', error);
      throw error;
    }

    const items = (data || []).map(item => ({
      ...item,
      category: item.clipboard_categories ? {
        id: item.category_id,
        user_id: userId,
        name: item.clipboard_categories.name,
        created_at: '',
        updated_at: ''
      } : undefined
    }));

    return { items, total: count || 0 };
  }

  async searchItems(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<{ items: ClipboardItem[], total: number }> {
    const { data, error, count } = await supabase
      .from('clipboard_items')
      .select('*, clipboard_categories(name)', { count: 'exact' })
      .eq('user_id', userId)
      .ilike('content', `%${keyword}%`)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      logError('搜索剪贴板项目失败', 'ClipboardService', error);
      throw error;
    }

    const items = (data || []).map(item => ({
      ...item,
      category: item.clipboard_categories ? {
        id: item.category_id,
        user_id: userId,
        name: item.clipboard_categories.name,
        created_at: '',
        updated_at: ''
      } : undefined
    }));

    return { items, total: count || 0 };
  }

  async createItem(item: CreateClipboardItem): Promise<ClipboardItem> {
    const { data, error } = await supabase
      .from('clipboard_items')
      .insert(item)
      .select()
      .single();

    if (error) {
      logError('创建剪贴板项目失败', 'ClipboardService', error);
      throw error;
    }

    return data;
  }

  async updateItem(id: string, updates: UpdateClipboardItem): Promise<ClipboardItem> {
    const { data, error } = await supabase
      .from('clipboard_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logError('更新剪贴板项目失败', 'ClipboardService', error);
      throw error;
    }

    return data;
  }

  async deleteItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('clipboard_items')
      .delete()
      .eq('id', id);

    if (error) {
      logError('删除剪贴板项目失败', 'ClipboardService', error);
      throw error;
    }
  }

  async deleteItemsByCategory(categoryId: string): Promise<void> {
    const { error } = await supabase
      .from('clipboard_items')
      .delete()
      .eq('category_id', categoryId);

    if (error) {
      logError('批量删除剪贴板项目失败', 'ClipboardService', error);
      throw error;
    }
  }
}

export const clipboardService = new ClipboardService();
