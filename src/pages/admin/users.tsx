import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit, Lock, Search, ArrowUpDown, X } from 'lucide-react'
import { userService } from '../../services/UserService'
import LoadingSpinner from '../../components/LoadingSpinner'
import Pagination from '../../components/Pagination'
import { useToastStore } from '../../store/toastStore'
import ContextMenu from '../../components/ContextMenu'
import { useContextMenu } from '../../hooks/useContextMenu'

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
}

const UserListPage: React.FC = () => {
  const navigate = useNavigate()
  const { addToast } = useToastStore()
  const [users, setUsers] = useState<UserItem[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [memberLevelFilter, setMemberLevelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  
  const { contextMenu, handleContextMenu, handleClose, handleItemClick } = useContextMenu<UserItem>()
  
  const menuItems = [
    {
      id: 'edit',
      label: '编辑',
      icon: <Edit size={14} />,
      onClick: (user: UserItem) => {
        navigate(`/admin/users/edit/${user.id}`)
      },
    },
    {
      id: 'reset-password',
      label: '重置密码',
      icon: <Lock size={14} />,
      onClick: async (user: UserItem) => {
        setIsLoading(true)
        const result = await userService.resetPassword(user.id)
        if (result.success) {
          addToast({ type: 'success', message: result.message })
        } else {
          addToast({ type: 'error', message: result.message })
        }
        setIsLoading(false)
      },
    },
  ]

  const fetchUsers = async (
    pageNum = currentPage, 
    pageSizeNum = pageSize,
    filters: { memberLevel?: string; status?: string; search?: string } = {}
  ) => {
    setIsLoading(true)
    const result = await userService.getUserList(
      pageNum,
      pageSizeNum,
      filters.search ?? searchQuery,
      sortBy,
      sortOrder,
      filters.memberLevel ?? memberLevelFilter,
      filters.status ?? statusFilter
    )
    if (result.success) {
      setUsers(result.data.list)
      setTotal(result.data.total)
      setCurrentPage(result.data.page)
    } else {
      addToast({ type: 'error', message: result.message || '获取用户列表失败' })
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleSearchSubmit = () => {
    setCurrentPage(1)
    fetchUsers(1, pageSize)
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
    fetchUsers(1, pageSize)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    fetchUsers(newPage, pageSize)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1)
    fetchUsers(1, newPageSize)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setMemberLevelFilter('')
    setStatusFilter('')
    setCurrentPage(1)
    fetchUsers(1, pageSize)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setCurrentPage(1)
    fetchUsers(1, pageSize, { search: '' })
  }

  

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 text-gray-400" />
    return sortOrder === 'asc' ? (
      <ArrowUpDown className="w-3 h-3 text-blue-400 transform rotate-180" />
    ) : (
      <ArrowUpDown className="w-3 h-3 text-blue-400" />
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col h-full">
        <div className="mb-4 flex-shrink-0">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={memberLevelFilter}
                  onChange={(e) => {
                    const newValue = e.target.value
                    setMemberLevelFilter(newValue)
                    setCurrentPage(1)
                    fetchUsers(1, pageSize, { memberLevel: newValue })
                  }}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
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
                    fetchUsers(1, pageSize, { status: newValue })
                  }}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="">全部状态</option>
                  <option value="active">正常</option>
                  <option value="banned">已封禁</option>
                </select>
                <button
                  onClick={handleResetFilters}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  重置
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-2">
              <div className="relative max-w-[200px] w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="搜索用户..."
                  className="w-full px-3 py-1.5 pr-24 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="清空搜索"
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  onClick={handleSearchSubmit}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  title="搜索"
                >
                  <Search size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
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
        </div>

        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
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
    </div>
  )
}

export default UserListPage