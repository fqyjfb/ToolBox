import { getDataAccessLayer } from './dataAccessLayer'
import { QuickReply, QuickReplyCategory } from '../types/quickReply'
import { logError, logInfo } from './loggerService'

export const quickReplyService = {
  async getCategories(userId: string): Promise<QuickReplyCategory[]> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data } = await dal.list<QuickReplyCategory>('quick_reply_categories', {
        orderBy: { column: 'created_at', ascending: true }
      })

      const buildTree = (categories: QuickReplyCategory[], parentId: string | null = null): QuickReplyCategory[] => {
        return categories
          .filter(category => category.parent_id === parentId)
          .map(category => ({
            ...category,
            children: buildTree(categories, category.id)
          }))
      }

      return buildTree(data)
    } catch (error) {
      logError('获取快捷回复分类失败', 'QuickReplyService', error as Error)
      throw error
    }
  },

  async createCategory(userId: string, request: { name: string; parent_id?: string | null }): Promise<QuickReplyCategory> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.create<QuickReplyCategory>('quick_reply_categories', {
        name: request.name,
        parent_id: request.parent_id || null,
        order: 0
      })
      logInfo(`创建快捷回复分类成功: ${request.name}`, 'QuickReplyService')
      return data
    } catch (error) {
      logError('创建快捷回复分类失败', 'QuickReplyService', error as Error)
      throw error
    }
  },

  async updateCategory(userId: string, categoryId: string, request: { name: string }): Promise<QuickReplyCategory> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.update<QuickReplyCategory>('quick_reply_categories', categoryId, {
        name: request.name
      })
      logInfo(`更新快捷回复分类成功: ID=${categoryId}`, 'QuickReplyService')
      return data
    } catch (error) {
      logError('更新快捷回复分类失败', 'QuickReplyService', error as Error)
      throw error
    }
  },

  async deleteCategory(userId: string, categoryId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('quick_reply_categories', categoryId)
      logInfo(`删除快捷回复分类成功: ID=${categoryId}`, 'QuickReplyService')
    } catch (error) {
      logError('删除快捷回复分类失败', 'QuickReplyService', error as Error)
      throw error
    }
  },

  async getQuickReplies(userId: string, categoryId?: string, page: number = 1, pageSize: number = 10): Promise<{ list: QuickReply[]; total: number }> {
    try {
      const dal = getDataAccessLayer(userId)
      const filters = categoryId ? { category_id: categoryId } : undefined
      const { data, total } = await dal.list<QuickReply>('quick_replies', {
        filters,
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const { data: categories } = await dal.list<QuickReplyCategory>('quick_reply_categories')
      const categoryMap = new Map(categories.map(c => [c.id, c]))

      const list = data.map(item => ({
        ...item,
        category_name: (item.category_id ? categoryMap.get(item.category_id)?.name : '') || ''
      }))

      return { list, total }
    } catch (error) {
      logError('获取快捷回复列表失败', 'QuickReplyService', error as Error)
      throw error
    }
  },

  async createQuickReply(userId: string, request: { category_id?: string | null; content: string }): Promise<QuickReply> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.create<QuickReply>('quick_replies', {
        category_id: request.category_id || null,
        content: request.content
      })
      logInfo(`创建快捷回复成功`, 'QuickReplyService')
      return data
    } catch (error) {
      logError('创建快捷回复失败', 'QuickReplyService', error as Error)
      throw error
    }
  },

  async updateQuickReply(userId: string, quickReplyId: string, request: { content?: string; category_id?: string | null }): Promise<QuickReply> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.update<QuickReply>('quick_replies', quickReplyId, request)
      logInfo(`更新快捷回复成功: ID=${quickReplyId}`, 'QuickReplyService')
      return data
    } catch (error) {
      logError('更新快捷回复失败', 'QuickReplyService', error as Error)
      throw error
    }
  },

  async deleteQuickReply(userId: string, quickReplyId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('quick_replies', quickReplyId)
      logInfo(`删除快捷回复成功: ID=${quickReplyId}`, 'QuickReplyService')
    } catch (error) {
      logError('删除快捷回复失败', 'QuickReplyService', error as Error)
      throw error
    }
  },

  async searchQuickReplies(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<{ list: QuickReply[]; total: number }> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.search<QuickReply>('quick_replies', keyword, ['content'], {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const { data: categories } = await dal.list<QuickReplyCategory>('quick_reply_categories')
      const categoryMap = new Map(categories.map(c => [c.id, c]))

      const list = data.map(item => ({
        ...item,
        category_name: (item.category_id ? categoryMap.get(item.category_id)?.name : '') || ''
      }))

      return { list, total }
    } catch (error) {
      logError('搜索快捷回复失败', 'QuickReplyService', error as Error)
      throw error
    }
  }
}
