import { getDataAccessLayer } from './dataAccessLayer'
import { MemoCategory, Memo } from '../types/memo'
import { logError, logInfo } from './loggerService'

const consoleLog = (message: string, data?: unknown) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[MemoService] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
}

export const memoService = {
  async getCategories(userId: string): Promise<MemoCategory[]> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data } = await dal.list<MemoCategory>('memo_categories', {
        orderBy: { column: 'sort_order', ascending: true }
      })
      return data
    } catch (error) {
      logError('获取备忘录分类失败', 'MemoService', error as Error)
      throw error
    }
  },

  async createCategory(userId: string, request: { name: string; color?: string; parent_id?: string | null }): Promise<MemoCategory> {
    try {
      consoleLog('createCategory called', { userId, request })
      const dal = getDataAccessLayer(userId)
      consoleLog('getDataAccessLayer success', { userId })
      const { data: categories } = await dal.list<MemoCategory>('memo_categories')
      consoleLog('list categories success', { count: categories.length })
      const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order || 0)) : 0
      
      const createData = {
        name: request.name,
        color: request.color || '#275D7E',
        parent_id: request.parent_id || null,
        sort_order: maxOrder + 1
      }
      consoleLog('creating category with data', createData)
      
      const data = await dal.create<MemoCategory>('memo_categories', createData)
      consoleLog('create category success', data)
      logInfo(`创建备忘录分类成功: ${request.name}`, 'MemoService')
      return data
    } catch (error) {
      consoleLog('createCategory error', error)
      logError('创建备忘录分类失败', 'MemoService', error as Error)
      throw error
    }
  },

  async updateCategory(userId: string, categoryId: string, request: { name?: string; color?: string }): Promise<MemoCategory> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.update<MemoCategory>('memo_categories', categoryId, request)
      logInfo(`更新备忘录分类成功: ID=${categoryId}`, 'MemoService')
      return data
    } catch (error) {
      logError('更新备忘录分类失败', 'MemoService', error as Error)
      throw error
    }
  },

  async updateCategoryOrder(userId: string, orderedIds: string[]): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      for (let i = 0; i < orderedIds.length; i++) {
        await dal.update<MemoCategory>('memo_categories', orderedIds[i], { sort_order: i + 1 })
      }
      logInfo(`更新备忘录分类排序成功`, 'MemoService')
    } catch (error) {
      logError('更新备忘录分类排序失败', 'MemoService', error as Error)
      throw error
    }
  },

  async deleteCategory(userId: string, categoryId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('memo_categories', categoryId)
      logInfo(`删除备忘录分类成功: ID=${categoryId}`, 'MemoService')
    } catch (error) {
      logError('删除备忘录分类失败', 'MemoService', error as Error)
      throw error
    }
  },

  async getMemos(userId: string, categoryId?: string, page: number = 1, pageSize: number = 10): Promise<{ list: Memo[]; total: number }> {
    try {
      const dal = getDataAccessLayer(userId)
      const filters = categoryId ? { category_id: categoryId, status: 'active' } : { status: 'active' }
      const { data, total } = await dal.list<Memo>('memos', {
        filters,
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const { data: categories } = await dal.list<MemoCategory>('memo_categories')
      const categoryMap = new Map(categories.map(c => [c.id, c]))

      const list = data.map(item => ({
        ...item,
        category_name: (item.category_id ? categoryMap.get(item.category_id)?.name : '') || ''
      }))

      return { list, total }
    } catch (error) {
      logError('获取备忘录列表失败', 'MemoService', error as Error)
      throw error
    }
  },

  async createMemo(userId: string, request: { category_id?: string | null; title: string; content?: string; priority?: 'high' | 'medium' | 'low'; reminder_time?: string | null }): Promise<Memo> {
    try {
      consoleLog('createMemo called', { userId, request })
      const dal = getDataAccessLayer(userId)
      consoleLog('getDataAccessLayer success', { userId })
      
      const createData = {
        category_id: request.category_id || null,
        title: request.title,
        content: request.content || '',
        status: 'active' as 'active' | 'archived' | 'deleted',
        priority: (request.priority || 'medium') as 'high' | 'medium' | 'low',
        reminder_time: request.reminder_time || null
      }
      consoleLog('creating memo with data', createData)
      
      const data = await dal.create<Memo>('memos', createData)
      consoleLog('create memo success', data)
      logInfo(`创建备忘录成功`, 'MemoService')
      return data
    } catch (error) {
      consoleLog('createMemo error', error)
      logError('创建备忘录失败', 'MemoService', error as Error)
      throw error
    }
  },

  async updateMemo(userId: string, memoId: string, request: { category_id?: string | null; title?: string; content?: string; status?: 'active' | 'archived' | 'deleted'; priority?: 'high' | 'medium' | 'low'; reminder_time?: string | null }): Promise<Memo> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.update<Memo>('memos', memoId, request as Partial<Memo>)
      logInfo(`更新备忘录成功: ID=${memoId}`, 'MemoService')
      return data
    } catch (error) {
      logError('更新备忘录失败', 'MemoService', error as Error)
      throw error
    }
  },

  async deleteMemo(userId: string, memoId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('memos', memoId)
      logInfo(`删除备忘录成功: ID=${memoId}`, 'MemoService')
    } catch (error) {
      logError('删除备忘录失败', 'MemoService', error as Error)
      throw error
    }
  },

  async searchMemos(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<{ list: Memo[]; total: number }> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data } = await dal.search<Memo>('memos', keyword, ['title', 'content'], {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const activeData = data.filter(item => item.status === 'active')

      const { data: categories } = await dal.list<MemoCategory>('memo_categories')
      const categoryMap = new Map(categories.map(c => [c.id, c]))

      const list = activeData.map(item => ({
        ...item,
        category_name: (item.category_id ? categoryMap.get(item.category_id)?.name : '') || ''
      }))

      return { list, total: activeData.length }
    } catch (error) {
      logError('搜索备忘录失败', 'MemoService', error as Error)
      throw error
    }
  }
}