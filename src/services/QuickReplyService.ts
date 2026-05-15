import { supabase } from './supabase';
import { QuickReplyCategory, QuickReply, CreateQuickReplyCategoryRequest, CreateQuickReplyRequest } from '../types/quickReply';
import { logError, logInfo } from './loggerService';

export const quickReplyService = {
  async getCategories(userId: string): Promise<QuickReplyCategory[]> {
    try {
      const { data, error } = await supabase
        .from('quick_reply_categories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        logError('获取快捷回复分类失败', 'QuickReplyService', error as Error);
        throw error;
      }
      
      const categories = data || [];
      return buildCategoryTree(categories);
    } catch (error) {
      logError('获取快捷回复分类失败', 'QuickReplyService', error as Error);
      throw error;
    }
  },

  async createCategory(request: CreateQuickReplyCategoryRequest): Promise<QuickReplyCategory> {
    try {
      const { data, error } = await supabase
        .from('quick_reply_categories')
        .insert({
          user_id: request.user_id,
          name: request.name,
          parent_id: request.parent_id || null
        })
        .select()
        .single();
      
      if (error) {
        logError('创建快捷回复分类失败', 'QuickReplyService', error as Error);
        throw error;
      }
      
      logInfo(`创建快捷回复分类成功: ${request.name}`, 'QuickReplyService');
      return data;
    } catch (error) {
      logError('创建快捷回复分类失败', 'QuickReplyService', error as Error);
      throw error;
    }
  },

  async updateCategory(categoryId: string, updates: { name?: string; parent_id?: string | null }): Promise<QuickReplyCategory> {
    try {
      const { data, error } = await supabase
        .from('quick_reply_categories')
        .update(updates)
        .eq('id', categoryId)
        .select()
        .single();
      
      if (error) {
        logError('更新快捷回复分类失败', 'QuickReplyService', error as Error);
        throw error;
      }
      
      logInfo(`更新快捷回复分类成功: ID=${categoryId}`, 'QuickReplyService');
      return data;
    } catch (error) {
      logError('更新快捷回复分类失败', 'QuickReplyService', error as Error);
      throw error;
    }
  },

  async deleteCategory(categoryId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('quick_reply_categories')
        .delete()
        .eq('id', categoryId);
      
      if (error) {
        logError('删除快捷回复分类失败', 'QuickReplyService', error as Error);
        throw error;
      }
      
      logInfo(`删除快捷回复分类成功: ID=${categoryId}`, 'QuickReplyService');
    } catch (error) {
      logError('删除快捷回复分类失败', 'QuickReplyService', error as Error);
      throw error;
    }
  },

  async getQuickReplies(userId: string, categoryId?: string, page: number = 1, pageSize: number = 5): Promise<{ list: QuickReply[]; total: number }> {
    try {
      let query = supabase
        .from('quick_replies')
        .select('*, category:quick_reply_categories(*)', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }
      
      const { data, error, count } = await query
        .range((page - 1) * pageSize, page * pageSize - 1);
      
      if (error) {
        logError('获取快捷回复失败', 'QuickReplyService', error as Error);
        throw error;
      }
      
      return {
        list: data || [],
        total: count || 0
      };
    } catch (error) {
      logError('获取快捷回复失败', 'QuickReplyService', error as Error);
      throw error;
    }
  },

  async createQuickReply(request: CreateQuickReplyRequest): Promise<QuickReply> {
    try {
      const { data, error } = await supabase
        .from('quick_replies')
        .insert({
          user_id: request.user_id,
          category_id: request.category_id || null,
          content: request.content
        })
        .select('*, category:quick_reply_categories(*)')
        .single();
      
      if (error) {
        logError('创建快捷回复失败', 'QuickReplyService', error as Error);
        throw error;
      }
      
      logInfo(`创建快捷回复成功`, 'QuickReplyService');
      return data;
    } catch (error) {
      logError('创建快捷回复失败', 'QuickReplyService', error as Error);
      throw error;
    }
  },

  async updateQuickReply(quickReplyId: string, updates: { content?: string; category_id?: string | null }): Promise<void> {
    try {
      const { error } = await supabase
        .from('quick_replies')
        .update(updates)
        .eq('id', quickReplyId);
      
      if (error) {
        logError('更新快捷回复失败', 'QuickReplyService', error as Error);
        throw error;
      }
      
      logInfo(`更新快捷回复成功: ID=${quickReplyId}`, 'QuickReplyService');
    } catch (error) {
      logError('更新快捷回复失败', 'QuickReplyService', error as Error);
      throw error;
    }
  },

  async deleteQuickReply(quickReplyId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('quick_replies')
        .delete()
        .eq('id', quickReplyId);
      
      if (error) {
        logError('删除快捷回复失败', 'QuickReplyService', error as Error);
        throw error;
      }
      
      logInfo(`删除快捷回复成功: ID=${quickReplyId}`, 'QuickReplyService');
    } catch (error) {
      logError('删除快捷回复失败', 'QuickReplyService', error as Error);
      throw error;
    }
  },

  async searchQuickReplies(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<{ list: QuickReply[]; total: number }> {
    try {
      const { data, error, count } = await supabase
        .from('quick_replies')
        .select('*, category:quick_reply_categories(*)', { count: 'exact' })
        .eq('user_id', userId)
        .ilike('content', `%${keyword}%`)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      
      if (error) {
        logError('搜索快捷回复失败', 'QuickReplyService', error as Error);
        throw error;
      }
      
      return {
        list: data || [],
        total: count || 0
      };
    } catch (error) {
      logError('搜索快捷回复失败', 'QuickReplyService', error as Error);
      throw error;
    }
  },
};

function buildCategoryTree(categories: QuickReplyCategory[]): QuickReplyCategory[] {
  const map = new Map<string, QuickReplyCategory>();
  const roots: QuickReplyCategory[] = [];
  
  categories.forEach(category => {
    map.set(category.id, { ...category, children: [] });
  });
  
  categories.forEach(category => {
    if (category.parent_id && map.has(category.parent_id)) {
      const parent = map.get(category.parent_id)!;
      if (!parent.children) parent.children = [];
      parent.children.push(map.get(category.id)!);
    } else {
      roots.push(map.get(category.id)!);
    }
  });
  
  return roots;
}