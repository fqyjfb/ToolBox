import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Star, StarOff, Menu, ChevronDown, Search } from 'lucide-react'
import CachedIcon from '../../components/ui/CachedIcon'
import { websiteService } from '../../services/WebsiteService'
import { websiteBookmarksQuery, websiteCategoriesQuery } from '../../services/websiteQueries'
import { useNavSearch } from '../../contexts/NavSearchContext'
import { openUrl } from '../../services/browserService'
import { useNavStore } from '../../store/navStore'
import { useAuthStore } from '../../store/AuthStore'
import type { Bookmark, Category } from '../../types/website'
import './NavPage.css'

// 默认书签图标（与首页收藏保持一致，使用 public/网址.png）
const DefaultBookmarkIcon = <img src="./网址.png" alt="" className="w-full h-full object-contain" />

const NavPage: React.FC = () => {
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const {
    activeMainCategoryId,
    activeSubCategoryIds,
    favoritesView,
    favorites,
    favoritesLoaded,
    setActiveMainCategory,
    setActiveSubCategory,
    setFavoritesView,
    setFavorites,
    resetFavorites,
    applyFavorite
  } = useNavStore()

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hoveredBookmark, setHoveredBookmark] = useState<{ id: string; cx: number; top: number; bottom: number } | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null)
  const [showMoreCategories, setShowMoreCategories] = useState(false)
  const [overflowCategories, setOverflowCategories] = useState<Category[]>([])
  const [showMoreSubCategories, setShowMoreSubCategories] = useState(false)
  const [overflowSubCategories, setOverflowSubCategories] = useState<Category[]>([])

  const [categoryDropdownPosition, setCategoryDropdownPosition] = useState<{ left: number; top: number } | null>(null)
  const [subCategoryDropdownPosition, setSubCategoryDropdownPosition] = useState<{ left: number; top: number } | null>(null)

  const { searchQuery, isSearchActive } = useNavSearch()

  const categoriesContainerRef = useRef<HTMLDivElement>(null)
  const dropdownButtonRef = useRef<HTMLButtonElement>(null)
  const subCategoriesContainerRef = useRef<HTMLDivElement>(null)
  const subCategoryDropdownButtonRef = useRef<HTMLButtonElement>(null)

  // 使用 React Query 获取分类数据
  const { data: categories, isError: categoriesError, isLoading: isCategoriesLoading } = useQuery(websiteCategoriesQuery)

  // 使用 React Query 获取书签数据
  const { data: bookmarksData, isError: bookmarksError, isLoading: isBookmarksLoading } = useQuery(websiteBookmarksQuery)

  // 构建分类树
  const categoriesTree = useMemo(() => {
    if (!categories || categories.length === 0) return []
    return websiteService.buildCategoryTree(categories)
  }, [categories])

  // 书签列表直接由缓存数据派生，收藏态只做标记，不阻塞首帧
  const bookmarks = useMemo(() => {
    const favoriteIds = new Set(favorites.map((f) => f.id))
    return (bookmarksData ?? []).map((b) => (favoriteIds.has(b.id) ? { ...b, is_favorite: true } : b))
  }, [bookmarksData, favorites])

  // 仅在未选过分类（或原分类已不存在）时落到第一个分类
  useEffect(() => {
    if (categoriesTree.length === 0) return
    if (activeMainCategoryId !== null && categoriesTree.some((c) => c.id === activeMainCategoryId)) return
    setActiveMainCategory(categoriesTree[0].id)
    setActiveSubCategory(categoriesTree[0].id, 'all')
  }, [categoriesTree, activeMainCategoryId, setActiveMainCategory, setActiveSubCategory])

  // 收藏只在会话内加载一次，切走再切回不重复请求；登出后清空，避免残留上个账号的收藏
  useEffect(() => {
    if (!isAuthenticated) {
      if (favoritesLoaded) resetFavorites()
      return
    }
    if (favoritesLoaded) return
    let alive = true
    websiteService.getFavorites().then((list) => {
      if (alive) setFavorites(list)
    }).catch(() => {
      // 失败也要落定，否则收藏视图会一直停在未就绪的空白态
      if (alive) setFavorites([])
    })
    return () => { alive = false }
  }, [isAuthenticated, favoritesLoaded, setFavorites, resetFavorites])

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
      setFavoritesView(false)
    }
  }, [isSearchActive, setFavoritesView])

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

  const getCategoryBookmarks = useCallback((mainCategoryId: string | null) => {
    if (!mainCategoryId) return []
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

  const visibleBookmarks = useMemo(
    () => getCategoryBookmarks(activeMainCategoryId),
    [getCategoryBookmarks, activeMainCategoryId]
  )

  // 预计算所有书签的映射表，用于hover提示查找
  const allBookmarksMap = useMemo(() => {
    const map = new Map<string, Bookmark>()
    bookmarks.forEach(b => map.set(b.id, b))
    favorites.forEach(b => map.set(b.id, b))
    return map
  }, [bookmarks, favorites])

  // 提示框按卡片位置定位：优先显示在卡片下方，下方空间不足时翻到上方，并夹在视口内
  useLayoutEffect(() => {
    const el = tooltipRef.current
    if (!hoveredBookmark || !el) return
    const GAP = 8
    const MARGIN = 8
    const { width, height } = el.getBoundingClientRect()
    const fitsBelow = hoveredBookmark.bottom + GAP + height + MARGIN <= window.innerHeight
    setTooltipPosition({
      left: Math.min(
        Math.max(hoveredBookmark.cx, width / 2 + MARGIN),
        window.innerWidth - width / 2 - MARGIN
      ),
      top: fitsBelow
        ? hoveredBookmark.bottom + GAP
        : Math.max(MARGIN, hoveredBookmark.top - GAP - height)
    })
  }, [hoveredBookmark])

  // 切换主分类
  const switchMainCategory = (categoryId: string) => {
    setActiveMainCategory(categoryId)
    setActiveSubCategory(categoryId, 'all')
    setFavoritesView(false)
    setShowMoreSubCategories(false)
  }

  // 切换子分类
  const switchSubCategoryForMainCategory = (mainCategoryId: string, subCategoryId: string) => {
    setActiveSubCategory(mainCategoryId, subCategoryId)
    setFavoritesView(false)
  }

  // 处理收藏点击
  const handleFavoriteClick = () => {
    setFavoritesView(!favoritesView)
    setShowMoreSubCategories(false)
    if (favoritesView && activeMainCategoryId === null && categoriesTree.length > 0) {
      setActiveMainCategory(categoriesTree[0].id)
    }
  }

  // 处理收藏状态变更
  const handleFavoriteChange = async (bookmarkId: string, isFavorite: boolean) => {
    const target = (bookmarksData ?? []).find(b => b.id === bookmarkId)
    const apply = (on: boolean) => applyFavorite(bookmarkId, target, on)

    apply(isFavorite)
    const ok = await (isFavorite
      ? websiteService.addFavorite(bookmarkId)
      : websiteService.removeFavorite(bookmarkId)
    ).catch(() => false)
    if (!ok) apply(!isFavorite)
  }



  // 导航到书签
  const navigateToBookmark = (url: string) => {
    if (url) {
      openUrl(url)
    }
  }

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
          className="px-4 py-2 bg-primary text-button-text rounded-md hover:bg-primary-hover transition-colors"
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

  // 渲染书签卡片（搜索结果/收藏/分类共用）
  const renderBookmarkCard = (bookmark: Bookmark, isSearchResult = false, index = 0) => (
    <div
      key={bookmark.id}
      className={`bookmark-card-wrapper${isSearchResult ? ' search-result-card' : ''}`}
      style={isSearchResult ? { animationDelay: `${index * 50}ms` } : undefined}
      onMouseEnter={(e) => {
        if (!bookmark.description) return
        const rect = e.currentTarget.getBoundingClientRect()
        setHoveredBookmark({
          id: bookmark.id,
          cx: rect.left + rect.width / 2,
          top: rect.top,
          bottom: rect.bottom
        })
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
                    {DefaultBookmarkIcon}
                  </div>
                }
              />
            ) : (
              <div className="bookmark-icon flex items-center justify-center">
                {DefaultBookmarkIcon}
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
  )

  const hoveredBookmarkInfo = hoveredBookmark ? allBookmarksMap.get(hoveredBookmark.id) : undefined

  return (
    <div className="homenav-page flex flex-col h-full overflow-hidden">
      {/* 收藏夹效果导航 */}

        <div className="nav-container">
          <div className="radio-inputs" ref={categoriesContainerRef}>
            {/* 我的收藏 */}
            <label className={`radio ${favoritesView ? 'active' : ''}`}>
              <input 
                type="radio" 
                name="category" 
                checked={favoritesView} 
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
                className={`radio ${!favoritesView && activeMainCategoryId === category.id ? 'active' : ''}`}
              >
                <input 
                  type="radio" 
                  name="category" 
                  checked={!favoritesView && activeMainCategoryId === category.id}
                  onChange={() => switchMainCategory(category.id)}
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

          {/* 子分类导航 - 与主分类合并在同一容器 */}
          {!favoritesView && activeMainCategoryId && (
            <div className="subcategory-nav flex flex-wrap gap-2" ref={subCategoriesContainerRef}>
              {getSubCategories(activeMainCategoryId).filter((subCategory) => !overflowSubCategories.some(c => c.id === subCategory.id)).map((subCategory) => (
                <button
                  key={subCategory.id}
                  onClick={() => switchSubCategoryForMainCategory(activeMainCategoryId, subCategory.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                    getActiveSubCategoryId(activeMainCategoryId) === subCategory.id
                      ? 'bg-gray-800/60 text-white dark:bg-white/60 dark:text-gray-800 shadow-sm backdrop-blur-sm'
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
          )}

          {/* 收藏分类子分类导航 - 与普通分类保持同一位置 */}
          {favoritesView && (
            <div className="subcategory-nav flex flex-wrap gap-2">
              <button
                className="px-3 py-1 rounded-full text-xs font-medium bg-gray-800/60 text-white dark:bg-white/60 dark:text-gray-800 shadow-sm backdrop-blur-sm"
              >
                全部收藏
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
            style={{ left: `${categoryDropdownPosition.left}px`, top: `${categoryDropdownPosition.top + 4}px` }}
          >
            {overflowCategories.map((category) => (
              <button
                key={category.id}
                className={`block w-full text-left px-4 py-2 text-sm ${!favoritesView && activeMainCategoryId === category.id ? 'bg-gray-100 dark:bg-gray-700 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  switchMainCategory(category.id)
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
            style={{ left: `${subCategoryDropdownPosition.left}px`, top: `${subCategoryDropdownPosition.top + 4}px` }}
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
                {searchResults.map((bookmark, index) => renderBookmarkCard(bookmark, true, index))}
              </div>
            </div>
          ) : searchResults.length === 0 && isSearchActive && bookmarksData !== undefined ? (
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
              {favoritesView && (
                <div>
                  {isAuthenticated && !favoritesLoaded ? null : favorites.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-3">
                      {favorites.map((bookmark) => renderBookmarkCard(bookmark))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg">
                      <p className="text-gray-500 dark:text-gray-400">暂无收藏</p>
                      <button
                        onClick={() => setFavoritesView(false)}
                        className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                      >
                        去发现更多
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* 分类内容 */}
              {!favoritesView && activeMainCategoryId && (
                <div>
                  {bookmarksData === undefined ? null : visibleBookmarks.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-3">
                      {visibleBookmarks.map((bookmark) => renderBookmarkCard(bookmark))}
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
                  favoritesView
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
      
      {/* 卡片描述悬浮提示框：portal 到 body，避免被祖先的 transform / overflow 劫持定位与裁剪 */}
      {hoveredBookmark && hoveredBookmarkInfo?.description && createPortal(
        <div
          ref={tooltipRef}
          className="bookmark-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPosition?.left ?? 0,
            top: tooltipPosition?.top ?? 0,
            transform: 'translateX(-50%)',
            visibility: tooltipPosition ? 'visible' : 'hidden',
            zIndex: 9999
          }}
        >
          <div className="tooltip-content">{hoveredBookmarkInfo.description}</div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default NavPage