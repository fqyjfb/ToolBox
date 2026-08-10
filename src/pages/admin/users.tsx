import React, { useState } from 'react'
import { Edit, Lock, Search, ArrowUpDown, X, RefreshCw } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userService } from '../../services/UserService'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import { useToastStore } from '../../store/toastStore'
import ContextMenu from '../../components/ui/ContextMenu'
import { useContextMenu } from '../../hooks/useContextMenu'
import Modal from '../../components/ui/Modal'

interface UserItem {
  id: string
  username: string
  name: string
  email: string
  phone: string
  memberLevel: string
  vipExpireAt: string | null
  isBanned: boolean
  createdAt: string
  address?: string
  birthday?: string
}

const UserListPage: React.FC = () => {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [memberLevelFilter, setMemberLevelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    birthday: '',
    memberLevel: '普通',
    vipExpireAt: '',
    isBanned: false
  })
  
  const { contextMenu, handleContextMenu, handleClose, handleItemClick } = useContextMenu<UserItem>()
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', currentPage, pageSize, searchQuery, sortBy, sortOrder, memberLevelFilter, statusFilter],
    queryFn: () => userService.getUserList(
      currentPage,
      pageSize,
      searchQuery,
      sortBy,
      sortOrder,
      memberLevelFilter,
      statusFilter
    ),
    staleTime: 5 * 60 * 1000,
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ id, userData }: { id: string; userData: typeof formData }) =>
      userService.updateUser(id, userData),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] })
        addToast({ type: 'success', message: result.message })
        setIsEditModalOpen(false)
      } else {
        addToast({ type: 'error', message: result.message })
      }
    },
    onError: () => {
      addToast({ type: 'error', message: '更新失败' })
    },
  })

  if (error) {
    addToast({ type: 'error', message: '获取用户列表失败' })
  }

  const users = data?.success ? data.data.list : []
  const total = data?.success ? data.data.total : 0

  const menuItems = [
    {
      id: 'edit',
      label: '编辑',
      icon: <Edit size={14} />,
      onClick: (user: UserItem) => {
        handleEditUser(user)
      },
    },
    {
      id: 'reset-password',
      label: '重置密码',
      icon: <Lock size={14} />,
      onClick: async (user: UserItem) => {
        const result = await userService.resetPassword(user.id)
        if (result.success) {
          addToast({ type: 'success', message: result.message })
        } else {
          addToast({ type: 'error', message: result.message })
        }
      },
    },
  ]

  const handleEditUser = async (user: UserItem) => {
    setIsLoadingUser(true)
    const result = await userService.getUserDetail(user.id)
    if (result.success) {
      setCurrentUser(result.data)
      setFormData({
        name: result.data.name,
        email: result.data.email,
        phone: result.data.phone,
        address: result.data.address || '',
        birthday: result.data.birthday || '',
        memberLevel: result.data.memberLevel,
        vipExpireAt: result.data.vipExpireAt || '',
        isBanned: result.data.isBanned
      })
      setIsEditModalOpen(true)
    } else {
      addToast({ type: 'error', message: result.message || '获取用户信息失败' })
    }
    setIsLoadingUser(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const handleSubmitEdit = () => {
    if (!currentUser) return
    updateUserMutation.mutate({ id: currentUser.id, userData: formData })
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  const handleSearchSubmit = () => {
    setCurrentPage(1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit()
    }
  }

  const handleSort = (field: string) => {
    const newSortOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc'
    setSortBy(field)
    setSortOrder(newSortOrder)
    setCurrentPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setMemberLevelFilter('')
    setStatusFilter('')
    setCurrentPage(1)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setCurrentPage(1)
  }

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 text-gray-400" />
    return sortOrder === 'asc' ? (
      <ArrowUpDown className="w-3 h-3 text-blue-400 transform rotate-180" />
    ) : (
      <ArrowUpDown className="w-3 h-3 text-blue-400" />
    )
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">用户管理</h1>
        <button
          onClick={handleResetFilters}
          className="flex items-center gap-1 px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-medium transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          重置筛选
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="flex items-center gap-3">
            <select
              value={memberLevelFilter}
              onChange={(e) => {
                const newValue = e.target.value
                setMemberLevelFilter(newValue)
                setCurrentPage(1)
              }}
              className="px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs"
            >
              <option value="">全部等级</option>
              <option value="普通">普通</option>
              <option value="VIP">VIP</option>
              <option value="SVIP">SVIP</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                const newValue = e.target.value
                setStatusFilter(newValue)
                setCurrentPage(1)
              }}
              className="px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs"
            >
              <option value="">全部状态</option>
              <option value="active">正常</option>
              <option value="banned">已封禁</option>
            </select>
          </div>
          <div className="relative max-w-[200px] w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder="搜索用户..."
              className="w-full px-2 py-1 pr-20 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
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
                <th 
                  scope="col" 
                  className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-400/50 dark:hover:bg-gray-600/50"
                  onClick={() => handleSort('username')}
                >
                  <div className="flex items-center gap-1">
                    用户名
                    {renderSortIcon('username')}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-400/50 dark:hover:bg-gray-600/50"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    姓名
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  邮箱
                </th>
                <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  手机号
                </th>
                <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  会员等级
                </th>
                <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                  VIP到期时间
                </th>
                <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  状态
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-400/50 dark:hover:bg-gray-600/50"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center gap-1">
                    创建时间
                    {renderSortIcon('created_at')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr 
                  key={user.id} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  onContextMenu={(e) => handleContextMenu(e, user, menuItems)}
                >
                  <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.username}
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {user.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {user.email}
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {user.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.memberLevel === 'VIP' ? 'bg-purple-100 dark:bg-purple-500/30 text-purple-800 dark:text-purple-300' : 
                      user.memberLevel === 'SVIP' ? 'bg-yellow-100 dark:bg-yellow-500/30 text-yellow-800 dark:text-yellow-300' : 
                      'bg-gray-100 dark:bg-gray-500/30 text-gray-800 dark:text-gray-300'
                    }`}>
                      {user.memberLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3 sm:px-6 whitespace-nowrap hidden md:table-cell">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {user.vipExpireAt ? new Date(user.vipExpireAt).toLocaleDateString() : '永久'}
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.isBanned ? 'bg-red-100 dark:bg-red-500/30 text-red-800 dark:text-red-300' : 
                      'bg-green-100 dark:bg-green-500/30 text-green-800 dark:text-green-300'
                    }`}>
                      {user.isBanned ? '已封禁' : '正常'}
                    </span>
                  </td>
                  <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(user.createdAt).toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center">
                    <div className="text-gray-600 dark:text-gray-400">暂无数据</div>
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <Pagination
            currentPage={currentPage}
            total={total}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          isOpen={!!contextMenu}
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items.map(item => ({
            id: item.id,
            label: item.label,
            icon: item.icon,
            onClick: () => handleItemClick(item.onClick),
          }))}
          onClose={handleClose}
        />
      )}

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setCurrentUser(null)
        }}
        title="编辑用户"
        confirmText="保存"
        onConfirm={handleSubmitEdit}
        confirmDisabled={isLoadingUser || updateUserMutation.isPending}
        size="lg"
      >
        {isLoadingUser ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : currentUser ? (
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  用户名
                </label>
                <input
                  type="text"
                  value={currentUser.username}
                  disabled
                  className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white bg-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  姓名
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  邮箱
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  手机号
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  会员等级
                </label>
                <select
                  name="memberLevel"
                  value={formData.memberLevel}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
                >
                  <option value="普通">普通</option>
                  <option value="VIP">VIP</option>
                  <option value="SVIP">SVIP</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  VIP到期时间
                </label>
                <input
                  type="date"
                  name="vipExpireAt"
                  value={formData.vipExpireAt ? formData.vipExpireAt.split('T')[0] : ''}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
                  disabled={formData.memberLevel === '普通'}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  生日
                </label>
                <input
                  type="date"
                  name="birthday"
                  value={formData.birthday ? formData.birthday.split('T')[0] : ''}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm"
                />
              </div>
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="isBanned"
                    checked={formData.isBanned}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    封禁用户
                  </label>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                地址
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-2 py-1 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-sm resize-none"
              />
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}

export default UserListPage