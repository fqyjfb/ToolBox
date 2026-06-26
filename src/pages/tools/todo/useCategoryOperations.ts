import { useCallback } from 'react'
import { todoServiceWrapper, CreateTodoCategoryRequest } from '../../../services/TodoService'
import { useAuthStore } from '../../../store/AuthStore'
import { useToastStore } from '../../../store/toastStore'

export const useCategoryOperations = () => {
  const user = useAuthStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)

  const createCategory = useCallback(async (categoryData: CreateTodoCategoryRequest): Promise<boolean> => {
    if (!user || !categoryData.name.trim()) return false

    const result = await todoServiceWrapper.category.createCategory(user.id, categoryData)
    if (result.success) {
      addToast({ message: '分类添加成功', type: 'success' })
      return true
    } else {
      addToast({ message: '添加分类失败', type: 'error' })
      return false
    }
  }, [user, addToast])

  const updateCategory = useCallback(async (id: string, categoryData: CreateTodoCategoryRequest): Promise<boolean> => {
    if (!user) return false

    const result = await todoServiceWrapper.category.updateCategory(user.id, id, categoryData)
    if (result.success) {
      addToast({ message: '分类修改成功', type: 'success' })
      return true
    } else {
      addToast({ message: '修改分类失败', type: 'error' })
      return false
    }
  }, [user, addToast])

  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false

    const result = await todoServiceWrapper.category.deleteCategory(user.id, id)
    if (result.success) {
      addToast({ message: '分类删除成功', type: 'success' })
      return true
    } else {
      addToast({ message: '删除分类失败', type: 'error' })
      return false
    }
  }, [user, addToast])

  return { createCategory, updateCategory, deleteCategory }
}