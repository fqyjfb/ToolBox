import { getDataAccessLayer } from './dataAccessLayer'
import { WebsiteAccount, WebsiteAccountCategory, WebsiteAccountCategoryRequest, WebsiteAccountRequest } from '../types/websiteAccount'
import { encrypt, decrypt } from '../utils/crypto'
import { logError, logInfo } from './loggerService'

export const websiteAccountService = {
  async getCategories(userId: string): Promise<WebsiteAccountCategory[]> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data } = await dal.list<WebsiteAccountCategory>('website_account_categories', {
        orderBy: { column: 'created_at', ascending: true }
      })

      const buildTree = (categories: WebsiteAccountCategory[], parentId: string | null = null): WebsiteAccountCategory[] => {
        return categories
          .filter(category => category.parent_id === parentId)
          .map(category => ({
            ...category,
            children: buildTree(categories, category.id)
          }))
      }

      return buildTree(data)
    } catch (error) {
      logError('获取网站账号分类失败', 'WebsiteAccountService', error as Error)
      throw error
    }
  },

  async createCategory(userId: string, request: WebsiteAccountCategoryRequest): Promise<WebsiteAccountCategory> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.create<WebsiteAccountCategory>('website_account_categories', {
        name: request.name,
        parent_id: request.parent_id || null
      })
      logInfo(`创建网站账号分类成功: ${request.name}`, 'WebsiteAccountService')
      return data
    } catch (error) {
      logError('创建网站账号分类失败', 'WebsiteAccountService', error as Error)
      throw error
    }
  },

  async updateCategory(userId: string, categoryId: string, request: WebsiteAccountCategoryRequest): Promise<WebsiteAccountCategory> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.update<WebsiteAccountCategory>('website_account_categories', categoryId, {
        name: request.name,
        parent_id: request.parent_id || null
      })
      logInfo(`更新网站账号分类成功: ID=${categoryId}`, 'WebsiteAccountService')
      return data
    } catch (error) {
      logError('更新网站账号分类失败', 'WebsiteAccountService', error as Error)
      throw error
    }
  },

  async deleteCategory(userId: string, categoryId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('website_account_categories', categoryId)
      logInfo(`删除网站账号分类成功: ID=${categoryId}`, 'WebsiteAccountService')
    } catch (error) {
      logError('删除网站账号分类失败', 'WebsiteAccountService', error as Error)
      throw error
    }
  },

  async getAccounts(
    userId: string,
    categoryId?: string | string[],
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ list: WebsiteAccount[]; total: number }> {
    try {
      const dal = getDataAccessLayer(userId)
      const filters = categoryId ? { category_id: categoryId } : undefined
      const { data, total } = await dal.list<WebsiteAccount>('website_accounts', {
        filters,
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const { data: categories } = await dal.list<WebsiteAccountCategory>('website_account_categories')
      const categoryMap = new Map(categories.map(c => [c.id, c]))

      const list = await Promise.all(data.map(async (item) => {
        let decryptedPassword = item.password
        if (item.password) {
          try {
            decryptedPassword = await decrypt(item.password)
          } catch (e) {
            logError('解密失败', 'WebsiteAccountService', e as Error)
          }
        }
        return {
          ...item,
          password: decryptedPassword,
          category_name: (item.category_id ? categoryMap.get(item.category_id)?.name : '') || ''
        }
      }))

      return { list, total }
    } catch (error) {
      logError('获取网站账号列表失败', 'WebsiteAccountService', error as Error)
      throw error
    }
  },

  async createAccount(userId: string, request: WebsiteAccountRequest): Promise<WebsiteAccount> {
    try {
      const dal = getDataAccessLayer(userId)
      const encryptedPassword = request.password ? await encrypt(request.password) : ''

      const data = await dal.create<WebsiteAccount>('website_accounts', {
        category_id: request.category_id,
        name: request.name,
        url: request.url,
        username: request.username,
        password: encryptedPassword,
        email: request.email,
        phone: request.phone,
        security_question: request.security_question,
        date: request.date || '',
        status: request.status || 'active',
        notes: request.notes
      })

      logInfo(`创建网站账号成功: ${request.name}`, 'WebsiteAccountService')
      return { ...data, password: request.password || '' }
    } catch (error) {
      logError('创建网站账号失败', 'WebsiteAccountService', error as Error)
      throw error
    }
  },

  async updateAccount(userId: string, accountId: string, request: WebsiteAccountRequest): Promise<WebsiteAccount> {
    try {
      const dal = getDataAccessLayer(userId)
      const encryptedPassword = request.password ? await encrypt(request.password) : ''

      const data = await dal.update<WebsiteAccount>('website_accounts', accountId, {
        category_id: request.category_id,
        name: request.name,
        url: request.url,
        username: request.username,
        password: encryptedPassword,
        email: request.email,
        phone: request.phone,
        security_question: request.security_question,
        date: request.date || '',
        status: request.status,
        notes: request.notes
      })

      logInfo(`更新网站账号成功: ID=${accountId}`, 'WebsiteAccountService')
      return { ...data, password: request.password || '' }
    } catch (error) {
      logError('更新网站账号失败', 'WebsiteAccountService', error as Error)
      throw error
    }
  },

  async deleteAccount(userId: string, accountId: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('website_accounts', accountId)
      logInfo(`删除网站账号成功: ID=${accountId}`, 'WebsiteAccountService')
    } catch (error) {
      logError('删除网站账号失败', 'WebsiteAccountService', error as Error)
      throw error
    }
  },

  async searchAccounts(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<{ list: WebsiteAccount[]; total: number }> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.search<WebsiteAccount>('website_accounts', keyword, ['name', 'url', 'username', 'email'], {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })

      const { data: categories } = await dal.list<WebsiteAccountCategory>('website_account_categories')
      const categoryMap = new Map(categories.map(c => [c.id, c]))

      const list = await Promise.all(data.map(async (item) => {
        let decryptedPassword = item.password
        if (item.password) {
          try {
            decryptedPassword = await decrypt(item.password)
          } catch (e) {
            logError('解密失败', 'WebsiteAccountService', e as Error)
          }
        }
        return {
          ...item,
          password: decryptedPassword,
          category_name: (item.category_id ? categoryMap.get(item.category_id)?.name : '') || ''
        }
      }))

      return { list, total }
    } catch (error) {
      logError('搜索网站账号失败', 'WebsiteAccountService', error as Error)
      throw error
    }
  }
}
