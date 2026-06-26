import React, { useState } from 'react'
import { Plus, Edit, Trash2, Search, ExternalLink, X, List, Check, Download, Globe } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/AuthStore'
import { useToastStore } from '../../store/toastStore'
import { Category, Bookmark } from '../../types/website'
import { openUrl } from '../../services/browserService'
import { websiteService, buildCategoryTreeFromData } from '../../services/WebsiteService'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import ContextMenu from '../../components/ui/ContextMenu'
import Switch from '../../components/ui/Switch'
import CategoryManager, { CategoryItem } from '../../components/ui/CategoryManager'
import CachedIcon from '../../components/ui/CachedIcon'

const AdminWebsitesPage: React.FC = () => {
  const { isAuthenticated, getCurrentUser } = useAuthStore()
  const addToast = useToastStore((state) => state.addToast)
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  
  const [isAddBookmarkModalOpen, setIsAddBookmarkModalOpen] = useState(false)
  const [isEditBookmarkModalOpen, setIsEditBookmarkModalOpen] = useState(false)
  const [currentBookmark, setCurrentBookmark] = useState<Bookmark | null>(null)
  const [bookmarkFormData, setBookmarkFormData] = useState({
    title: '',
    url: '',
    description: '',
    category_id: '',
    is_public: true,
    order: 0,
    ico_url: ''
  })
  const [selectedMainCategory, setSelectedMainCategory] = useState('')
  const [selectedSubCategory, setSelectedSubCategory] = useState('')
  const [bookmarkError, setBookmarkError] = useState('')
  const [isFetchingWebsiteInfo, setIsFetchingWebsiteInfo] = useState(false)
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleteType, setDeleteType] = useState<'bookmark' | 'category'>('bookmark')
  const [deleteTargetName, setDeleteTargetName] = useState('')
  
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [contextMenu, setContextMenu] = useState<{ 
    x: number; 
    y: number; 
    type: 'bookmark' | 'category'; 
    targetId?: string;
    targetData?: Bookmark | Category;
  } | null>(null)

  const [activeTab, setActiveTab] = useState<'bookmarks' | 'categories'>('bookmarks')

  const { data: categoriesData = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => websiteService.getCategories()
  })

  const categories = buildCategoryTreeFromData(categoriesData)

  const getAllCategoryIds = (categoryId: string): string[] => {
    const categoryIds: string[] = [categoryId]
    const mainCategory = categories.find(cat => cat.id === categoryId)
    if (mainCategory && mainCategory.children) {
      mainCategory.children.forEach(child => {
        categoryIds.push(child.id)
      })
    }
    return categoryIds
  }

  const { data: bookmarksData, isLoading: bookmarksLoading } = useQuery({
    queryKey: ['admin_bookmarks', page, pageSize, searchQuery, selectedCategoryId],
    queryFn: () => websiteService.getAdminBookmarks({
      page,
      pageSize,
      search: searchQuery || undefined,
      categoryIds: selectedCategoryId ? getAllCategoryIds(selectedCategoryId) : undefined
    })
  })

  const filteredBookmarks = bookmarksData?.data || []
  const total = bookmarksData?.total || 0

  React.useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated) {
        await getCurrentUser()
      }
    }
    checkAuth()
  }, [isAuthenticated, getCurrentUser])

  const addBookmarkMutation = useMutation({
    mutationFn: (bookmark: Omit<Bookmark, 'id' | 'created_at' | 'updated_at'>) => 
      websiteService.addBookmark(bookmark),
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['admin_bookmarks'] })
        addToast({ message: '添加成功', type: 'success' })
        setIsAddBookmarkModalOpen(false)
      }
    },
    onError: () => {
      addToast({ message: '添加失败', type: 'error' })
    }
  })

  const updateBookmarkMutation = useMutation({
    mutationFn: ({ id, bookmark }: { id: string, bookmark: Partial<Bookmark> }) => 
      websiteService.updateBookmark(id, bookmark),
    onSuccess: (success) => {
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['admin_bookmarks'] })
        addToast({ message: '更新成功', type: 'success' })
        setIsEditBookmarkModalOpen(false)
      }
    },
    onError: () => {
      addToast({ message: '更新失败', type: 'error' })
    }
  })

  const deleteBookmarkMutation = useMutation({
    mutationFn: (id: string) => websiteService.deleteBookmark(id),
    onSuccess: (success) => {
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['admin_bookmarks'] })
        addToast({ message: '删除成功', type: 'success' })
      }
    },
    onError: () => {
      addToast({ message: '删除失败', type: 'error' })
    }
  })

  const togglePublicMutation = useMutation({
    mutationFn: ({ id, isPublic }: { id: string, isPublic: boolean }) => 
      websiteService.updateBookmark(id, { is_public: isPublic }),
    onSuccess: (success) => {
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['admin_bookmarks'] })
      }
    }
  })

  const addCategoryMutation = useMutation({
    mutationFn: ({ name, parentId }: { name: string, parentId: string | null }) => 
      websiteService.addCategory(name, parentId),
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['categories'] })
        addToast({ message: '添加分类成功', type: 'success' })
      }
    },
    onError: () => {
      addToast({ message: '添加分类失败', type: 'error' })
    }
  })

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, name }: { id: string, name: string }) => 
      websiteService.updateCategory(id, name),
    onSuccess: (success) => {
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['categories'] })
        addToast({ message: '更新分类成功', type: 'success' })
      }
    },
    onError: () => {
      addToast({ message: '更新分类失败', type: 'error' })
    }
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => websiteService.deleteCategory(id),
    onSuccess: (success) => {
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['categories'] })
        queryClient.invalidateQueries({ queryKey: ['admin_bookmarks'] })
        addToast({ message: '删除分类成功', type: 'success' })
      }
    },
    onError: () => {
      addToast({ message: '删除分类失败', type: 'error' })
    }
  })

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setPage(1)
  }

  const handleSearchSubmit = () => {
    setPage(1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit()
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1)
  }

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId)
    setPage(1)
  }

  const getMainCategories = () => {
    return categories.filter(category => !category.parent_id)
  }

  const getSubCategories = (mainCategoryId: string) => {
    const mainCategory = categories.find(category => category.id === mainCategoryId)
    return mainCategory?.children || []
  }

  const handleMainCategoryChange = (mainCategoryId: string) => {
    setSelectedMainCategory(mainCategoryId)
    const subCategories = getSubCategories(mainCategoryId)
    const firstSubCategory = subCategories[0]
    const subCategoryId = firstSubCategory?.id || ''
    setSelectedSubCategory(subCategoryId)
    setBookmarkFormData(prev => ({
      ...prev,
      category_id: subCategoryId
    }))
  }

  const handleSubCategoryChange = (subCategoryId: string) => {
    setSelectedSubCategory(subCategoryId)
    setBookmarkFormData(prev => ({
      ...prev,
      category_id: subCategoryId
    }))
  }

  const handleAddBookmark = () => {
    setCurrentBookmark(null)
    const mainCategories = getMainCategories()
    const firstMainCategory = mainCategories[0]
    const mainCategoryId = firstMainCategory?.id || ''
    const subCategories = getSubCategories(mainCategoryId)
    const firstSubCategory = subCategories[0]
    const subCategoryId = firstSubCategory?.id || ''
    
    setSelectedMainCategory(mainCategoryId)
    setSelectedSubCategory(subCategoryId)
    setBookmarkFormData({
      title: '',
      url: '',
      description: '',
      category_id: subCategoryId,
      is_public: true,
      order: 0,
      ico_url: ''
    })
    setBookmarkError('')
    setIsAddBookmarkModalOpen(true)
  }

  const handleEditBookmark = (bookmark: Bookmark) => {
    setCurrentBookmark(bookmark)
    setBookmarkFormData({
      title: bookmark.title,
      url: bookmark.url,
      description: bookmark.description,
      category_id: bookmark.category_id,
      is_public: bookmark.is_public,
      order: bookmark.order,
      ico_url: bookmark.ico_url || ''
    })
    
    let mainCategoryId = ''
    let subCategoryId = ''
    
    const findCategory = (cats: Category[]): Category | undefined => {
      for (const category of cats) {
        if (category.id === bookmark.category_id) {
          return category
        }
        if (category.children && category.children.length > 0) {
          const found = findCategory(category.children)
          if (found) {
            mainCategoryId = category.id
            subCategoryId = found.id
            return found
          }
        }
      }
      return undefined
    }
    
    findCategory(categories)
    setSelectedMainCategory(mainCategoryId)
    setSelectedSubCategory(subCategoryId)
    setBookmarkError('')
    setIsEditBookmarkModalOpen(true)
  }

  const handleDeleteBookmark = (bookmarkId: string, bookmarkName: string) => {
    setDeleteTargetId(bookmarkId)
    setDeleteType('bookmark')
    setDeleteTargetName(bookmarkName)
    setIsDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = () => {
    if (!deleteTargetId) return
    
    if (deleteType === 'bookmark') {
      deleteBookmarkMutation.mutate(deleteTargetId)
    } else {
      deleteCategoryMutation.mutate(deleteTargetId)
    }
    
    setIsDeleteConfirmOpen(false)
    setDeleteTargetId(null)
  }

  const handleBookmarkTogglePublic = (bookmarkId: string, currentState: boolean) => {
    togglePublicMutation.mutate({
      id: bookmarkId,
      isPublic: !currentState
    })
    addToast({ 
      message: `书签已${currentState ? '设为私有' : '设为公开'}`, 
      type: 'success' 
    })
  }

  const handleBookmarkInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement
    const { name, value, type } = target
    const newValue = type === 'checkbox' ? (target as HTMLInputElement).checked : value
    
    setBookmarkFormData(prev => ({
      ...prev,
      [name]: newValue
    }))
  }

  const fetchWebsiteInfo = async () => {
    const url = bookmarkFormData.url.trim()
    if (!url) {
      addToast({ message: '请先输入网址', type: 'warning' })
      return
    }

    try {
      new URL(url)
    } catch {
      addToast({ message: '请输入有效的URL地址', type: 'warning' })
      return
    }

    setIsFetchingWebsiteInfo(true)
    
    try {
      const response = await fetch(`https://api.ahfi.cn/api/websiteinfo?url=${encodeURIComponent(url)}`)
      const result = await response.json()
      
      if (result.code === 200 && result.data) {
        setBookmarkFormData(prev => ({
          ...prev,
          title: result.data.title || prev.title,
          description: result.data.description || prev.description,
          ico_url: result.data.ico_url || prev.ico_url
        }))
        addToast({ message: '获取网站信息成功', type: 'success' })
      } else {
        addToast({ message: result.message || '获取网站信息失败', type: 'error' })
      }
    } catch {
      addToast({ message: '获取网站信息失败，请检查网络连接', type: 'error' })
    } finally {
      setIsFetchingWebsiteInfo(false)
    }
  }

  const handleBookmarkSubmit = () => {
    if (!bookmarkFormData.title.trim() || !bookmarkFormData.url.trim() || !bookmarkFormData.category_id) {
      setBookmarkError('标题、网址和分类不能为空')
      return
    }

    try {
      new URL(bookmarkFormData.url)
    } catch {
      setBookmarkError('请输入有效的URL地址')
      return
    }

    if (isEditBookmarkModalOpen && currentBookmark) {
      updateBookmarkMutation.mutate({
        id: currentBookmark.id,
        bookmark: bookmarkFormData
      })
    } else {
      addBookmarkMutation.mutate({
        ...bookmarkFormData,
        user_id: null,
        is_favorite: false
      })
    }
  }

  const handleAddCategory = async (name: string, parentId: string | null) => {
    addCategoryMutation.mutate({ name, parentId })
  }

  const handleUpdateCategory = async (categoryId: string, name: string) => {
    updateCategoryMutation.mutate({ id: categoryId, name })
  }

  const openBookmarkUrl = (url: string) => {
    openUrl(url)
  }

  const handleBookmarkContextMenu = (e: React.MouseEvent, bookmark: Bookmark) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ 
      x: e.clientX, 
      y: e.clientY, 
      type: 'bookmark', 
      targetId: bookmark.id, 
      targetData: bookmark 
    })
  }

  const getCategoryName = (categoryId: string) => {
    const findCategory = (cats: Category[]): Category | undefined => {
      for (const category of cats) {
        if (category.id === categoryId) return category
        if (category.children && category.children.length > 0) {
          const found = findCategory(category.children)
          if (found) return found
        }
      }
      return undefined
    }
    
    const category = findCategory(categories)
    return category ? category.name : '未知分类'
  }

  const isLoading = categoriesLoading || bookmarksLoading

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">网址管理</h1>
        {activeTab === 'bookmarks' && (
          <button
            onClick={handleAddBookmark}
            className="flex items-center gap-1 px-2 py-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 text-xs font-medium transition-colors"
          >
            <Plus className="w-3 h-3" />
            添加网址
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${
                activeTab === 'bookmarks'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              网址列表
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${
                activeTab === 'categories'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              分类管理
            </button>
          </div>
          {activeTab === 'bookmarks' && (
            <div className="relative max-w-[200px] w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                placeholder="搜索网址..."
                className="w-full px-2 py-1 pr-20 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setPage(1)
                  }}
                  className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="清空搜索"
                >
                  <X size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="搜索"
              >
                <Search size={14} />
              </button>
            </div>
          )}
        </div>

        {activeTab === 'bookmarks' ? (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => handleCategorySelect(null)}
                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                  !selectedCategoryId
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                全部
              </button>
              {categories.map(mainCategory => (
                <button
                  key={mainCategory.id}
                  onClick={() => handleCategorySelect(mainCategory.id)}
                  className={`px-2 py-1 text-xs rounded-full transition-colors ${
                    selectedCategoryId === mainCategory.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {mainCategory.name}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <LoadingSpinner size="lg" />
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      标题
                    </th>
                    <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      网址
                    </th>
                    <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      分类
                    </th>
                    <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      公开
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredBookmarks.map((bookmark) => (
                    <tr 
                      key={bookmark.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      onContextMenu={(e) => handleBookmarkContextMenu(e, bookmark)}
                    >
                      <td className="px-4 py-3 sm:px-6">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1" onClick={() => openBookmarkUrl(bookmark.url)}>
                          {bookmark.title}
                          <ExternalLink size={14} />
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                          {bookmark.description}
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        <button
                          onClick={(e) => { e.stopPropagation(); openBookmarkUrl(bookmark.url) }}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline flex items-center gap-1 truncate max-w-truncate-xl"
                          title="点击打开网站"
                        >
                          <span className="truncate">{bookmark.url}</span>
                          <ExternalLink size={12} className="flex-shrink-0" />
                        </button>
                      </td>
                      <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {getCategoryName(bookmark.category_id)}
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                        <Switch
                          checked={bookmark.is_public}
                          onChange={() => handleBookmarkTogglePublic(bookmark.id, bookmark.is_public)}
                        />
                      </td>
                    </tr>
                  ))}
                  {!isLoading && filteredBookmarks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center">
                        <List className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                        <span className="text-gray-600 dark:text-gray-400">暂无数据</span>
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <Pagination
                currentPage={page}
                total={total}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          </>
        ) : (
          <CategoryManager
            categories={categories as CategoryItem[]}
            selectedCategory={null}
            onSelectCategory={() => {}}
            onAddCategory={handleAddCategory}
            onDeleteCategory={async (categoryId: string) => {
              setDeleteTargetId(categoryId)
              const categoryToDelete = categories.find(c => c.id === categoryId)
              setDeleteType('category')
              setDeleteTargetName(categoryToDelete?.name || '')
              setIsDeleteConfirmOpen(true)
            }}
            onUpdateCategory={handleUpdateCategory}
          />
        )}
      </div>

      <Modal
        isOpen={isAddBookmarkModalOpen}
        onClose={() => setIsAddBookmarkModalOpen(false)}
        title="添加网址"
        confirmText="添加"
        onConfirm={handleBookmarkSubmit}
        size="lg"
      >
        {bookmarkError && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-md mb-4">
            {bookmarkError}
          </div>
        )}
        <form className="space-y-4">
          <div className="flex items-center justify-between">
            <Switch
              checked={bookmarkFormData.is_public}
              onChange={(checked) => setBookmarkFormData(prev => ({ ...prev, is_public: checked }))}
              label="公开"
            />
            <div className="flex items-center gap-2">
              <label htmlFor="order" className="text-xs font-medium text-gray-500 dark:text-gray-400">
                排序
              </label>
              <input
                type="number"
                id="order"
                name="order"
                value={bookmarkFormData.order}
                onChange={handleBookmarkInputChange}
                className="w-20 px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs"
              />
            </div>
          </div>
          <div>
            <label htmlFor="url" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              网址
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                id="url"
                name="url"
                value={bookmarkFormData.url}
                onChange={handleBookmarkInputChange}
                className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
                required
              />
              <button
                type="button"
                onClick={fetchWebsiteInfo}
                disabled={isFetchingWebsiteInfo}
                className="px-3 py-1 border border-gray-200 dark:border-gray-500 rounded-md bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="获取网站信息"
              >
                {isFetchingWebsiteInfo ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Download className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              分类
            </label>
            <div className="flex gap-3">
              <select
                value={selectedMainCategory}
                onChange={(e) => handleMainCategoryChange(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
                required
              >
                {getMainCategories().map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedSubCategory}
                onChange={(e) => handleSubCategoryChange(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
                required
                disabled={!selectedMainCategory}
              >
                {getSubCategories(selectedMainCategory).map((subCategory) => (
                  <option key={subCategory.id} value={subCategory.id}>
                    {subCategory.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="title" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              标题
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={bookmarkFormData.title}
              onChange={handleBookmarkInputChange}
              className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              描述
            </label>
            <textarea
              id="description"
              name="description"
              value={bookmarkFormData.description}
              onChange={handleBookmarkInputChange}
              rows={3}
              className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm resize-none"
            />
          </div>
          <div>
            <label htmlFor="ico_url" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              图标 URL
            </label>
            <div className="flex items-center gap-3">
              <input
                type="url"
                id="ico_url"
                name="ico_url"
                value={bookmarkFormData.ico_url}
                onChange={handleBookmarkInputChange}
                placeholder="可选，网站图标 URL"
                className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
              />
              <CachedIcon
                src={bookmarkFormData.ico_url || null}
                alt="图标预览"
                className="w-10 h-10 rounded-md object-cover border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-800 flex-shrink-0"
                defaultIcon={<div className="w-10 h-10 flex items-center justify-center text-gray-500"><Globe className="w-5 h-5" /></div>}
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditBookmarkModalOpen}
        onClose={() => setIsEditBookmarkModalOpen(false)}
        title="编辑网址"
        confirmText="保存"
        onConfirm={handleBookmarkSubmit}
        size="lg"
      >
        {bookmarkError && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-md mb-4">
            {bookmarkError}
          </div>
        )}
        <form className="space-y-4">
          <div className="flex items-center justify-between">
            <Switch
              checked={bookmarkFormData.is_public}
              onChange={(checked) => setBookmarkFormData(prev => ({ ...prev, is_public: checked }))}
              label="公开"
            />
            <div className="flex items-center gap-2">
              <label htmlFor="edit-order" className="text-xs font-medium text-gray-500 dark:text-gray-400">
                排序
              </label>
              <input
                type="number"
                id="edit-order"
                name="order"
                value={bookmarkFormData.order}
                onChange={handleBookmarkInputChange}
                className="w-20 px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs"
              />
            </div>
          </div>
          <div>
            <label htmlFor="edit-url" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              网址
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                id="edit-url"
                name="url"
                value={bookmarkFormData.url}
                onChange={handleBookmarkInputChange}
                className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
                required
              />
              <button
                type="button"
                onClick={fetchWebsiteInfo}
                disabled={isFetchingWebsiteInfo}
                className="px-3 py-1 border border-gray-200 dark:border-gray-500 rounded-md bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="获取网站信息"
              >
                {isFetchingWebsiteInfo ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Download className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              分类
            </label>
            <div className="flex gap-3">
              <select
                value={selectedMainCategory}
                onChange={(e) => handleMainCategoryChange(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
                required
              >
                {getMainCategories().map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedSubCategory}
                onChange={(e) => handleSubCategoryChange(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
                required
                disabled={!selectedMainCategory}
              >
                {getSubCategories(selectedMainCategory).map((subCategory) => (
                  <option key={subCategory.id} value={subCategory.id}>
                    {subCategory.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="edit-title" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              标题
            </label>
            <input
              type="text"
              id="edit-title"
              name="title"
              value={bookmarkFormData.title}
              onChange={handleBookmarkInputChange}
              className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="edit-description" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              描述
            </label>
            <textarea
              id="edit-description"
              name="description"
              value={bookmarkFormData.description}
              onChange={handleBookmarkInputChange}
              rows={3}
              className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm resize-none"
            />
          </div>
          <div>
            <label htmlFor="edit-ico_url" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              图标 URL
            </label>
            <div className="flex items-center gap-3">
              <input
                type="url"
                id="edit-ico_url"
                name="ico_url"
                value={bookmarkFormData.ico_url}
                onChange={handleBookmarkInputChange}
                placeholder="可选，网站图标 URL"
                className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
              />
              <CachedIcon
                src={bookmarkFormData.ico_url || null}
                alt="图标预览"
                className="w-10 h-10 rounded-md object-cover border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-800 flex-shrink-0"
                defaultIcon={<div className="w-10 h-10 flex items-center justify-center text-gray-500"><Globe className="w-5 h-5" /></div>}
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="确认删除"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        size="sm"
      >
        {deleteType === 'bookmark' ? (
          <p className="text-gray-600 dark:text-gray-400">
            确定要删除网址 <span className="text-red-600 dark:text-red-400 font-medium">{deleteTargetName}</span> 吗？
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-600 dark:text-gray-400">
              确定要删除分类 <span className="text-red-600 dark:text-red-400 font-medium">{deleteTargetName}</span> 吗？
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              删除后该分类下的网址将被移动到默认分类。
            </p>
          </div>
        )}
      </Modal>

      <ContextMenu
        isOpen={!!contextMenu}
        x={contextMenu?.x || 0}
        y={contextMenu?.y || 0}
        items={contextMenu?.type === 'bookmark' ? [
          {
            id: 'edit',
            label: '编辑',
            icon: <Edit size={16} />,
            onClick: () => {
              if (contextMenu?.targetData) {
                handleEditBookmark(contextMenu.targetData as Bookmark)
              }
              setContextMenu(null)
            }
          },
          {
            id: 'togglePublic',
            label: (contextMenu.targetData as Bookmark)?.is_public ? '设为私有' : '设为公开',
            icon: (contextMenu.targetData as Bookmark)?.is_public ? <Check size={16} /> : <X size={16} />,
            onClick: () => {
              const bookmark = contextMenu?.targetData as Bookmark
              if (bookmark) {
                handleBookmarkTogglePublic(bookmark.id, bookmark.is_public)
              }
              setContextMenu(null)
            }
          },
          {
            id: 'delete',
            label: '删除',
            icon: <Trash2 size={16} />,
            onClick: () => {
              if (contextMenu?.targetId && contextMenu?.targetData) {
                handleDeleteBookmark(contextMenu.targetId, (contextMenu.targetData as Bookmark).title)
              }
              setContextMenu(null)
            }
          }
        ] : []}
        onClose={() => setContextMenu(null)}
      />
    </div>
  )
}

export default AdminWebsitesPage