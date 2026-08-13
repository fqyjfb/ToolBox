import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit, Trash2, X, Check, ExternalLink } from 'lucide-react'
import toolService, { Tool, ToolCategory } from '../../services/ToolService'
import { useToastStore } from '../../store/toastStore'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import ContextMenu from '../../components/ui/ContextMenu'
import ToggleSwitch from '../../components/settings/ToggleSwitch'
import CategoryManager, { CategoryItem } from '../../components/ui/CategoryManager';
import { openUrl } from '../../services/browserService'

const isForeignDomain = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    const domesticDomains = ['.cn', '.com.cn', '.net.cn', '.org.cn', '.gov.cn', '.edu.cn', '.hk', '.macau', '.tw']
    return !domesticDomains.some(suffix => hostname.endsWith(suffix))
  } catch {
    return true
  }
}

import reactIcon from '../../assets/react.svg'

const proxyImageUrl = (url: string): string => {
  const raw = (url || '').trim()
  if (!raw) return reactIcon
  if (/^(data|blob):/i.test(raw)) return raw
  if (isForeignDomain(raw)) {
    try {
      return `https://images.weserv.nl/?url=${encodeURIComponent(raw)}`
    } catch {
      return raw
    }
  }
  return raw
}

const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, originalUrl: string) => {
  const target = e.target as HTMLImageElement
  if (target.src === originalUrl) {
    try {
      const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(originalUrl)}`
      target.src = proxyUrl
    } catch {
      try {
        target.src = `https://proxy.duckduckgo.com/iu/?u=${encodeURIComponent(originalUrl)}`
      } catch {
        target.src = reactIcon
      }
    }
  } else if (target.src.includes('images.weserv.nl')) {
    try {
      target.src = `https://proxy.duckduckgo.com/iu/?u=${encodeURIComponent(originalUrl)}`
    } catch {
      target.src = reactIcon
    }
  } else {
    target.src = reactIcon
  }
}

interface CategoryTree extends ToolCategory {
  children: CategoryTree[]
}

const buildCategoryTreeFromData = (categories: ToolCategory[]): CategoryTree[] => {
  const categoryMap = new Map<string, CategoryTree>()

  categories.forEach(category => {
    categoryMap.set(category.id, {
      ...category,
      children: []
    })
  })

  const rootCategories: CategoryTree[] = []
  categories.forEach(category => {
    const categoryNode = categoryMap.get(category.id)
    if (categoryNode) {
      if (!category.parent_id) {
        rootCategories.push(categoryNode)
      } else {
          const parent = categoryMap.get(category.parent_id)
          if (parent) {
            parent.children.push(categoryNode)
          }
        }
    }
  })

  const sortCategories = (cats: CategoryTree[]) => {
    cats.sort((a, b) => (a.order || 0) - (b.order || 0))
    cats.forEach(cat => sortCategories(cat.children))
  }

  sortCategories(rootCategories)
  return rootCategories
}

const ToolsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [currentTool, setCurrentTool] = useState<Tool | null>(null)
  const [formData, setFormData] = useState({
    category_id: '',
    title: '',
    description: '',
    download_url: '',
    网盘类型: '夸克' as '夸克' | '百度' | '其他',
    icon_url: '',
    is_active: true
  })
  const [errors, setErrors] = useState({ title: '', download_url: '' })
  const [selectedMainCategory, setSelectedMainCategory] = useState('')
  const [selectedSubCategory, setSelectedSubCategory] = useState('')
  const [activeTab, setActiveTab] = useState<'tools' | 'categories'>('tools')
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [toolToDelete, setToolToDelete] = useState<Tool | null>(null)
  
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tool: Tool } | null>(null)

  const addToast = useToastStore((s) => s.addToast)

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['toolCategories'],
    queryFn: () => toolService.getCategories(),
  })

  const categoryTree = useMemo(() => 
    buildCategoryTreeFromData(categories), [categories]
  )

  const getMainCategories = () => categoryTree.filter(category => !category.parent_id)

  const getSubCategories = (mainCategoryId: string) => {
    const mainCategory = categoryTree.find(category => category.id === mainCategoryId)
    return mainCategory?.children || []
  }

  const { data: toolsData, isLoading: toolsLoading } = useQuery({
    queryKey: ['tools', filterCategory, searchTerm, currentPage, pageSize],
    queryFn: () => toolService.getTools(filterCategory, searchTerm, currentPage, pageSize),
  })

  const tools = useMemo(() => toolsData?.data || [], [toolsData?.data])
  const totalItems = useMemo(() => toolsData?.count || 0, [toolsData?.count])
  const loading = categoriesLoading || toolsLoading

  const addToolMutation = useMutation({
    mutationFn: (toolData: Omit<Tool, 'id' | 'created_at' | 'updated_at' | 'category_name'>) => 
      toolService.addTool(toolData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      addToast({ message: '添加成功', type: 'success' })
    },
    onError: () => {
      addToast({ message: '添加失败', type: 'error' })
    },
  })

  const updateToolMutation = useMutation({
    mutationFn: ({ id, toolData }: { id: string; toolData: Partial<Omit<Tool, 'id' | 'created_at' | 'updated_at' | 'category_name'>> }) =>
      toolService.updateTool(id, toolData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      addToast({ message: '更新成功', type: 'success' })
    },
    onError: () => {
      addToast({ message: '更新失败', type: 'error' })
    },
  })

  const deleteToolMutation = useMutation({
    mutationFn: (id: string) => toolService.deleteTool(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      addToast({ message: '删除成功', type: 'success' })
    },
    onError: () => {
      addToast({ message: '删除失败', type: 'error' })
    },
  })

  const addCategoryMutation = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: string | null }) =>
      toolService.addCategory(name, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toolCategories'] })
      addToast({ message: '添加成功', type: 'success' })
    },
  })

  const updateCategoryMutation = useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) =>
      toolService.updateCategory(categoryId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toolCategories'] })
      addToast({ message: '更新成功', type: 'success' })
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) => toolService.deleteCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toolCategories'] })
      addToast({ message: '删除成功', type: 'success' })
    },
  })

  const handleMainCategoryChange = (mainCategoryId: string) => {
    setSelectedMainCategory(mainCategoryId)
    const subCategories = getSubCategories(mainCategoryId)
    const firstSubCategory = subCategories[0]
    const subCategoryId = firstSubCategory?.id || ''
    setSelectedSubCategory(subCategoryId)
    const categoryId = subCategoryId || mainCategoryId
    setFormData(prev => ({ ...prev, category_id: categoryId }))
  }

  const handleSubCategoryChange = (subCategoryId: string) => {
    setSelectedSubCategory(subCategoryId)
    setFormData(prev => ({ ...prev, category_id: subCategoryId }))
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setCurrentPage(1)
    }
  }

  const handleSearchSubmit = () => {
    setCurrentPage(1)
  }

  const handleCategoryFilterChange = (categoryId: string) => {
    setFilterCategory(categoryId)
    setCurrentPage(1)
  }

  const handleAddTool = () => {
    setCurrentTool(null)
    const mainCategories = getMainCategories()
    const firstMainCategory = mainCategories[0]
    const mainCategoryId = firstMainCategory?.id || ''
    const subCategories = getSubCategories(mainCategoryId)
    const firstSubCategory = subCategories[0]
    const subCategoryId = firstSubCategory?.id || ''

    setSelectedMainCategory(mainCategoryId)
    setSelectedSubCategory(subCategoryId)
    setFormData({
      category_id: subCategoryId,
      title: '',
      description: '',
      download_url: '',
      网盘类型: '夸克',
      icon_url: '',
      is_active: true
    })
    setErrors({ title: '', download_url: '' })
    setIsAddModalOpen(true)
  }

  const handleEditTool = async (id: string) => {
    try {
      const toolData = await toolService.getToolById(id)
      setCurrentTool(toolData)
      setFormData({
        category_id: toolData.category_id || '',
        title: toolData.title,
        description: toolData.description || '',
        download_url: toolData.download_url,
        网盘类型: toolData.网盘类型,
        icon_url: toolData.icon_url || '',
        is_active: toolData.is_active
      })
      setErrors({ title: '', download_url: '' })

      let mainCategoryId = ''
      let subCategoryId = ''

      const findCategory = (cats: CategoryTree[]): CategoryTree | undefined => {
        for (const category of cats) {
          if (category.id === toolData.category_id) {
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

      findCategory(categoryTree)
      setSelectedMainCategory(mainCategoryId)
      setSelectedSubCategory(subCategoryId)
      setIsEditModalOpen(true)
    } catch (error) {
      console.error('获取工具详情失败:', error)
      addToast({ message: '获取工具详情失败', type: 'error' })
    }
  }

  const handleDeleteTool = (tool: Tool) => {
    setToolToDelete(tool)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmToolDelete = async () => {
    if (!toolToDelete) return
    deleteToolMutation.mutate(toolToDelete.id)
    setDeleteConfirmOpen(false)
    setToolToDelete(null)
  }

  const handleToolToggleActive = async (toolId: string, currentState: boolean) => {
    updateToolMutation.mutate({ id: toolId, toolData: { is_active: !currentState } })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    if (name === 'title') {
      setErrors(prev => ({ ...prev, title: value.length > 255 ? '标题长度不能超过255个字符' : '' }))
    } else if (name === 'download_url') {
      const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/
      setErrors(prev => ({ ...prev, download_url: value && !urlRegex.test(value) ? '请输入有效的URL地址' : '' }))
    }
  }

  const handleSubmit = async () => {
    const newErrors = {
      title: formData.title.trim() ? (formData.title.length > 255 ? '标题长度不能超过255个字符' : '') : '请输入标题',
      download_url: formData.download_url.trim() ? (/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/.test(formData.download_url) ? '' : '请输入有效的URL地址') : '请输入下载地址'
    }

    setErrors(newErrors)

    if (Object.values(newErrors).every(error => error === '')) {
      try {
        const toolPayload = {
        category_id: formData.category_id || null,
        title: formData.title,
        description: formData.description || null,
        download_url: formData.download_url,
        网盘类型: formData.网盘类型,
        icon_url: formData.icon_url || null,
        is_active: formData.is_active
      }

        if (isEditModalOpen && currentTool) {
          updateToolMutation.mutate({ id: currentTool.id, toolData: toolPayload })
        } else {
          addToolMutation.mutate(toolPayload)
        }

        setIsAddModalOpen(false)
        setIsEditModalOpen(false)
      } catch (error) {
        console.error('保存工具失败:', error)
      }
    }
  }

  const handleAddCategory = async (name: string, parentId: string | null) => {
    await addCategoryMutation.mutateAsync({ name, parentId })
  }

  const handleUpdateCategory = async (categoryId: string, name: string) => {
    await updateCategoryMutation.mutateAsync({ categoryId, name })
  }

  const handleDeleteCategory = async (categoryId: string) => {
    await deleteCategoryMutation.mutateAsync(categoryId)
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">工具管理</h1>
        {activeTab === 'tools' && (
          <button
            onClick={handleAddTool}
            className="flex items-center gap-1 px-2 py-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 text-xs font-medium transition-colors"
          >
            <Plus className="w-3 h-3" />
            添加工具
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('tools')}
              className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${
                activeTab === 'tools'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              工具列表
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
          {activeTab === 'tools' && (
            <div className="relative max-w-[200px] w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                placeholder="搜索工具..."
                className="w-full px-2 py-1 pr-20 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setCurrentPage(1)
                  }}
                  className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="清空搜索"
                >
                  <X size={12} />
                </button>
              )}
              <button
                onClick={handleSearchSubmit}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="搜索"
              >
                <Search size={14} />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner />
          </div>
        ) : activeTab === 'tools' ? (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => handleCategoryFilterChange('')}
                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                  !filterCategory
                    ? 'bg-primary text-button-text'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                全部
              </button>
              {categoryTree.map(mainCategory => (
                <div key={mainCategory.id} className="relative">
                  <button
                    onClick={() => handleCategoryFilterChange(mainCategory.id)}
                    className={`px-2 py-1 text-xs rounded-full transition-colors ${
                      filterCategory === mainCategory.id
                        ? 'bg-primary text-button-text'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {mainCategory.name}
                  </button>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">图标</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">名称</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">分类</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">网盘类型</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">状态</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {tools.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        暂无工具数据
                      </td>
                    </tr>
                  ) : (
                    tools.map(tool => (
                      <tr 
                        key={tool.id} 
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setContextMenu({ x: e.clientX, y: e.clientY, tool })
                        }}
                      >
                        <td className="px-4 py-3">
                          <img
                            src={proxyImageUrl(tool.icon_url || '')}
                            alt={tool.title}
                            className="w-8 h-8 rounded-md object-cover"
                            onError={(e) => handleImageError(e, tool.icon_url || '')}
                          />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer" onClick={() => openUrl(tool.download_url)}>
                            {tool.title}
                            <ExternalLink size={14} />
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400">{tool.category_name || '-'}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            tool.网盘类型 === '夸克' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            tool.网盘类型 === '百度' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {tool.网盘类型}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <ToggleSwitch
                            checked={tool.is_active}
                            onChange={() => handleToolToggleActive(tool.id, tool.is_active)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <Pagination
                currentPage={currentPage}
                total={totalItems}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          </>
        ) : (
          <CategoryManager
            categories={categoryTree as CategoryItem[]}
            selectedCategory={null}
            onSelectCategory={() => {}}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            onUpdateCategory={handleUpdateCategory}
          />
        )}
      </div>

      {(isAddModalOpen || isEditModalOpen) && (
        <Modal
          isOpen={isAddModalOpen || isEditModalOpen}
          onClose={() => {
            setIsAddModalOpen(false)
            setIsEditModalOpen(false)
          }}
          title={isEditModalOpen ? '编辑工具' : '添加工具'}
          confirmText="保存"
          onConfirm={handleSubmit}
        >
          <form className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">分类</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedMainCategory}
                  onChange={(e) => handleMainCategoryChange(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs"
                >
                  <option value="">选择主分类</option>
                  {getMainCategories().map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                <select
                  value={selectedSubCategory}
                  onChange={(e) => handleSubCategoryChange(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs"
                >
                  <option value="">选择子分类</option>
                  {getSubCategories(selectedMainCategory).map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">工具名称</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs ${
                  errors.title ? 'border-red-400 focus:border-red-400' : 'border-gray-200 dark:border-gray-500'
                }`}
                placeholder="请输入工具名称"
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">描述</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs resize-none"
                rows={3}
                placeholder="请输入工具描述"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">下载地址</label>
              <input
                type="text"
                name="download_url"
                value={formData.download_url}
                onChange={handleChange}
                className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs ${
                  errors.download_url ? 'border-red-400 focus:border-red-400' : 'border-gray-200 dark:border-gray-500'
                }`}
                placeholder="请输入下载链接"
              />
              {errors.download_url && <p className="text-red-500 text-xs mt-1">{errors.download_url}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">网盘类型</label>
              <select
                name="网盘类型"
                value={formData.网盘类型}
                onChange={handleChange}
                className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs"
              >
                <option value="夸克">夸克网盘</option>
                <option value="百度">百度网盘</option>
                <option value="其他">其他</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">图标链接</label>
              <input
                type="text"
                name="icon_url"
                value={formData.icon_url}
                onChange={handleChange}
                className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs"
                placeholder="请输入图标URL"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="ml-2 text-sm text-gray-600 dark:text-gray-400">启用</label>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false)
          setToolToDelete(null)
        }}
        onConfirm={handleConfirmToolDelete}
        title="确认删除"
        message="确定要删除这个工具吗？"
        deleteItemName={toolToDelete ? `工具：${toolToDelete.title}` : undefined}
        confirmText="确定"
        cancelText="取消"
      />

      <ContextMenu
        isOpen={!!contextMenu}
        x={contextMenu?.x || 0}
        y={contextMenu?.y || 0}
        items={contextMenu ? [
          {
            id: 'edit',
            label: '编辑',
            icon: <Edit size={16} />,
            onClick: () => {
              handleEditTool(contextMenu.tool.id)
              setContextMenu(null)
            }
          },
          {
            id: 'toggle',
            label: contextMenu.tool.is_active ? '禁用' : '启用',
            icon: contextMenu.tool.is_active ? <X size={16} /> : <Check size={16} />,
            onClick: () => {
              handleToolToggleActive(contextMenu.tool.id, contextMenu.tool.is_active)
              setContextMenu(null)
            }
          },
          {
            id: 'delete',
            label: '删除',
            icon: <Trash2 size={16} />,
            onClick: () => {
              handleDeleteTool(contextMenu.tool)
              setContextMenu(null)
            }
          }
        ] : []}
        onClose={() => setContextMenu(null)}
      />
    </div>
  )
}

export default ToolsPage