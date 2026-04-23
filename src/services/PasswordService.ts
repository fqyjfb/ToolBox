import { supabase } from './supabase';
import { Password, PasswordCategory, PasswordCategoryRequest, PasswordRequest } from '../types/password';
import { encrypt } from '../utils/crypto';

export const passwordService = {
  async getCategories(userId: string): Promise<PasswordCategory[]> {
    const { data, error } = await supabase
      .from('password_categories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const buildTree = (categories: PasswordCategory[], parentId: string | null = null): PasswordCategory[] => {
      return categories
        .filter(category => category.parent_id === parentId)
        .map(category => ({
          ...category,
          children: buildTree(categories, category.id)
        }));
    };

    return buildTree(data || []);
  },

  async createCategory(userId: string, request: PasswordCategoryRequest): Promise<PasswordCategory> {
    const { data, error } = await supabase
      .from('password_categories')
      .insert({
        user_id: userId,
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

  async updateCategory(categoryId: string, request: PasswordCategoryRequest): Promise<PasswordCategory> {
    const { data, error } = await supabase
      .from('password_categories')
      .update({
        name: request.name,
        parent_id: request.parent_id || null,
        updated_at: new Date().toISOString()
      })
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
      .from('password_categories')
      .delete()
      .eq('id', categoryId);

    if (error) {
      throw error;
    }
  },

  async getPasswords(
    userId: string,
    categoryId?: string | string[],
    status?: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ list: Password[]; total: number }> {
    let query = supabase
      .from('passwords')
      .select('*, password_categories(name)', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (categoryId) {
      if (Array.isArray(categoryId)) {
        query = query.in('category_id', categoryId);
      } else {
        query = query.eq('category_id', categoryId);
      }
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      throw error;
    }

    const passwords = (data || []).map((item: any) => ({
      id: item.id,
      user_id: item.user_id,
      category_id: item.category_id,
      name: item.name,
      url: item.url || '',
      username: item.username || '',
      password: item.password,
      email: item.email || '',
      phone: item.phone || '',
      security_question: item.security_question || '',
      date: item.date ? item.date.toString() : '',
      status: item.status || 'active',
      notes: item.notes || '',
      created_at: item.created_at,
      updated_at: item.updated_at,
      category_name: item.password_categories?.name || ''
    }));

    return {
      list: passwords,
      total: count || 0
    };
  },

  async createPassword(userId: string, request: PasswordRequest): Promise<Password> {
    const encryptedPassword = request.password ? await encrypt(request.password) : '';
    
    const { data, error } = await supabase
      .from('passwords')
      .insert({
        user_id: userId,
        category_id: request.category_id,
        name: request.name,
        url: request.url,
        username: request.username,
        password: encryptedPassword,
        email: request.email,
        phone: request.phone,
        security_question: request.security_question,
        date: request.date || null,
        status: request.status,
        notes: request.notes
      })
      .select('*, password_categories(name)')
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      user_id: data.user_id,
      category_id: data.category_id,
      name: data.name,
      url: data.url || '',
      username: data.username || '',
      password: data.password,
      email: data.email || '',
      phone: data.phone || '',
      security_question: data.security_question || '',
      date: data.date ? data.date.toString() : '',
      status: data.status || 'active',
      notes: data.notes || '',
      created_at: data.created_at,
      updated_at: data.updated_at,
      category_name: data.password_categories?.name || ''
    };
  },

  async updatePassword(passwordId: string, request: PasswordRequest): Promise<Password> {
    const encryptedPassword = request.password ? await encrypt(request.password) : '';
    
    const { data, error } = await supabase
      .from('passwords')
      .update({
        category_id: request.category_id,
        name: request.name,
        url: request.url,
        username: request.username,
        password: encryptedPassword,
        email: request.email,
        phone: request.phone,
        security_question: request.security_question,
        date: request.date || null,
        status: request.status,
        notes: request.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', passwordId)
      .select('*, password_categories(name)')
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      user_id: data.user_id,
      category_id: data.category_id,
      name: data.name,
      url: data.url || '',
      username: data.username || '',
      password: data.password,
      email: data.email || '',
      phone: data.phone || '',
      security_question: data.security_question || '',
      date: data.date ? data.date.toString() : '',
      status: data.status || 'active',
      notes: data.notes || '',
      created_at: data.created_at,
      updated_at: data.updated_at,
      category_name: data.password_categories?.name || ''
    };
  },

  async deletePassword(passwordId: string): Promise<void> {
    const { error } = await supabase
      .from('passwords')
      .delete()
      .eq('id', passwordId);

    if (error) {
      throw error;
    }
  },

  async searchPasswords(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<{ list: Password[]; total: number }> {
    const { data, error, count } = await supabase
      .from('passwords')
      .select('*, password_categories(name)', { count: 'exact' })
      .eq('user_id', userId)
      .or(`name.ilike.%${keyword}%,url.ilike.%${keyword}%,username.ilike.%${keyword}%,email.ilike.%${keyword}%,phone.ilike.%${keyword}%`)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      throw error;
    }

    const passwords = (data || []).map((item: any) => ({
      id: item.id,
      user_id: item.user_id,
      category_id: item.category_id,
      name: item.name,
      url: item.url || '',
      username: item.username || '',
      password: item.password,
      email: item.email || '',
      phone: item.phone || '',
      security_question: item.security_question || '',
      date: item.date ? item.date.toString() : '',
      status: item.status || 'active',
      notes: item.notes || '',
      created_at: item.created_at,
      updated_at: item.updated_at,
      category_name: item.password_categories?.name || ''
    }));

    return {
      list: passwords,
      total: count || 0
    };
  }
};