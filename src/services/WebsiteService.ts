import { supabase } from './supabase'
import type { Category, Bookmark } from '../types/website'

// 简单的缓存实现
class CacheService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
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

  set(key: string, data: any) {
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

export const websiteService = {
  // 分类相关
  async getCategories(options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<Category[]> {
    const cacheKey = 'categories_all'
    
    // 检查缓存
    if (!options?.forceRefresh) {
      const cachedData = cacheService.get<Category[]>(cacheKey)
      if (cachedData) {
        console.log('Using cached categories data')
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
        console.error('获取分类失败:', error)
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
      console.error('获取分类失败:', error)
      return []
    }
  },

  async getCategoryById(id: string): Promise<Category | null> {
    const cacheKey = `category_${id}`
    
    // 检查缓存
    const cachedData = cacheService.get<Category>(cacheKey)
    if (cachedData) {
      console.log(`Using cached category data for id: ${id}`)
      return cachedData
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) {
        console.error('获取分类失败:', error)
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
      console.error('获取分类失败:', error)
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
        console.log('Using cached public bookmarks data')
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
      console.error('Get public bookmarks error:', error)
      
      // 如果缓存存在，返回缓存数据
      const cachedData = cacheService.get<Bookmark[]>(cacheKey)
      if (cachedData) {
        console.log('Using cached public bookmarks data due to API error')
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
        console.error('用户未登录')
        return false
      }
      
      const { error } = await supabase
        .from('user_favorites')
        .insert({
          user_id: user.id,
          bookmark_id: bookmarkId
        })
      
      if (error) {
        console.error('添加收藏失败:', error)
        return false
      }
      
      // 清除收藏相关缓存
      cacheService.clearByPrefix(`favorites_user_${user.id}`)
      
      return true
    } catch (error) {
      console.error('添加收藏失败:', error)
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
        console.error('用户未登录')
        return []
      }
      
      const cacheKey = `favorites_user_${user.id}`
      
      // 检查缓存
      if (!options?.forceRefresh) {
        const cachedData = cacheService.get<Bookmark[]>(cacheKey)
        if (cachedData) {
          console.log('Using cached favorites data')
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
      console.error('Get favorites error:', error)
      return []
    }
  },

  async checkFavorite(bookmarkId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('用户未登录')
        return false
      }
      
      const { data, error } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('bookmark_id', bookmarkId)
        .eq('user_id', user.id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') { // 未找到记录
          return false
        }
        console.error('检查收藏状态失败:', error)
        return false
      }
      
      return !!data
    } catch (error) {
      console.error('检查收藏状态失败:', error)
      return false
    }
  }
}