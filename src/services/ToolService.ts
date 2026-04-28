import { supabase } from './supabase'

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
    const { data, error } = await supabase
      .from('tool_categories')
      .select('*')
      .order('order', { ascending: true })

    if (error) {
      console.error('获取工具分类失败:', error)
      throw error
    }

    return data || []
  }

  async addCategory(name: string, parent_id: string | null = null): Promise<ToolCategory> {
    const { data, error } = await supabase
      .from('tool_categories')
      .insert({ name, parent_id, order: 0 })
      .select()
      .single()

    if (error) {
      console.error('添加工具分类失败:', error)
      throw error
    }

    return data
  }

  async updateCategory(id: string, name: string): Promise<ToolCategory> {
    const { data, error } = await supabase
      .from('tool_categories')
      .update({ name })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('更新工具分类失败:', error)
      throw error
    }

    return data
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('tool_categories')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('删除工具分类失败:', error)
      throw error
    }
  }

  private async getAllCategoryIds(categoryId: string): Promise<string[]> {
    const { data: categories, error } = await supabase
      .from('tool_categories')
      .select('*')

    if (error) {
      console.error('获取分类列表失败:', error)
      throw error
    }

    const getAllChildIds = (id: string): string[] => {
      const result = [id]
      categories?.forEach(category => {
        if (category.parent_id === id) {
          result.push(...getAllChildIds(category.id))
        }
      })
      return result
    }

    return getAllChildIds(categoryId)
  }

  async getTools(category_id?: string, searchTerm?: string, page: number = 1, pageSize: number = 10): Promise<{ data: Tool[], count: number }> {
    let query = supabase
      .from('tools')
      .select(`
        *,
        tool_categories(name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    if (category_id) {
      const categoryIds = await this.getAllCategoryIds(category_id)
      query = query.in('category_id', categoryIds)
    }

    if (searchTerm) {
      query = query.ilike('title', `%${searchTerm}%`)
    }

    const offset = (page - 1) * pageSize
    query = query.range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('获取工具列表失败:', error)
      throw error
    }

    const tools = (data || []).map(tool => ({
      ...tool,
      category_name: tool.tool_categories?.name
    }))

    return { data: tools, count: count || 0 }
  }

  async addTool(tool: Omit<Tool, 'id' | 'created_at' | 'updated_at' | 'category_name'>): Promise<Tool> {
    const { data, error } = await supabase
      .from('tools')
      .insert({ ...tool })
      .select()
      .single()

    if (error) {
      console.error('添加工具失败:', error)
      throw error
    }

    return data
  }

  async updateTool(id: string, tool: Partial<Omit<Tool, 'id' | 'created_at' | 'updated_at' | 'category_name'>>): Promise<Tool> {
    const { data, error } = await supabase
      .from('tools')
      .update(tool)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('更新工具失败:', error)
      throw error
    }

    return data
  }

  async deleteTool(id: string): Promise<void> {
    const { error } = await supabase
      .from('tools')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('删除工具失败:', error)
      throw error
    }
  }

  async getToolById(id: string): Promise<Tool> {
    const { data, error } = await supabase
      .from('tools')
      .select(`
        *,
        tool_categories(name)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('获取工具详情失败:', error)
      throw error
    }

    return {
      ...data,
      category_name: data.tool_categories?.name
    }
  }
}

export default new ToolService()