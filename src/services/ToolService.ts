import { supabase } from './supabase';
import { logError, logInfo } from './loggerService';

export interface ToolCategory {
  id: string
  name: string
  parent_id: string | null
  order: number
  created_at: string
  updated_at: string
}

export interface Tool {
  id: string
  category_id: string | null
  title: string
  description: string | null
  download_url: string
  网盘类型: '夸克' | '百度' | '其他'
  icon_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  category_name?: string
}

class ToolService {
  async getCategories(): Promise<ToolCategory[]> {
    try {
      const { data, error } = await supabase
        .from('tool_categories')
        .select('*')
        .order('order', { ascending: true });

      if (error) {
        logError('获取工具分类失败', 'ToolService', error as Error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logError('获取工具分类失败', 'ToolService', error as Error);
      throw error;
    }
  }

  async addCategory(name: string, parent_id: string | null = null): Promise<ToolCategory> {
    try {
      const { data, error } = await supabase
        .from('tool_categories')
        .insert({ name, parent_id, order: 0 })
        .select()
        .single();

      if (error) {
        logError('添加工具分类失败', 'ToolService', error as Error);
        throw error;
      }

      logInfo(`添加工具分类成功: ${name}`, 'ToolService');
      return data;
    } catch (error) {
      logError('添加工具分类失败', 'ToolService', error as Error);
      throw error;
    }
  }

  async updateCategory(id: string, name: string): Promise<ToolCategory> {
    try {
      const { data, error } = await supabase
        .from('tool_categories')
        .update({ name })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logError('更新工具分类失败', 'ToolService', error as Error);
        throw error;
      }

      logInfo(`更新工具分类成功: ${name}`, 'ToolService');
      return data;
    } catch (error) {
      logError('更新工具分类失败', 'ToolService', error as Error);
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tool_categories')
        .delete()
        .eq('id', id);

      if (error) {
        logError('删除工具分类失败', 'ToolService', error as Error);
        throw error;
      }

      logInfo(`删除工具分类成功: ID=${id}`, 'ToolService');
    } catch (error) {
      logError('删除工具分类失败', 'ToolService', error as Error);
      throw error;
    }
  }

  private async getAllCategoryIds(categoryId: string): Promise<string[]> {
    try {
      const { data: categories, error } = await supabase
        .from('tool_categories')
        .select('*');

      if (error) {
        logError('获取分类列表失败', 'ToolService', error as Error);
        throw error;
      }

      const getAllChildIds = (id: string): string[] => {
        const result = [id];
        categories?.forEach(category => {
          if (category.parent_id === id) {
            result.push(...getAllChildIds(category.id));
          }
        });
        return result;
      };

      return getAllChildIds(categoryId);
    } catch (error) {
      logError('获取分类列表失败', 'ToolService', error as Error);
      throw error;
    }
  }

  async getTools(category_id?: string, searchTerm?: string, page: number = 1, pageSize: number = 10): Promise<{ data: Tool[], count: number }> {
    try {
      let query = supabase
        .from('tools')
        .select(`
          *,
          tool_categories(name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (category_id) {
        const categoryIds = await this.getAllCategoryIds(category_id);
        query = query.in('category_id', categoryIds);
      }

      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`);
      }

      const offset = (page - 1) * pageSize;
      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) {
        logError('获取工具列表失败', 'ToolService', error as Error);
        throw error;
      }

      const tools = (data || []).map(tool => ({
        ...tool,
        category_name: tool.tool_categories?.name
      }));

      return { data: tools, count: count || 0 };
    } catch (error) {
      logError('获取工具列表失败', 'ToolService', error as Error);
      throw error;
    }
  }

  async addTool(tool: Omit<Tool, 'id' | 'created_at' | 'updated_at' | 'category_name'>): Promise<Tool> {
    try {
      const { data, error } = await supabase
        .from('tools')
        .insert({ ...tool })
        .select()
        .single();

      if (error) {
        logError('添加工具失败', 'ToolService', error as Error);
        throw error;
      }

      logInfo(`添加工具成功: ${tool.title}`, 'ToolService');
      return data;
    } catch (error) {
      logError('添加工具失败', 'ToolService', error as Error);
      throw error;
    }
  }

  async updateTool(id: string, tool: Partial<Omit<Tool, 'id' | 'created_at' | 'updated_at' | 'category_name'>>): Promise<Tool> {
    try {
      const { data, error } = await supabase
        .from('tools')
        .update(tool)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logError('更新工具失败', 'ToolService', error as Error);
        throw error;
      }

      logInfo(`更新工具成功: ID=${id}`, 'ToolService');
      return data;
    } catch (error) {
      logError('更新工具失败', 'ToolService', error as Error);
      throw error;
    }
  }

  async deleteTool(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tools')
        .delete()
        .eq('id', id);

      if (error) {
        logError('删除工具失败', 'ToolService', error as Error);
        throw error;
      }

      logInfo(`删除工具成功: ID=${id}`, 'ToolService');
    } catch (error) {
      logError('删除工具失败', 'ToolService', error as Error);
      throw error;
    }
  }

  async getToolById(id: string): Promise<Tool> {
    try {
      const { data, error } = await supabase
        .from('tools')
        .select(`
          *,
          tool_categories(name)
        `)
        .eq('id', id)
        .single();

      if (error) {
        logError('获取工具详情失败', 'ToolService', error as Error);
        throw error;
      }

      return {
        ...data,
        category_name: data.tool_categories?.name
      };
    } catch (error) {
      logError('获取工具详情失败', 'ToolService', error as Error);
      throw error;
    }
  }
}

export default new ToolService()
