import { getDataAccessLayer } from './dataAccessLayer'
import { ClipboardCategory, ClipboardItem } from '../types/clipboard'
import { logError, logInfo } from './loggerService'

export const clipboardService = {
  async getCategories(userId: string): Promise<ClipboardCategory[]> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data } = await dal.list<ClipboardCategory>('clipboard_categories')

      return data
    } catch (error) {
      logError('获取剪贴板分类失败', 'ClipboardService', error as Error)
      throw error
    }
  },

  async createCategory(userId: string, request: { name: string }): Promise<ClipboardCategory> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.create<ClipboardCategory>('clipboard_categories', {
        name: request.name
      })
      logInfo(`创建剪贴板分类成功: ${request.name}`, 'ClipboardService')
      return data
    } catch (error) {
      logError('创建剪贴板分类失败', 'ClipboardService', error as Error)
      throw error
    }
  },

  async updateCategory(userId: string, categoryId: string, request: { name: string }): Promise<ClipboardCategory> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.update<ClipboardCategory>('clipboard_categories', categoryId, {
        name: request.name
      })
      logInfo(`更新剪贴板分类成功: ID=${categoryId}`, 'ClipboardService')
      return data
    } catch (error) {
      logError('更新剪贴板分类失败', 'ClipboardService', error as Error)
      throw error
    }
  },

  async updateCategoryOrder(_userId: string, _orderedIds: string[]): Promise<void> {
    // 排序功能暂未实现（数据库无order字段）
  },

  async deleteCategory(userId: string, categoryId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('clipboard_categories', categoryId)
      logInfo(`删除剪贴板分类成功: ID=${categoryId}`, 'ClipboardService')
    } catch (error) {
      logError('删除剪贴板分类失败', 'ClipboardService', error as Error)
      throw error
    }
  },

  async getItems(userId: string, categoryId?: string, page: number = 1, pageSize: number = 10): Promise<{ list: ClipboardItem[]; total: number }> {
    try {
      const dal = getDataAccessLayer(userId)
      const filters = categoryId ? { category_id: categoryId } : undefined
      const { data, total } = await dal.list<ClipboardItem>('clipboard_items', {
        filters,
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const { data: categories } = await dal.list<ClipboardCategory>('clipboard_categories')
      const categoryMap = new Map(categories.map(c => [c.id, c]))

      const list = data.map(item => ({
        ...item,
        category_name: (item.category_id ? categoryMap.get(item.category_id)?.name : '') || ''
      }))

      return { list, total }
    } catch (error) {
      logError('获取剪贴板列表失败', 'ClipboardService', error as Error)
      throw error
    }
  },

  async createItem(userId: string, request: { category_id?: string | null; content: string }): Promise<ClipboardItem> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.create<ClipboardItem>('clipboard_items', {
        category_id: request.category_id || null,
        content: request.content
      })
      logInfo(`创建剪贴板项目成功`, 'ClipboardService')
      return data
    } catch (error) {
      logError('创建剪贴板项目失败', 'ClipboardService', error as Error)
      throw error
    }
  },

  async updateItem(userId: string, itemId: string, request: { category_id?: string | null; content?: string }): Promise<ClipboardItem> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.update<ClipboardItem>('clipboard_items', itemId, request)
      logInfo(`更新剪贴板项目成功: ID=${itemId}`, 'ClipboardService')
      return data
    } catch (error) {
      logError('更新剪贴板项目失败', 'ClipboardService', error as Error)
      throw error
    }
  },

  async deleteItem(userId: string, itemId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('clipboard_items', itemId)
      logInfo(`删除剪贴板项目成功: ID=${itemId}`, 'ClipboardService')
    } catch (error) {
      logError('删除剪贴板项目失败', 'ClipboardService', error as Error)
      throw error
    }
  },

  async searchItems(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<{ list: ClipboardItem[]; total: number }> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.search<ClipboardItem>('clipboard_items', keyword, ['content'], {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const { data: categories } = await dal.list<ClipboardCategory>('clipboard_categories')
      const categoryMap = new Map(categories.map(c => [c.id, c]))

      const list = data.map(item => ({
        ...item,
        category_name: (item.category_id ? categoryMap.get(item.category_id)?.name : '') || ''
      }))

      return { list, total }
    } catch (error) {
      logError('搜索剪贴板项目失败', 'ClipboardService', error as Error)
      throw error
    }
  }
}
