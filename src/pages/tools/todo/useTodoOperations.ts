import { useCallback } from 'react'
import { todoServiceWrapper, CreateTodoRequest } from '../../../services/TodoService'
import { useAuthStore } from '../../../store/AuthStore'
import { useToastStore } from '../../../store/toastStore'
import { useTodoNotification } from '../../../contexts/TodoNotificationContext'

export const useTodoOperations = () => {
  const user = useAuthStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const { refreshCount } = useTodoNotification()

  const createTodo = useCallback(async (todoData: CreateTodoRequest): Promise<boolean> => {
    if (!user || !todoData.title.trim()) return false

    const result = await todoServiceWrapper.todo.createTodo(user.id, todoData)
    if (result.success) {
      addToast({ message: '任务添加成功', type: 'success' })
      refreshCount()
      return true
    } else {
      addToast({ message: '添加任务失败', type: 'error' })
      return false
    }
  }, [user, addToast, refreshCount])

  const updateTodo = useCallback(async (id: string, todoData: CreateTodoRequest): Promise<boolean> => {
    if (!user) return false

    const result = await todoServiceWrapper.todo.updateTodo(user.id, id, todoData)
    if (result.success) {
      addToast({ message: '任务修改成功', type: 'success' })
      refreshCount()
      return true
    } else {
      addToast({ message: '修改任务失败', type: 'error' })
      return false
    }
  }, [user, addToast, refreshCount])

  const toggleComplete = useCallback(async (id: string, isCompleted: boolean): Promise<boolean> => {
    if (!user) return false

    const result = await todoServiceWrapper.todo.updateTodoStatus(user.id, id, isCompleted)
    if (result.success) {
      addToast({ message: isCompleted ? '任务已完成' : '任务已取消完成', type: 'success' })
      refreshCount()
      return true
    } else {
      addToast({ message: '更新任务状态失败', type: 'error' })
      return false
    }
  }, [user, addToast, refreshCount])

  const deleteTodo = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false

    const result = await todoServiceWrapper.todo.deleteTodo(user.id, id)
    if (result.success) {
      addToast({ message: '任务删除成功', type: 'success' })
      refreshCount()
      return true
    } else {
      addToast({ message: '删除任务失败', type: 'error' })
      return false
    }
  }, [user, addToast, refreshCount])

  return { createTodo, updateTodo, toggleComplete, deleteTodo }
}