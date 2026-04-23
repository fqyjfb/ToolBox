import { supabase } from './supabase';
import { QuickReplyCategory, QuickReply, CreateQuickReplyCategoryRequest, CreateQuickReplyRequest } from '../types/quickReply';

export const quickReplyService = {
  async getCategories(userId: string): Promise<QuickReplyCategory[]> {
    const { data, error } = await supabase
      .from('quick_reply_categories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    const categories = data || [];
    return buildCategoryTree(categories);
  },

  async createCategory(request: CreateQuickReplyCategoryRequest): Promise<QuickReplyCategory> {
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
      throw error;
    }
    
    return data;
  },

  async updateCategory(categoryId: string, updates: { name?: string; parent_id?: string | null }): Promise<QuickReplyCategory> {
    const { data, error } = await supabase
      .from('quick_reply_categories')
      .update(updates)
      .eq('id', categoryId)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return data;
  },

  async deleteCategory(categoryId: string): Promise<void> {
    const { error } = await supabase
      .from('quick_reply_categories')
      .delete()
      .eq('id', categoryId);
    
    if (error) {
      throw error;
    }
  },

  async getQuickReplies(userId: string, categoryId?: string, page: number = 1, pageSize: number = 5): Promise<{ list: QuickReply[]; total: number }> {
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
      throw error;
    }
    
    return {
      list: data || [],
      total: count || 0
    };
  },

  async createQuickReply(request: CreateQuickReplyRequest): Promise<QuickReply> {
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
      throw error;
    }
    
    return data;
  },

  async updateQuickReply(quickReplyId: string, updates: { content?: string; category_id?: string | null }): Promise<void> {
    const { error } = await supabase
      .from('quick_replies')
      .update(updates)
      .eq('id', quickReplyId);
    
    if (error) {
      throw error;
    }
  },

  async deleteQuickReply(quickReplyId: string): Promise<void> {
    const { error } = await supabase
      .from('quick_replies')
      .delete()
      .eq('id', quickReplyId);
    
    if (error) {
      throw error;
    }
  },

  async searchQuickReplies(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<{ list: QuickReply[]; total: number }> {
    const { data, error, count } = await supabase
      .from('quick_replies')
      .select('*, category:quick_reply_categories(*)', { count: 'exact' })
      .eq('user_id', userId)
      .ilike('content', `%${keyword}%`)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    
    if (error) {
      throw error;
    }
    
    return {
      list: data || [],
      total: count || 0
    };
  }
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