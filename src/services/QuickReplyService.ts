import { BaseService } from './baseService'
import { getDataAccessLayer } from './dataAccessLayer'
import { QuickReply, QuickReplyCategory } from '../types/quickReply'
import { logError, logInfo } from './loggerService'

// 分类服务
const categoryService = {
  async getCategories(userId: string): Promise<QuickReplyCategory[]> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data } = await dal.list<QuickReplyCategory>('quick_reply_categories')

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

  async createCategory(userId: string, request: { name: string; parent_id?: string | null }) {
    try {
      const dal = getDataAccessLayer(userId)
      const parentId = request.parent_id || null
      
      const data = await dal.create<QuickReplyCategory>('quick_reply_categories', {
        name: request.name,
        parent_id: parentId
      })
      logInfo(`创建快捷回复分类成功: ${request.name}`, 'QuickReplyService')
      return data
    } catch (error) {
      logError('创建快捷回复分类失败', 'QuickReplyService', error as Error)
      throw error
    }
  },

  async updateCategory(userId: string, categoryId: string, request: { name: string }) {
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

  async updateCategoryOrder(_userId: string, _orderedIds: string[]): Promise<void> {
    // 排序功能暂未实现（数据库无order字段）
  },

  async deleteCategory(userId: string, categoryId: string) {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('quick_reply_categories', categoryId)
      logInfo(`删除快捷回复分类成功: ID=${categoryId}`, 'QuickReplyService')
    } catch (error) {
      logError('删除快捷回复分类失败', 'QuickReplyService', error as Error)
      throw error
    }
  }
}

// 快捷回复服务（使用 replyService 避免与导出名冲突）
const replyService = {
  async getQuickReplies(userId: string, categoryId?: string, page: number = 1, pageSize: number = 10) {
    const baseService = new BaseService<QuickReply>('quick_replies', 'QuickReplyService')
    const filters = categoryId ? { category_id: categoryId } : undefined
    const result = await baseService.getList(userId, { filters }, page, pageSize)

    if (result.success && result.data) {
      const dal = getDataAccessLayer(userId)
      const { data: categories } = await dal.list<QuickReplyCategory>('quick_reply_categories')
      const categoryMap = new Map(categories.map(c => [c.id, c]))

      const list = result.data.data.map(item => ({
        ...item,
        category_name: (item.category_id ? categoryMap.get(item.category_id)?.name : '') || ''
      }))

      return { list, total: result.data.total }
    }

    return { list: [], total: 0 }
  },

  async createQuickReply(userId: string, request: { category_id?: string | null; content: string }) {
    const baseService = new BaseService<QuickReply>('quick_replies', 'QuickReplyService')
    const result = await baseService.create(userId, {
      category_id: request.category_id || null,
      content: request.content
    })
    if (result.success) {
      logInfo(`创建快捷回复成功`, 'QuickReplyService')
    }
    return result.data
  },

  async updateQuickReply(userId: string, quickReplyId: string, request: { content?: string; category_id?: string | null }) {
    const baseService = new BaseService<QuickReply>('quick_replies', 'QuickReplyService')
    const updates: Partial<QuickReply> = {}
    if (request.content !== undefined) updates.content = request.content
    if (request.category_id !== undefined) updates.category_id = request.category_id
    const result = await baseService.update(userId, quickReplyId, updates)
    if (result.success) {
      logInfo(`更新快捷回复成功: ID=${quickReplyId}`, 'QuickReplyService')
    }
    return result.data
  },

  async deleteQuickReply(userId: string, quickReplyId: string) {
    const baseService = new BaseService<QuickReply>('quick_replies', 'QuickReplyService')
    await baseService.delete(userId, quickReplyId)
    logInfo(`删除快捷回复成功: ID=${quickReplyId}`, 'QuickReplyService')
  },

  async searchQuickReplies(userId: string, keyword: string, page: number = 1, pageSize: number = 10) {
    const baseService = new BaseService<QuickReply>('quick_replies', 'QuickReplyService')
    const result = await baseService.search(userId, keyword, ['content'], {}, page, pageSize)

    if (result.success && result.data) {
      const dal = getDataAccessLayer(userId)
      const { data: categories } = await dal.list<QuickReplyCategory>('quick_reply_categories')
      const categoryMap = new Map(categories.map(c => [c.id, c]))

      const list = result.data.data.map(item => ({
        ...item,
        category_name: (item.category_id ? categoryMap.get(item.category_id)?.name : '') || ''
      }))

      return { list, total: result.data.total }
    }

    return { list: [], total: 0 }
  }
}

export const quickReplyService = {
  ...categoryService,
  ...replyService
}

export type { QuickReply, QuickReplyCategory }
