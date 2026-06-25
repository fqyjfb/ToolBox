import { useCallback } from 'react'
import { todoServiceWrapper, CreateTodoCategoryRequest } from '../../../services/TodoService'
import { useAuthStore } from '../../../store/AuthStore'
import { useToastStore } from '../../../store/toastStore'

export const useCategoryOperations = () => {
  const admin = useAuthStore((state) => state.admin)
  const addToast = useToastStore((state) => state.addToast)

  const createCategory = useCallback(async (categoryData: CreateTodoCategoryRequest): Promise<boolean> => {
    if (!admin || !categoryData.name.trim()) return false

    const result = await todoServiceWrapper.category.createCategory(admin.id, categoryData)
    if (result.success) {
      addToast({ message: '分类添加成功', type: 'success' })
      return true
    } else {
      addToast({ message: '添加分类失败', type: 'error' })
      return false
    }
  }, [admin, addToast])

  const updateCategory = useCallback(async (id: string, categoryData: CreateTodoCategoryRequest): Promise<boolean> => {
    if (!admin) return false

    const result = await todoServiceWrapper.category.updateCategory(admin.id, id, categoryData)
    if (result.success) {
      addToast({ message: '分类修改成功', type: 'success' })
      return true
    } else {
      addToast({ message: '修改分类失败', type: 'error' })
      return false
    }
  }, [admin, addToast])

  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    if (!admin) return false

    const result = await todoServiceWrapper.category.deleteCategory(admin.id, id)
    if (result.success) {
      addToast({ message: '分类删除成功', type: 'success' })
      return true
    } else {
      addToast({ message: '删除分类失败', type: 'error' })
      return false
    }
  }, [admin, addToast])

  return { createCategory, updateCategory, deleteCategory }
}