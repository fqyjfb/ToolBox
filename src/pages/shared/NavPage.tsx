import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Star, StarOff, Menu, Globe, ChevronDown, Search } from 'lucide-react'
import CachedIcon from '../../components/ui/CachedIcon'
import { websiteService } from '../../services/WebsiteService'
import { supabase } from '../../services/supabase'
import { useNavSearch } from '../../contexts/NavSearchContext'
import { openUrl } from '../../services/browserService'
import './NavPage.css'

// 类型定义
export interface Category {
  id: string
  name: string
  parent_id: string | null
  order?: number
  children: Category[]
  created_at?: string
  updated_at?: string
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
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  
  const [activeMainCategoryId, setActiveMainCategoryId] = useState<string | null>(null)
  const activeMainCategoryIdRef = useRef(activeMainCategoryId)
  useEffect(() => {
    activeMainCategoryIdRef.current = activeMainCategoryId
  }, [activeMainCategoryId])
  
  const [activeSubCategoryIds, setActiveSubCategoryIds] = useState<Record<string, string>>({})
  const [activeFavorites, setActiveFavorites] = useState(false)
  
  const [showFavorites, setShowFavorites] = useState(false)
  const [favorites, setFavorites] = useState<Bookmark[]>([])
  
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hoveredBookmark, setHoveredBookmark] = useState<{ id: string; x: number; y: number } | null>(null)
  const [showMoreCategories, setShowMoreCategories] = useState(false)
  const [overflowCategories, setOverflowCategories] = useState<Category[]>([])
  const [showMoreSubCategories, setShowMoreSubCategories] = useState(false)
  const [overflowSubCategories, setOverflowSubCategories] = useState<Category[]>([])
  
  const [categoryDropdownPosition, setCategoryDropdownPosition] = useState<{ left: number; top: number } | null>(null)
  const [subCategoryDropdownPosition, setSubCategoryDropdownPosition] = useState<{ left: number; top: number } | null>(null)
  
  const { searchQuery, isSearchActive } = useNavSearch()
  
  const contentRef = useRef<HTMLDivElement>(null)
  const categoriesContainerRef = useRef<HTMLDivElement>(null)
  const dropdownButtonRef = useRef<HTMLButtonElement>(null)
  const subCategoriesContainerRef = useRef<HTMLDivElement>(null)
  const subCategoryDropdownButtonRef = useRef<HTMLButtonElement>(null)
  
  const isAuthenticatedRef = useRef<{ value: boolean; timestamp: number } | null>(null)

  // 检查用户是否登录
  const isAuthenticated = useCallback(async () => {
    const authCache = isAuthenticatedRef.current
    const cacheExpiry = 5 * 60 * 1000
    if (authCache && (Date.now() - authCache.timestamp) < cacheExpiry) {
      return authCache.value
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      isAuthenticatedRef.current = { value: !!user, timestamp: Date.now() }
      return !!user
    } catch {
      isAuthenticatedRef.current = { value: false, timestamp: Date.now() }
      return false
    }
  }, [])

  // 加载用户收藏状态
  const loadUserFavorites = useCallback(async (cachedCategories?: Category[]) => {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return []
    }
    
    try {
      const favorites = await websiteService.getFavorites({ cachedCategories })
      return favorites
    } catch {
      return []
    }
  }, [isAuthenticated])

  // 使用 React Query 获取分类数据
  const { data: categories, isError: categoriesError, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['website_categories'],
    queryFn: () => websiteService.getCategories(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  })

  // 使用 React Query 获取书签数据
  const { data: bookmarksData, isError: bookmarksError, isLoading: isBookmarksLoading } = useQuery({
    queryKey: ['website_bookmarks'],
    queryFn: () => websiteService.getPublicBookmarks(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  })

  // 构建分类树
  const categoriesTree = useMemo(() => {
    if (!categories || categories.length === 0) return []
    return websiteService.buildCategoryTree(categories)
  }, [categories])

  // 加载数据并合并收藏状态
  useEffect(() => {
    if (!categories || !bookmarksData || categories.length === 0 || bookmarksData.length === 0) return
    
    if (categoriesTree.length > 0) {
      const firstCatId = categoriesTree[0].id
      setActiveSubCategoryIds({ [firstCatId]: 'all' })
      setActiveMainCategoryId(firstCatId)
    }
    
    loadUserFavorites(categories).then(userFavorites => {
      const favoriteIds = userFavorites.map(f => f.id)
      const bookmarksWithFavorites = bookmarksData.map(bookmark => ({
        ...bookmark,
        is_favorite: favoriteIds.includes(bookmark.id)
      }))
      setBookmarks(bookmarksWithFavorites)
    })
  }, [categories, bookmarksData, categoriesTree, loadUserFavorites])

  // 处理查询错误
  useEffect(() => {
    if (categoriesError || bookmarksError) {
      setHasError(true)
      setErrorMessage('数据加载过程中遇到问题，部分内容可能无法显示')
    }
  }, [categoriesError, bookmarksError])

  // 检测分类导航是否超出可视宽度
  useEffect(() => {
    if (categoriesTree.length === 0) return
    
    const checkOverflow = () => {
      if (categoriesContainerRef.current) {
        const container = categoriesContainerRef.current
        const containerWidth = container.offsetWidth
        
        const avgCategoryWidth = 80
        const favoritesWidth = 80
        const dropdownWidth = 40
        const availableWidth = containerWidth - favoritesWidth - dropdownWidth
        const maxVisibleCategories = Math.max(0, Math.floor(availableWidth / avgCategoryWidth))
        
        const overflow = categoriesTree.slice(maxVisibleCategories)
        
        setOverflowCategories(overflow)
      }
    }

    checkOverflow()
    
    const resizeObserver = new ResizeObserver(checkOverflow)
    if (categoriesContainerRef.current) {
      resizeObserver.observe(categoriesContainerRef.current)
    }
    
    window.addEventListener('resize', checkOverflow)
    
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', checkOverflow)
    }
  }, [categoriesTree])

  // 获取子分类 - 使用useMemo缓存
  const getSubCategories = useCallback((mainCategoryId: string) => {
    const mainCategory = categoriesTree.find(category => category.id === mainCategoryId)
    const subCategories = mainCategory?.children || []
    return [{ id: 'all', name: '全部', children: [], parent_id: null, order: 0, created_at: '', updated_at: '' }, ...subCategories]
  }, [categoriesTree])

  // 检测子分类导航是否超出可视宽度
  useEffect(() => {
    if (!activeMainCategoryId) return
    
    const checkSubCategoryOverflow = () => {
      if (subCategoriesContainerRef.current) {
        const container = subCategoriesContainerRef.current
        const containerWidth = container.offsetWidth
        
        const avgSubCategoryWidth = 65
        const dropdownWidth = 36
        const availableWidth = containerWidth - dropdownWidth
        const maxVisibleSubCategories = Math.max(1, Math.floor(availableWidth / avgSubCategoryWidth))
        
        const subCategories = getSubCategories(activeMainCategoryId)
        const overflow = subCategories.slice(maxVisibleSubCategories)
        
        setOverflowSubCategories(overflow)
      }
    }

    checkSubCategoryOverflow()
    
    const resizeObserver = new ResizeObserver(checkSubCategoryOverflow)
    if (subCategoriesContainerRef.current) {
      resizeObserver.observe(subCategoriesContainerRef.current)
    }
    
    window.addEventListener('resize', checkSubCategoryOverflow)
    
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', checkSubCategoryOverflow)
    }
  }, [activeMainCategoryId, categoriesTree, getSubCategories])

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

  // 获取分类下的书签 - 使用useMemo缓存每个分类的结果
  const bookmarksByCategory = useMemo(() => {
    const map = new Map<string, Bookmark[]>()
    bookmarks.forEach(bookmark => {
      const existing = map.get(bookmark.category_id) || []
      existing.push(bookmark)
      map.set(bookmark.category_id, existing)
    })
    return map
  }, [bookmarks])

  const getCategoryBookmarks = useCallback((mainCategoryId: string) => {
    const mainCategory = categoriesTree.find(category => category.id === mainCategoryId)
    if (!mainCategory) return []
    
    const activeSubCategoryId = getActiveSubCategoryId(mainCategoryId)
    const categoryIds = getCategoryIds(mainCategory)
    
    if (activeSubCategoryId === 'all') {
      const result: Bookmark[] = []
      categoryIds.forEach(id => {
        const categoryBookmarks = bookmarksByCategory.get(id) || []
        result.push(...categoryBookmarks)
      })
      return result
    } else {
      return bookmarksByCategory.get(activeSubCategoryId) || []
    }
  }, [categoriesTree, bookmarksByCategory, getActiveSubCategoryId, getCategoryIds])

  // 预计算所有书签的映射表，用于hover提示查找
  const allBookmarksMap = useMemo(() => {
    const map = new Map<string, Bookmark>()
    bookmarks.forEach(b => map.set(b.id, b))
    favorites.forEach(b => map.set(b.id, b))
    return map
  }, [bookmarks, favorites])

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
      try {
        const userFavorites = await loadUserFavorites(categoriesTree.flatMap(cat => [cat, ...cat.children]))
        setFavorites(userFavorites)
      } catch {
        setFavorites([])
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
      } catch {
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
  const throttle = <T extends (...args: unknown[]) => void>(func: T, delay: number) => {
    let inThrottle = false
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => {
          inThrottle = false
        }, delay)
      }
    }
  }

  // 处理滚动事件 - 使用节流优化
  const handleScroll = useMemo(() => {
    const handleScrollFn = () => {
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
      
      if (currentVisibleCategoryId && currentVisibleCategoryId !== activeMainCategoryIdRef.current) {
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
    };
    
    return throttle(handleScrollFn, 100)
  }, []);

  useEffect(() => {
    const contentElement = contentRef.current
    if (contentElement) {
      contentElement.addEventListener('scroll', handleScroll)
      return () => contentElement.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  // 计算分类下拉菜单位置
  useEffect(() => {
    if (showMoreCategories && dropdownButtonRef.current) {
      const buttonRect = dropdownButtonRef.current.getBoundingClientRect()
      const pageRect = document.querySelector('.homenav-page')?.getBoundingClientRect()
      setCategoryDropdownPosition({
        left: buttonRect.left - (pageRect?.left || 0),
        top: buttonRect.bottom - (pageRect?.top || 0)
      })
    } else {
      setCategoryDropdownPosition(null)
    }
  }, [showMoreCategories])

  // 计算子分类下拉菜单位置
  useEffect(() => {
    if (showMoreSubCategories && subCategoryDropdownButtonRef.current) {
      const buttonRect = subCategoryDropdownButtonRef.current.getBoundingClientRect()
      const pageRect = document.querySelector('.homenav-page')?.getBoundingClientRect()
      setSubCategoryDropdownPosition({
        left: buttonRect.left - (pageRect?.left || 0),
        top: buttonRect.bottom - (pageRect?.top || 0)
      })
    } else {
      setSubCategoryDropdownPosition(null)
    }
  }, [showMoreSubCategories])

  if (hasError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{errorMessage}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          重试
        </button>
      </div>
    )
  }

  if (isCategoriesLoading || isBookmarksLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
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
      {showMoreCategories && categoryDropdownPosition && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowMoreCategories(false)}
          />
          <div 
            className="absolute bg-white dark:bg-gray-800 shadow-lg rounded-lg py-1 z-50 min-w-dropdown-lg"
            style={{ left: `${categoryDropdownPosition.left - 130}px`, top: `${categoryDropdownPosition.top + 4}px` }}
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
      )}

      {/* 子分类下拉菜单 - 放在容器外部避免被遮挡 */}
      {showMoreSubCategories && subCategoryDropdownPosition && activeMainCategoryId && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowMoreSubCategories(false)}
          />
          <div 
            className="absolute bg-white dark:bg-gray-800 shadow-lg rounded-lg py-1 z-50 min-w-dropdown"
            style={{ left: `${subCategoryDropdownPosition.left - 80}px`, top: `${subCategoryDropdownPosition.top + 4}px` }}
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
      )}

      
      {/* 内容区域 */}
      <div className="content">
        <div>
          {/* 搜索结果 - 搜索激活时优先显示 */}
          {isSearchActive && searchResults.length > 0 ? (
            <div className="search-results-container">
              <div className="search-section-header flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="search-icon-wrapper">
                    <Search className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">搜索结果</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">找到了 {searchResults.length} 个与 "{searchQuery}" 相关的网址</p>
                  </div>
                </div>

              </div>
              
              <div className="search-results-grid grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {searchResults.map((bookmark, index) => (
                  <div
                    key={bookmark.id}
                    className="bookmark-card-wrapper search-result-card"
                    style={{ animationDelay: `${index * 50}ms` }}
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
                      className="bookmark-card search-highlight"
                      onClick={() => navigateToBookmark(bookmark.url)}
                    >
                      <div className="card-content">
                        <div className="icon-category-container">
                          {bookmark.ico_url ? (
                            <CachedIcon
                              src={bookmark.ico_url || null}
                              alt={bookmark.title}
                              className="bookmark-icon"
                              defaultIcon={
                                <div className="bookmark-icon flex items-center justify-center">
                                  <Globe className="w-4 h-4 text-gray-500" />
                                </div>
                              }
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
          ) : searchResults.length === 0 && isSearchActive ? (
            <div className="search-empty-state">
              <div className="empty-icon">
                <Search className="w-12 h-12 text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mt-4">未找到相关结果</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">试试其他关键词或浏览分类发现更多网址</p>
            </div>
          ) : (
            <>
              {/* 我的收藏内容 */}
              {activeFavorites && (
                <div>
                  {favorites.length > 0 ? (
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
                                    <CachedIcon
                                      src={bookmark.ico_url || null}
                                      alt={bookmark.title}
                                      className="bookmark-icon"
                                      defaultIcon={
                                        <div className="bookmark-icon flex items-center justify-center">
                                          <Globe className="w-4 h-4 text-gray-500" />
                                        </div>
                                      }
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
                                  <CachedIcon
                                    src={bookmark.ico_url || null}
                                    alt={bookmark.title}
                                    className="bookmark-icon"
                                    defaultIcon={
                                      <div className="bookmark-icon flex items-center justify-center">
                                        <Globe className="w-4 h-4 text-gray-500" />
                                      </div>
                                    }
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
            </>
          )}
        </div>
      </div>
      
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
        const bookmark = allBookmarksMap.get(hoveredBookmark.id)
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