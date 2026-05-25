import { supabase } from './supabase'
import type { Category, Bookmark } from '../types/website'
import { logError, logInfo } from './loggerService'

// 简单的缓存实现
class CacheService {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map()
  private defaultExpiry = 5 * 60 * 1000 // 5分钟

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    const now = Date.now()
    if (now - item.timestamp > this.defaultExpiry) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  set(key: string, data: unknown) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  clearByPrefix(prefix: string) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }

  clear() {
    this.cache.clear()
  }
}

const cacheService = new CacheService()

// 辅助函数：关联分类信息到书签
async function attachCategoriesToBookmarks(bookmarks: Bookmark[], cachedCategories?: Category[]): Promise<Bookmark[]> {
  if (!bookmarks || bookmarks.length === 0) {
    return []
  }
  
  // 使用提供的缓存分类数据或从接口获取
  const categories = cachedCategories || await websiteService.getCategories()
  
  // 手动关联分类信息
  return bookmarks.map(bookmark => {
    const category = categories.find(cat => cat.id === bookmark.category_id)
    return {
      ...bookmark,
      category
    }
  })
}

// 构建分类树结构（复用内部函数）
export function buildCategoryTreeFromData(categories: Category[]): Category[] {
  const categoryMap = new Map<string, Category>()
  const rootCategories: Category[] = []
  
  // 初始化分类映射
  categories.forEach(category => {
    // 确保每个分类都有children属性
    const categoryWithChildren = { ...category, children: [] }
    categoryMap.set(category.id, categoryWithChildren)
  })
  
  // 构建嵌套结构
  categoryMap.forEach(category => {
    if (!category.parent_id) {
      // 根分类
      rootCategories.push(category)
    } else {
      // 子分类，添加到父分类的children数组中
      const parent = categoryMap.get(category.parent_id)
      if (parent) {
        parent.children?.push(category)
      }
    }
  })
  
  return rootCategories
}

export const websiteService = {
  // 分类相关
  async getCategories(options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<Category[]> {
    const cacheKey = 'categories_all'
    
    // 检查缓存
    if (!options?.forceRefresh) {
      const cachedData = cacheService.get<Category[]>(cacheKey)
      if (cachedData) {
        return cachedData
      }
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('order', { ascending: true })
        .order('created_at', { ascending: false })
      
      if (error) {
        logError('获取分类失败', 'WebsiteService', error as Error)
        return []
      }

      const categories = data as Category[] || []

      // 设置缓存
      cacheService.set(cacheKey, categories)

      return categories
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Get categories request aborted:', error.message)
        return []
      }
      logError('获取分类失败', 'WebsiteService', error as Error)
      return []
    }
  },

  async getCategoryById(id: string): Promise<Category | null> {
    const cacheKey = `category_${id}`
    
    // 检查缓存
    const cachedData = cacheService.get<Category>(cacheKey)
    if (cachedData) {
      return cachedData
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) {
        logError('获取分类失败', 'WebsiteService', error as Error)
        return null
      }

      const category = data as Category || null

      // 设置缓存
      if (category) {
        cacheService.set(cacheKey, category)
      }

      return category
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Get category by id request aborted:', error.message)
        return null
      }
      logError('获取分类失败', 'WebsiteService', error as Error)
      return null
    }
  },

  // 构建分类树结构
  buildCategoryTree(categories: Category[]): Category[] {
    const categoryMap = new Map<string, Category>()
    const rootCategories: Category[] = []
    
    // 初始化分类映射
    categories.forEach(category => {
      // 确保每个分类都有children属性
      const categoryWithChildren = { ...category, children: [] }
      categoryMap.set(category.id, categoryWithChildren)
    })
    
    // 构建嵌套结构
    categoryMap.forEach(category => {
      if (!category.parent_id) {
        // 根分类
        rootCategories.push(category)
      } else {
        // 子分类，添加到父分类的children数组中
        const parent = categoryMap.get(category.parent_id)
        if (parent) {
          parent.children?.push(category)
        }
      }
    })
    
    return rootCategories
  },

  // 书签相关
  async getPublicBookmarks(options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<Bookmark[]> {
    const cacheKey = 'bookmarks_public'
    
    // 检查缓存
    if (!options?.forceRefresh) {
      const cachedData = cacheService.get<Bookmark[]>(cacheKey)
      if (cachedData) {
        return cachedData
      }
    }
    
    try {
      // 并行获取公开书签和分类数据
      const [bookmarksResult, categoriesResult] = await Promise.all([
        supabase
          .from('bookmarks')
          .select('*')
          .eq('is_public', true)
          .order('order', { ascending: true }),
        this.getCategories()
      ])
      
      if (bookmarksResult.error) throw bookmarksResult.error
      
      // 关联分类信息，使用已获取的分类数据
      const bookmarksWithCategories = await attachCategoriesToBookmarks(bookmarksResult.data || [], categoriesResult)
      
      // 设置缓存
      cacheService.set(cacheKey, bookmarksWithCategories)
      
      return bookmarksWithCategories
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Get public bookmarks request aborted:', error.message)
        return []
      }
      logError('Get public bookmarks error', 'WebsiteService', error as Error)
      
      // 如果缓存存在，返回缓存数据
      const cachedData = cacheService.get<Bookmark[]>(cacheKey)
      if (cachedData) {
        return cachedData
      }
      
      return []
    }
  },

  // 收藏相关
  async addFavorite(bookmarkId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        logError('用户未登录', 'WebsiteService')
        return false
      }

      const { error } = await supabase
        .from('user_favorites')
        .insert({
          user_id: user.id,
          bookmark_id: bookmarkId
        })

      if (error) {
        logError('添加收藏失败', 'WebsiteService', error as Error)
        return false
      }

      // 清除收藏相关缓存
      cacheService.clearByPrefix(`favorites_user_${user.id}`)

      logInfo(`添加收藏成功: 书签ID=${bookmarkId}`, 'WebsiteService')
      return true
    } catch (error) {
      logError('添加收藏失败', 'WebsiteService', error as Error)
      return false
    }
  },

  async removeFavorite(bookmarkId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('用户未登录')
        return false
      }
      
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('bookmark_id', bookmarkId)
        .eq('user_id', user.id)
      
      if (error) {
        console.error('移除收藏失败:', error)
        return false
      }
      
      // 清除收藏相关缓存
      cacheService.clearByPrefix(`favorites_user_${user.id}`)
      
      logInfo(`移除收藏成功: 书签ID=${bookmarkId}`, 'WebsiteService')
      return true
    } catch (error) {
      console.error('移除收藏失败:', error)
      return false
    }
  },

  async getFavorites(options?: { signal?: AbortSignal; forceRefresh?: boolean; cachedCategories?: Category[] }): Promise<Bookmark[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        logError('用户未登录', 'WebsiteService')
        return []
      }

      const cacheKey = `favorites_user_${user.id}`;
      
      // 检查缓存
      if (!options?.forceRefresh) {
        const cachedData = cacheService.get<Bookmark[]>(cacheKey)
        if (cachedData) {
          return cachedData
        }
      }
      
      // 1. 获取用户的收藏
      const { data: favorites, error } = await supabase
        .from('user_favorites')
        .select('bookmark_id')
        .eq('user_id', user.id)
      
      if (error) throw error
      
      if (!favorites || favorites.length === 0) {
        // 设置空缓存，避免重复请求
        cacheService.set(cacheKey, [])
        return []
      }
      
      // 2. 获取收藏的书签详情
      const bookmarkIds = favorites.map(f => f.bookmark_id)
      const { data: bookmarks, error: bookmarksError } = await supabase
        .from('bookmarks')
        .select('*')
        .in('id', bookmarkIds)
      
      if (bookmarksError) throw bookmarksError
      
      // 3. 关联分类信息
      const bookmarksWithCategories = await attachCategoriesToBookmarks(bookmarks || [], options?.cachedCategories)
      
      // 4. 标记为收藏
      const bookmarksWithFavoriteFlag = bookmarksWithCategories.map(bookmark => ({
        ...bookmark,
        is_favorite: true
      }))
      
      // 设置缓存
      cacheService.set(cacheKey, bookmarksWithFavoriteFlag)
      
      return bookmarksWithFavoriteFlag
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Get favorites request aborted:', error.message)
        return []
      }
      logError('Get favorites error', 'WebsiteService', error as Error)
      return []
    }
  },

  async checkFavorite(bookmarkId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        logError('用户未登录', 'WebsiteService')
        return false
      }

      const { data, error } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('bookmark_id', bookmarkId)
        .eq('user_id', user.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return false
        }
        logError('检查收藏状态失败', 'WebsiteService', error as Error)
        return false
      }

      return !!data
    } catch (error) {
      logError('检查收藏状态失败', 'WebsiteService', error as Error)
      return false
    }
  },

  // 管理功能：获取书签列表（带分页和搜索）
  async getAdminBookmarks(options: { 
    page?: number, 
    pageSize?: number, 
    search?: string, 
    categoryIds?: string[],
    signal?: AbortSignal 
  }): Promise<{ data: Bookmark[], total: number }> {
    const { page = 1, pageSize = 10, search, categoryIds } = options
    
    try {
      // 构建查询
      let query = supabase.from('bookmarks').select('*', { count: 'exact' })
      
      // 应用搜索
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,url.ilike.%${search}%`)
      }
      
      // 应用分类筛选
      if (categoryIds && categoryIds.length > 0) {
        query = query.in('category_id', categoryIds)
      }
      
      // 应用分页
      const from = (page - 1) * pageSize
      const to = page * pageSize - 1
      
      // 执行查询
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to)
      
      if (error) throw error
      
      return {
        data: data || [],
        total: count || 0
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Get admin bookmarks request aborted:', error.message)
        return { data: [], total: 0 }
      }
      logError('Get admin bookmarks error', 'WebsiteService', error as Error)
      return { data: [], total: 0 }
    }
  },

  // 管理功能：添加书签
  async addBookmark(bookmark: Omit<Bookmark, 'id' | 'created_at' | 'updated_at'>): Promise<Bookmark | null> {
    try {
      const { data, error } = await supabase
        .from('bookmarks')
        .insert(bookmark)
        .select()
        .single()
      
      if (error) throw error
      
      // 清除缓存
      cacheService.clearByPrefix('admin_bookmarks')
      cacheService.clearByPrefix('bookmarks_public')
      
      return data as Bookmark
    } catch (error) {
      logError('Add bookmark error', 'WebsiteService', error as Error)
      return null
    }
  },

  // 管理功能：更新书签
  async updateBookmark(id: string, bookmark: Partial<Bookmark>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('bookmarks')
        .update({
          ...bookmark,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
      
      if (error) throw error
      
      // 清除缓存
      cacheService.clearByPrefix('admin_bookmarks')
      cacheService.clearByPrefix('bookmarks_public')
      
      return true
    } catch (error) {
      logError('Update bookmark error', 'WebsiteService', error as Error)
      return false
    }
  },

  // 管理功能：删除书签
  async deleteBookmark(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      // 清除缓存
      cacheService.clearByPrefix('admin_bookmarks')
      cacheService.clearByPrefix('bookmarks_public')
      cacheService.clearByPrefix('favorites_user')
      
      return true
    } catch (error) {
      logError('Delete bookmark error', 'WebsiteService', error as Error)
      return false
    }
  },

  // 管理功能：添加分类
  async addCategory(name: string, parentId: string | null, order: number = 0): Promise<Category | null> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          name,
          parent_id: parentId,
          order
        })
        .select()
        .single()
      
      if (error) throw error
      
      // 清除缓存
      cacheService.clearByPrefix('categories')
      
      return data as Category
    } catch (error) {
      logError('Add category error', 'WebsiteService', error as Error)
      return null
    }
  },

  // 管理功能：更新分类
  async updateCategory(id: string, name: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
      
      if (error) throw error
      
      // 清除缓存
      cacheService.clearByPrefix('categories')
      
      return true
    } catch (error) {
      logError('Update category error', 'WebsiteService', error as Error)
      return false
    }
  },

  // 管理功能：删除分类
  async deleteCategory(id: string): Promise<boolean> {
    try {
      // 先把该分类下的书签的分类设为 null
      const { error: updateError } = await supabase
        .from('bookmarks')
        .update({ category_id: null })
        .eq('category_id', id)
      
      if (updateError) throw updateError
      
      // 再删除分类
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      // 清除缓存
      cacheService.clearByPrefix('categories')
      cacheService.clearByPrefix('admin_bookmarks')
      
      return true
    } catch (error) {
      logError('Delete category error', 'WebsiteService', error as Error)
      return false
    }
  }
}