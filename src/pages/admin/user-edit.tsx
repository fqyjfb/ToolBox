import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X } from 'lucide-react'
import { userService } from '../../services/UserService'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useToastStore } from '../../store/toastStore'

const UserEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToastStore()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
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

  useEffect(() => {
    const fetchUser = async () => {
      if (!id) return
      setIsLoading(true)
      const result = await userService.getUserDetail(id)
      if (result.success) {
        setUser(result.data)
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
      } else {
        addToast({ type: 'error', message: result.message || '获取用户信息失败' })
      }
      setIsLoading(false)
    }
    fetchUser()
  }, [id])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const handleSubmit = async () => {
    if (!id) return
    
    setIsLoading(true)
    const result = await userService.updateUser(id, formData)
    if (result.success) {
      addToast({ type: 'success', message: result.message })
      navigate('/admin/users')
    } else {
      addToast({ type: 'error', message: result.message })
    }
    setIsLoading(false)
  }

  const handleCancel = () => {
    navigate('/admin/users')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <p className="text-gray-600 dark:text-gray-400">用户不存在</p>
          <button
            onClick={handleCancel}
            className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            返回列表
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col h-full">
        <div className="mb-4 flex-shrink-0 flex items-center justify-between">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft size={16} />
            <span>返回</span>
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">编辑用户</h2>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
              title="取消"
            >
              <X size={16} />
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="p-1.5 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="保存"
            >
              <Check size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  用户名
                </label>
                <input
                  type="text"
                  value={user.username}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  姓名
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  邮箱
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  手机号
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  会员等级
                </label>
                <select
                  name="memberLevel"
                  value={formData.memberLevel}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="普通">普通</option>
                  <option value="VIP">VIP</option>
                  <option value="SVIP">SVIP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  VIP到期时间
                </label>
                <input
                  type="date"
                  name="vipExpireAt"
                  value={formData.vipExpireAt ? formData.vipExpireAt.split('T')[0] : ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={formData.memberLevel === '普通'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  生日
                </label>
                <input
                  type="date"
                  name="birthday"
                  value={formData.birthday ? formData.birthday.split('T')[0] : ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    封禁用户
                  </label>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                地址
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default UserEditPage