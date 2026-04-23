import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Star, StarOff, Menu, Globe, ChevronDown } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { websiteService } from '../services/WebsiteService'
import { supabase } from '../services/supabase'
import { useNavSearch } from '../contexts/NavSearchContext'
import { openUrl } from '../services/browserService'
import './NavPage.css'

// 检测是否为国外域名
const isForeignDomain = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    // 常见的国内域名后缀
    const domesticDomains = [
      '.cn', '.com.cn', '.net.cn', '.org.cn', '.gov.cn', '.edu.cn',
      '.hk', '.macau', '.tw'
    ]
    // 检查是否包含国内域名后缀
    return !domesticDomains.some(suffix => hostname.endsWith(suffix))
  } catch {
    return true
  }
}

// 默认图标路径，使用相对路径以支持 Electron 打包环境
const defaultIconPath = './网址.png'

// 图片代理函数，用于解决部分图片无法加载的问题
const proxyImageUrl = (url: string): string => {
  const raw = (url || '').trim()
  if (!raw) return defaultIconPath
  // 允许 data/blob URLs
  if (/^(data|blob):/i.test(raw)) return raw
  // 对于国外域名的图片，直接使用国内代理服务
  if (isForeignDomain(raw)) {
    try {
      return `https://images.weserv.nl/?url=${encodeURIComponent(raw)}`
    } catch {
      return defaultIconPath
    }
  }
  // 国内域名的图片直接加载
  return raw
}

// 增强的图片错误处理函数
const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, originalUrl: string) => {
  const target = e.target as HTMLImageElement
  // 如果当前是原始URL，则尝试通过代理服务加载
  if (target.src === originalUrl) {
    try {
      // 尝试使用国内可用的图片代理服务
      const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(originalUrl)}`
      target.src = proxyUrl
    } catch {
      try {
        // 备选：使用 duckduckgo 图片代理服务
        target.src = `https://proxy.duckduckgo.com/iu/?u=${encodeURIComponent(originalUrl)}`
      } catch {
        target.src = defaultIconPath
      }
    }
  } else if (target.src.includes('images.weserv.nl')) {
    // 如果国内代理失败，尝试使用 duckduckgo 代理
    try {
      target.src = `https://proxy.duckduckgo.com/iu/?u=${encodeURIComponent(originalUrl)}`
    } catch {
      target.src = defaultIconPath
    }
  } else {
    // 如果所有代理都失败，则使用默认图标
    target.src = defaultIconPath
  }
}

// 类型定义
export interface Category {
  id: string
  name: string
  parent_id: string | null
  order: number
  children: Category[]
  created_at: string
  updated_at: string
}

export interface Bookmark {
  id: string
  title: string
  url: string
  description: string
  category_id: string
  user_id: string | null
  is_public: boolean
  is_favorite: boolean
  order: number
  created_at: string
  updated_at: string
  ico_url?: string
  category?: Category
}



const NavPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  
  const [activeMainCategoryId, setActiveMainCategoryId] = useState<string | null>(null)
  const [activeSubCategoryIds, setActiveSubCategoryIds] = useState<Record<string, string>>({})
  const [activeFavorites, setActiveFavorites] = useState(false)
  
  const [showFavorites, setShowFavorites] = useState(false)
  const [favorites, setFavorites] = useState<Bookmark[]>([])
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false)
  
  const [categoriesTree, setCategoriesTree] = useState<Category[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hoveredBookmark, setHoveredBookmark] = useState<{ id: string; x: number; y: number } | null>(null)
  const [showMoreCategories, setShowMoreCategories] = useState(false)
  const [overflowCategories, setOverflowCategories] = useState<Category[]>([])
  const [showMoreSubCategories, setShowMoreSubCategories] = useState(false)
  const [overflowSubCategories, setOverflowSubCategories] = useState<Category[]>([])
  
  const { searchQuery, isSearchActive } = useNavSearch()
  
  const contentRef = useRef<HTMLDivElement>(null)
  const categoriesContainerRef = useRef<HTMLDivElement>(null)
  const dropdownButtonRef = useRef<HTMLButtonElement>(null)
  const subCategoriesContainerRef = useRef<HTMLDivElement>(null)
  const subCategoryDropdownButtonRef = useRef<HTMLButtonElement>(null)

  // 检查用户是否登录
  const isAuthenticated = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      return !!user
    } catch (error) {
      return false
    }
  }

  // 加载用户收藏状态
  const loadUserFavorites = async (cachedCategories?: Category[]) => {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return []
    }
    
    try {
      const favorites = await websiteService.getFavorites({ cachedCategories })
      return favorites
    } catch (error) {
      return []
    }
  }

  // 缓存数据
  const [cache, setCache] = useState({
    categories: null as Category[] | null,
    bookmarks: null as Bookmark[] | null,
    lastLoaded: 0
  })

  // 加载数据
  const loadData = useCallback(async () => {
    const now = Date.now()
    const cacheExpiry = 5 * 60 * 1000 // 5分钟缓存
    
    // 检查缓存是否有效
    if (cache.categories && cache.bookmarks && (now - cache.lastLoaded) < cacheExpiry) {
      // 使用缓存数据
      setCategoriesTree(websiteService.buildCategoryTree(cache.categories))
      setBookmarks(cache.bookmarks)
      
      // 只在首次加载时设置默认分类
      setActiveMainCategoryId(prev => {
        if (!prev && cache.categories && cache.categories.length > 0) {
          setActiveSubCategoryIds({
            [cache.categories[0].id]: 'all'
          })
          return cache.categories[0].id
        }
        return prev
      })
      return
    }
    
    setIsLoading(true)
    setHasError(false)
    setErrorMessage('')
    
    try {
      // 先获取分类数据
      const categories = await websiteService.getCategories()
      
      // 并行获取其他数据，传递分类数据给收藏加载函数
      const [bookmarksData, userFavorites] = await Promise.all([
        websiteService.getPublicBookmarks(),
        loadUserFavorites(categories)
      ])
      
      // 构建收藏ID集合
      const favoriteIds = userFavorites.map(f => f.id)
      
      // 应用收藏状态到书签数据
      const bookmarksWithFavorites = bookmarksData.map(bookmark => ({
        ...bookmark,
        is_favorite: favoriteIds.includes(bookmark.id)
      }))
      
      const categoriesTreeData = websiteService.buildCategoryTree(categories)
      setCategoriesTree(categoriesTreeData)
      setBookmarks(bookmarksWithFavorites)
      
      // 更新缓存
      setCache({
        categories,
        bookmarks: bookmarksWithFavorites,
        lastLoaded: now
      })
      
      // 只在首次加载时设置默认分类
      setActiveMainCategoryId(prev => {
        if (!prev && categoriesTreeData.length > 0) {
          setActiveSubCategoryIds({
            [categoriesTreeData[0].id]: 'all'
          })
          return categoriesTreeData[0].id
        }
        return prev
      })
    } catch (error: any) {
      setHasError(true)
      setErrorMessage('数据加载过程中遇到问题，部分内容可能无法显示: ' + (error.message || ''))
    } finally {
      setIsLoading(false)
    }
  }, [cache])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 检测分类导航是否超出可视宽度
  useEffect(() => {
    if (categoriesTree.length === 0) return
    
    const checkOverflow = () => {
      if (categoriesContainerRef.current) {
        const container = categoriesContainerRef.current
        const containerWidth = container.offsetWidth
        
        // 假设每个分类的平均宽度（包含padding）
        const avgCategoryWidth = 80 // 平均每个分类约80px宽
        
        // 计算可显示的分类数量
        const favoritesWidth = 80 // "我的收藏"分类的宽度
        const dropdownWidth = 40 // 下拉按钮宽度
        const availableWidth = containerWidth - favoritesWidth - dropdownWidth
        const maxVisibleCategories = Math.max(0, Math.floor(availableWidth / avgCategoryWidth))
        
        // 计算溢出的分类
        const overflow = categoriesTree.slice(maxVisibleCategories)
        
        setOverflowCategories(overflow)
      }
    }

    // 使用 setTimeout 确保 DOM 已渲染完成
    setTimeout(checkOverflow, 100)
    
    // 窗口大小变化时重新检测
    window.addEventListener('resize', checkOverflow)
    
    return () => {
      window.removeEventListener('resize', checkOverflow)
    }
  }, [categoriesTree])

  // 检测子分类导航是否超出可视宽度
  useEffect(() => {
    if (!activeMainCategoryId) return
    
    const checkSubCategoryOverflow = () => {
      if (subCategoriesContainerRef.current) {
        const container = subCategoriesContainerRef.current
        const containerWidth = container.offsetWidth
        
        // 假设每个子分类的平均宽度（包含padding）
        const avgSubCategoryWidth = 65 // 平均每个子分类约65px宽
        const dropdownWidth = 36 // 下拉按钮宽度
        const availableWidth = containerWidth - dropdownWidth
        const maxVisibleSubCategories = Math.max(1, Math.floor(availableWidth / avgSubCategoryWidth))
        
        const subCategories = getSubCategories(activeMainCategoryId)
        const overflow = subCategories.slice(maxVisibleSubCategories)
        
        setOverflowSubCategories(overflow)
      }
    }

    setTimeout(checkSubCategoryOverflow, 100)
    
    window.addEventListener('resize', checkSubCategoryOverflow)
    
    return () => {
      window.removeEventListener('resize', checkSubCategoryOverflow)
    }
  }, [activeMainCategoryId, categoriesTree])

  // 处理搜索 - 使用useMemo缓存搜索结果
  const searchResults = useMemo(() => {
    if (isSearchActive && searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase()
      
      return bookmarks.filter(bookmark => {
        const matchesTitle = bookmark.title?.toLowerCase().includes(lowerQuery) || false
        const matchesDescription = bookmark.description?.toLowerCase().includes(lowerQuery) || false
        const matchesUrl = bookmark.url?.toLowerCase().includes(lowerQuery) || false
        
        return matchesTitle || matchesDescription || matchesUrl
      })
    }
    return []
  }, [searchQuery, isSearchActive, bookmarks])

  // 当搜索激活时，确保显示搜索结果而不是收藏
  useEffect(() => {
    if (isSearchActive) {
      setShowFavorites(false)
      setActiveFavorites(false)
    }
  }, [isSearchActive])

  // 获取子分类 - 使用useMemo缓存
  const getSubCategories = useCallback((mainCategoryId: string) => {
    const mainCategory = categoriesTree.find(category => category.id === mainCategoryId)
    const subCategories = mainCategory?.children || []
    return [{ id: 'all', name: '全部', children: [], parent_id: null, order: 0, created_at: '', updated_at: '' }, ...subCategories]
  }, [categoriesTree])

  // 获取当前激活的子分类ID
  const getActiveSubCategoryId = useCallback((mainCategoryId: string) => {
    return activeSubCategoryIds[mainCategoryId] || 'all'
  }, [activeSubCategoryIds])

  // 获取分类下的所有ID
  const getCategoryIds = useCallback((category: Category): string[] => {
    const ids: string[] = [category.id]
    
    if (category.children && category.children.length > 0) {
      category.children.forEach(child => {
        ids.push(...getCategoryIds(child))
      })
    }
    
    return ids
  }, [])

  // 获取分类下的书签 - 使用useCallback缓存
  const getCategoryBookmarks = useCallback((mainCategoryId: string) => {
    const mainCategory = categoriesTree.find(category => category.id === mainCategoryId)
    if (!mainCategory) return []
    
    const activeSubCategoryId = getActiveSubCategoryId(mainCategoryId)
    const categoryIds = getCategoryIds(mainCategory)
    
    if (activeSubCategoryId === 'all') {
      return bookmarks.filter(bookmark => categoryIds.includes(bookmark.category_id))
    } else {
      return bookmarks.filter(bookmark => bookmark.category_id === activeSubCategoryId)
    }
  }, [categoriesTree, bookmarks, getActiveSubCategoryId, getCategoryIds])

  // 切换主分类
  const switchMainCategory = (categoryId: string) => {
    setActiveMainCategoryId(categoryId)
    setActiveSubCategoryIds(prev => ({
      ...prev,
      [categoryId]: 'all'
    }))
    setShowFavorites(false)
    setActiveFavorites(false)
    setShowMoreSubCategories(false)
    
    setTimeout(() => {
      const element = document.getElementById(`category-${categoryId}`)
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        })
      }
    }, 100)
  }

  // 切换子分类
  const switchSubCategoryForMainCategory = (mainCategoryId: string, subCategoryId: string) => {
    setActiveSubCategoryIds(prev => ({
      ...prev,
      [mainCategoryId]: subCategoryId
    }))
    setShowFavorites(false)
    setActiveFavorites(false)
  }

  // 处理收藏点击
  const handleFavoriteClick = async () => {
    setShowFavorites(!showFavorites)
    setActiveFavorites(!showFavorites)
    setShowMoreSubCategories(false)
    
    if (!showFavorites) {
      setActiveMainCategoryId(null)
      // 加载用户收藏
      setIsLoadingFavorites(true)
      try {
        // 使用已有的分类数据，避免重复请求
        const userFavorites = await loadUserFavorites(categoriesTree.flatMap(cat => [cat, ...cat.children]))
        setFavorites(userFavorites)
      } catch (error) {
        setFavorites([])
      } finally {
        setIsLoadingFavorites(false)
      }
    } else {
      if (!activeMainCategoryId && categoriesTree.length > 0) {
        setActiveMainCategoryId(categoriesTree[0].id)
        setActiveSubCategoryIds(prev => ({
          ...prev,
          [categoriesTree[0].id]: 'all'
        }))
      }
    }
  }

  // 处理收藏状态变更
  const handleFavoriteChange = async (bookmarkId: string, isFavorite: boolean) => {
    // 先更新本地状态，提供即时反馈
    const updatedBookmarks = bookmarks.map(bookmark => 
      bookmark.id === bookmarkId ? { ...bookmark, is_favorite: isFavorite } : bookmark
    )
    setBookmarks(updatedBookmarks)
    
    // 如果显示收藏页面，同时更新收藏列表
    if (showFavorites) {
      setFavorites(prev => isFavorite 
        ? [...prev, bookmarks.find(b => b.id === bookmarkId)!]
        : prev.filter(b => b.id !== bookmarkId)
      )
    }
    
    // 调用API更新服务器端收藏状态
    const authenticated = await isAuthenticated()
    
    if (authenticated) {
      try {
        if (isFavorite) {
          await websiteService.addFavorite(bookmarkId)
        } else {
          await websiteService.removeFavorite(bookmarkId)
        }
      } catch (error) {
        // 失败时回滚本地状态
        const rolledBackBookmarks = bookmarks.map(bookmark => 
          bookmark.id === bookmarkId ? { ...bookmark, is_favorite: !isFavorite } : bookmark
        )
        setBookmarks(rolledBackBookmarks)
        
        if (showFavorites) {
          setFavorites(prev => !isFavorite 
            ? [...prev, bookmarks.find(b => b.id === bookmarkId)!]
            : prev.filter(b => b.id !== bookmarkId)
          )
        }
      }
    } else {
      // 未登录时，3秒后回滚本地状态
      setTimeout(() => {
        const rolledBackBookmarks = bookmarks.map(bookmark => 
          bookmark.id === bookmarkId ? { ...bookmark, is_favorite: !isFavorite } : bookmark
        )
        setBookmarks(rolledBackBookmarks)
        
        if (showFavorites) {
          setFavorites(prev => !isFavorite 
            ? [...prev, bookmarks.find(b => b.id === bookmarkId)!]
            : prev.filter(b => b.id !== bookmarkId)
          )
        }
      }, 3000)
    }
  }



  // 导航到书签
  const navigateToBookmark = (url: string) => {
    if (url) {
      openUrl(url)
    }
  }

  // 节流函数
  const throttle = (func: Function, delay: number) => {
    let inThrottle: boolean
    return function(this: any, ...args: any[]) {
      if (!inThrottle) {
        func.apply(this, args)
        inThrottle = true
        setTimeout(() => inThrottle = false, delay)
      }
    }
  }

  // 处理滚动事件 - 使用节流优化
  const handleScroll = useCallback(throttle(() => {
    if (!contentRef.current) return
    
    const categoryHeaders = document.querySelectorAll('.category-section .section-header')
    if (categoryHeaders.length === 0) return
    
    let currentVisibleCategoryId: string | null = null
    let minDistance = Infinity
    
    categoryHeaders.forEach(header => {
      const categoryId = header.querySelector('.section-title')?.id?.replace('category-', '')
      if (!categoryId) return
      
      const rect = header.getBoundingClientRect()
      const contentRect = contentRef.current!.getBoundingClientRect()
      const distanceFromTop = rect.top - contentRect.top
      
      if (distanceFromTop < contentRect.height / 2 && distanceFromTop > -rect.height) {
        if (Math.abs(distanceFromTop) < minDistance) {
          minDistance = Math.abs(distanceFromTop)
          currentVisibleCategoryId = categoryId
        }
      }
    })
    
    if (currentVisibleCategoryId && currentVisibleCategoryId !== activeMainCategoryId) {
      setActiveMainCategoryId(currentVisibleCategoryId)
      setActiveSubCategoryIds(prev => {
        const newState = { ...prev }
        if (typeof currentVisibleCategoryId === 'string') {
          newState[currentVisibleCategoryId] = 'all'
        }
        return newState
      })
      setShowFavorites(false)
      setActiveFavorites(false)
    }
  }, 100), [activeMainCategoryId])

  useEffect(() => {
    const contentElement = contentRef.current
    if (contentElement) {
      contentElement.addEventListener('scroll', handleScroll)
      return () => contentElement.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{errorMessage}</p>
        <button 
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="homenav-page flex flex-col h-full p-4 overflow-hidden">
      {/* 收藏夹效果导航 */}

        <div className="radio-inputs" ref={categoriesContainerRef}>
          {/* 我的收藏 */}
          <label className={`radio ${activeFavorites ? 'active' : ''}`}>
            <input 
              type="radio" 
              name="category" 
              checked={activeFavorites} 
              onChange={handleFavoriteClick}
            />
            <span className="name">
              <span className="pre-name" />
              <span className="pos-name" />
              <span>收藏</span>
            </span>
          </label>
          
          {/* 分类导航 */}
          {categoriesTree.filter((category) => !overflowCategories.some(c => c.id === category.id)).map((category) => (
            <label 
              key={category.id} 
              className={`radio ${!activeFavorites && activeMainCategoryId === category.id ? 'active' : ''}`}
            >
              <input 
                type="radio" 
                name="category" 
                checked={!activeFavorites && activeMainCategoryId === category.id}
                onChange={() => {
                  switchMainCategory(category.id)
                  setActiveFavorites(false)
                  setShowFavorites(false)
                }}
              />
              <span className="name">
                <span className="pre-name" />
                <span className="pos-name" />
                <span>{category.name}</span>
              </span>
            </label>
          ))}
          
          {/* 下拉按钮 */}
          {overflowCategories.length > 0 && (
            <div className="relative radio">
              <button
                ref={dropdownButtonRef}
                className="name flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMoreCategories(!showMoreCategories)
                }}
              >
                <span>
                  <ChevronDown className="w-4 h-4" />
                </span>
              </button>
            </div>
          )}
        </div>

      {/* 下拉菜单 - 放在容器外部避免被遮挡 */}
      {showMoreCategories && dropdownButtonRef.current && (() => {
        const buttonRect = dropdownButtonRef.current.getBoundingClientRect()
        const pageRect = document.querySelector('.homenav-page')?.getBoundingClientRect()
        const left = buttonRect.left - (pageRect?.left || 0)
        const top = buttonRect.bottom - (pageRect?.top || 0)
        return (
          <>
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setShowMoreCategories(false)}
            />
            <div 
              className="absolute bg-white dark:bg-gray-800 shadow-lg rounded-lg py-1 z-50 min-w-[150px]"
              style={{ left: `${left - 130}px`, top: `${top + 4}px` }}
            >
              {overflowCategories.map((category) => (
                <button
                  key={category.id}
                  className={`block w-full text-left px-4 py-2 text-sm ${!activeFavorites && activeMainCategoryId === category.id ? 'bg-gray-100 dark:bg-gray-700 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    switchMainCategory(category.id)
                    setActiveFavorites(false)
                    setShowFavorites(false)
                    setShowMoreCategories(false)
                  }}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </>
        )
      })()}

      {/* 子分类下拉菜单 - 放在容器外部避免被遮挡 */}
      {showMoreSubCategories && subCategoryDropdownButtonRef.current && activeMainCategoryId && (() => {
        const buttonRect = subCategoryDropdownButtonRef.current.getBoundingClientRect()
        const pageRect = document.querySelector('.homenav-page')?.getBoundingClientRect()
        const left = buttonRect.left - (pageRect?.left || 0)
        const top = buttonRect.bottom - (pageRect?.top || 0)
        return (
          <>
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setShowMoreSubCategories(false)}
            />
            <div 
              className="absolute bg-white dark:bg-gray-800 shadow-lg rounded-lg py-1 z-50 min-w-[120px]"
              style={{ left: `${left - 80}px`, top: `${top + 4}px` }}
            >
              {overflowSubCategories.map((subCategory) => (
                <button
                  key={subCategory.id}
                  className={`block w-full text-left px-4 py-2 text-sm ${getActiveSubCategoryId(activeMainCategoryId) === subCategory.id ? 'bg-gray-100 dark:bg-gray-700 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    switchSubCategoryForMainCategory(activeMainCategoryId, subCategory.id)
                    setShowMoreSubCategories(false)
                  }}
                >
                  {subCategory.name}
                </button>
              ))}
            </div>
          </>
        )
      })()}

      
      {/* 内容区域 */}
      <div className="content">
        <div>
          {/* 我的收藏内容 */}
          {activeFavorites && (
            <div>
              {isLoadingFavorites ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : favorites.length > 0 ? (
                <div>
                  <div className="subcategory-nav flex flex-wrap gap-2 mb-4">
                    <button
                      onClick={() => setShowFavorites(true)}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-gray-800 text-white dark:bg-white dark:text-gray-800 shadow-md backdrop-blur-sm"
                    >
                      全部收藏
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    {favorites.map((bookmark) => (
                      <div
                        key={bookmark.id}
                        className="bookmark-card-wrapper"
                        onMouseEnter={(e) => {
                          if (bookmark.description) {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setHoveredBookmark({ 
                              id: bookmark.id, 
                              x: rect.left + rect.width / 2, 
                              y: rect.bottom + 8 
                            })
                          }
                        }}
                        onMouseLeave={() => setHoveredBookmark(null)}
                      >
                        <div
                          className="bookmark-card"
                          onClick={() => navigateToBookmark(bookmark.url)}
                        >
                          <div className="card-content">
                            <div className="icon-category-container">
                              {bookmark.ico_url ? (
                                <img
                                  src={proxyImageUrl(bookmark.ico_url)}
                                  alt={bookmark.title}
                                  className="bookmark-icon"
                                  onError={(e) => handleImageError(e, bookmark.ico_url || '')}
                                />
                              ) : (
                                <div className="bookmark-icon flex items-center justify-center">
                                  <Globe className="w-4 h-4 text-gray-500" />
                                </div>
                              )}
                              {bookmark.category && (
                                <div className="bookmark-meta">
                                  <span className="category-badge">{bookmark.category.name}</span>
                                </div>
                              )}
                            </div>
                            <div className="bookmark-info">
                              <div className="title-row">
                                <h4 className="bookmark-name">{bookmark.title}</h4>
                                <button
                                  className="favorite-btn active"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleFavoriteChange(bookmark.id, !bookmark.is_favorite)
                                  }}
                                >
                                  <Star className="favorite-icon" />
                                </button>
                              </div>
                              {bookmark.description && (
                                <p className="bookmark-desc">{bookmark.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg">
                  <p className="text-gray-500 dark:text-gray-400">暂无收藏</p>
                  <button
                    onClick={() => setShowFavorites(false)}
                    className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                  >
                    去发现更多
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* 分类内容 */}
          {!activeFavorites && activeMainCategoryId && (
            <div>
              {/* 子分类导航 */}
              <div className="subcategory-nav flex flex-wrap gap-2 mb-4" ref={subCategoriesContainerRef}>
                {getSubCategories(activeMainCategoryId).filter((subCategory) => !overflowSubCategories.some(c => c.id === subCategory.id)).map((subCategory) => (
                  <button
                    key={subCategory.id}
                    onClick={() => switchSubCategoryForMainCategory(activeMainCategoryId, subCategory.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                      getActiveSubCategoryId(activeMainCategoryId) === subCategory.id
                        ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-800 shadow-md backdrop-blur-sm'
                        : 'bg-gray-100/80 text-gray-700 dark:bg-gray-700/80 dark:text-gray-300 hover:bg-gray-200/80 dark:hover:bg-gray-600/80 hover:shadow-sm backdrop-blur-sm'
                    }`}
                  >
                    {subCategory.name}
                  </button>
                ))}
                
                {/* 子分类下拉按钮 */}
                {overflowSubCategories.length > 0 && (
                  <button
                    ref={subCategoryDropdownButtonRef}
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMoreSubCategories(!showMoreSubCategories)
                    }}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100/80 text-gray-700 dark:bg-gray-700/80 dark:text-gray-300 hover:bg-gray-200/80 dark:hover:bg-gray-600/80 hover:shadow-sm backdrop-blur-sm transition-all duration-300 flex items-center gap-1"
                  >
                    <span>更多</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              {/* 网址卡片 */}
              {getCategoryBookmarks(activeMainCategoryId).length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {getCategoryBookmarks(activeMainCategoryId).map((bookmark) => (
                    <div
                      key={bookmark.id}
                      className="bookmark-card-wrapper"
                      onMouseEnter={(e) => {
                        if (bookmark.description) {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setHoveredBookmark({ 
                            id: bookmark.id, 
                            x: rect.left + rect.width / 2, 
                            y: rect.bottom + 8 
                          })
                        }
                      }}
                      onMouseLeave={() => setHoveredBookmark(null)}
                    >
                      <div
                        className="bookmark-card"
                        onClick={() => navigateToBookmark(bookmark.url)}
                      >
                        <div className="card-content">
                          <div className="icon-category-container">
                            {bookmark.ico_url ? (
                              <img
                                src={proxyImageUrl(bookmark.ico_url)}
                                alt={bookmark.title}
                                className="bookmark-icon"
                                onError={(e) => handleImageError(e, bookmark.ico_url || '')}
                              />
                            ) : (
                              <div className="bookmark-icon flex items-center justify-center">
                                <Globe className="w-4 h-4 text-gray-500" />
                              </div>
                            )}
                            {bookmark.category && (
                              <div className="bookmark-meta">
                                <span className="category-badge">{bookmark.category.name}</span>
                              </div>
                            )}
                          </div>
                          <div className="bookmark-info">
                            <div className="title-row">
                              <h4 className="bookmark-name">{bookmark.title}</h4>
                              <button
                                className={`favorite-btn ${bookmark.is_favorite ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleFavoriteChange(bookmark.id, !bookmark.is_favorite)
                                }}
                              >
                                {bookmark.is_favorite ? <Star className="favorite-icon" /> : <StarOff className="favorite-icon" />}
                              </button>
                            </div>
                            {bookmark.description && (
                              <p className="bookmark-desc">{bookmark.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50/80 dark:bg-gray-700/50 backdrop-blur-sm rounded-lg">
                  <p className="text-gray-500">该分类下暂无网址</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* 搜索结果 */}
      {searchResults.length > 0 && (
        <div className="search-section">
          <div className="section-header mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">搜索结果</h2>
            <span className="text-gray-500 dark:text-gray-400">{searchResults.length} 个结果</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {searchResults.map((bookmark) => (
              <div
                key={bookmark.id}
                className="bookmark-card-wrapper"
                onMouseEnter={(e) => {
                  if (bookmark.description) {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setHoveredBookmark({ 
                      id: bookmark.id, 
                      x: rect.left + rect.width / 2, 
                      y: rect.bottom + 8 
                    })
                  }
                }}
                onMouseLeave={() => setHoveredBookmark(null)}
              >
                <div
                  className="bookmark-card"
                  onClick={() => navigateToBookmark(bookmark.url)}
                >
                  <div className="card-content">
                    <div className="icon-category-container">
                      {bookmark.ico_url ? (
                        <img
                          src={proxyImageUrl(bookmark.ico_url)}
                          alt={bookmark.title}
                          className="bookmark-icon"
                          onError={(e) => handleImageError(e, bookmark.ico_url || '')}
                        />
                      ) : (
                        <div className="bookmark-icon flex items-center justify-center">
                          <Globe className="w-4 h-4 text-gray-500" />
                        </div>
                      )}
                      {bookmark.category && (
                        <div className="bookmark-meta">
                          <span className="category-badge">{bookmark.category.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="bookmark-info">
                      <div className="title-row">
                        <h4 className="bookmark-name">{bookmark.title}</h4>
                        <button
                          className={`favorite-btn ${bookmark.is_favorite ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleFavoriteChange(bookmark.id, !bookmark.is_favorite)
                          }}
                        >
                          {bookmark.is_favorite ? <Star className="favorite-icon" /> : <StarOff className="favorite-icon" />}
                        </button>
                      </div>
                      {bookmark.description && (
                        <p className="bookmark-desc">{bookmark.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 移动端分类导航按钮 */}
      <div className="md:hidden p-4 border-b border-gray-200/50 dark:border-gray-700/50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="flex items-center justify-between w-full px-4 py-2 bg-gray-100/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-lg"
        >
          <span>{activeMainCategoryId ? categoriesTree.find(c => c.id === activeMainCategoryId)?.name || '网站分类' : '网站分类'}</span>
          <Menu className="w-5 h-5" />
        </button>
        
        {/* 移动端分类菜单 */}
        {isMobileMenuOpen && (
          <div className="mt-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg shadow-lg">
            <nav className="p-2 space-y-1">
              <button
                onClick={() => {
                  handleFavoriteClick()
                  setIsMobileMenuOpen(false)
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-all duration-300 font-medium ${
                  activeFavorites
                    ? 'bg-[var(--color-favorites-active)] text-white shadow-lg transform scale-105'
                    : 'bg-[var(--color-favorites)] text-white dark:text-[var(--color-favorites-text)] hover:bg-[var(--color-favorites-hover)] hover:shadow-md'
                }`}
              >
                <div className="flex items-center">
                  <span>我的收藏</span>
                </div>
              </button>
              {categoriesTree.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    switchMainCategory(category.id)
                    setIsMobileMenuOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors font-medium ${
                    activeMainCategoryId === category.id
                      ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-800'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span>{category.name}</span>
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>
      
      {/* 卡片描述悬浮提示框 */}
      {hoveredBookmark && (() => {
        const bookmark = [...searchResults, ...favorites, ...categoriesTree.flatMap(c => getCategoryBookmarks(c.id))]
          .find(b => b.id === hoveredBookmark.id)
        if (bookmark?.description) {
          return (
            <div 
              className="bookmark-tooltip"
              style={{
                position: 'fixed',
                left: hoveredBookmark.x,
                top: hoveredBookmark.y,
                transform: 'translateX(-50%)',
                zIndex: 9999
              }}
            >
              <div className="tooltip-content">{bookmark.description}</div>
            </div>
          )
        }
        return null
      })()}
    </div>
  )
}

export default NavPage