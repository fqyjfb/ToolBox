import { getDataAccessLayer } from './dataAccessLayer'
import { TodoCategory, Todo, CreateTodoCategoryRequest, CreateTodoRequest } from '../types/todo'
import { logError, logInfo } from './loggerService'

interface ServiceResponse<T> {
  success: boolean
  data?: T
  error?: string
}

const categoryService = {
  async getCategories(userId: string): Promise<ServiceResponse<TodoCategory[]>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data } = await dal.list<TodoCategory>('todo_categories', {
        orderBy: { column: 'created_at', ascending: false }
      })
      return { success: true, data }
    } catch (error) {
      logError('获取待办分类失败', 'TodoService', error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '获取分类失败' }
    }
  },

  async createCategory(userId: string, request: CreateTodoCategoryRequest): Promise<ServiceResponse<TodoCategory>> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.create<TodoCategory>('todo_categories', {
        name: request.name,
        color: request.color || '#3B82F6',
        parent_id: request.parent_id || null,
        order: 0
      })
      logInfo(`创建待办分类成功: ${request.name}`, 'TodoService')
      return { success: true, data }
    } catch (error) {
      logError('创建待办分类失败', 'TodoService', error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '创建分类失败' }
    }
  },

  async updateCategory(userId: string, categoryId: string, request: CreateTodoCategoryRequest): Promise<ServiceResponse<TodoCategory>> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.update<TodoCategory>('todo_categories', categoryId, {
        name: request.name,
        color: request.color,
        parent_id: request.parent_id || null
      })
      logInfo(`更新待办分类成功: ${request.name}`, 'TodoService')
      return { success: true, data }
    } catch (error) {
      logError('更新待办分类失败', 'TodoService', error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '更新分类失败' }
    }
  },

  async deleteCategory(userId: string, categoryId: string): Promise<ServiceResponse<void>> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('todo_categories', categoryId)
      logInfo(`删除待办分类成功: ID=${categoryId}`, 'TodoService')
      return { success: true }
    } catch (error) {
      logError('删除待办分类失败', 'TodoService', error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '删除分类失败' }
    }
  }
}

const todoService = {
  async getTodos(userId: string, filter?: { category_id?: string }, page: number = 1, pageSize: number = 10): Promise<ServiceResponse<{ data: Todo[]; total: number }>> {
    try {
      const dal = getDataAccessLayer(userId)
      const filters = filter?.category_id ? { category_id: filter.category_id } : undefined
      const { data, total } = await dal.list<Todo>('todos', {
        filters,
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })
      return { success: true, data: { data, total } }
    } catch (error) {
      logError('获取待办任务失败', 'TodoService', error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '获取任务失败' }
    }
  },

  async createTodo(userId: string, request: CreateTodoRequest): Promise<ServiceResponse<Todo>> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.create<Todo>('todos', {
        title: request.title,
        description: request.description || null,
        due_date: request.due_date || null,
        priority: request.priority || '中',
        status: request.status || '待办',
        category_id: request.category_id || null,
        is_completed: false,
        completed_at: null,
        order: 0
      })
      logInfo(`创建待办任务成功: ${request.title}`, 'TodoService')
      return { success: true, data }
    } catch (error) {
      logError('创建待办任务失败', 'TodoService', error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '创建任务失败' }
    }
  },

  async updateTodo(userId: string, todoId: string, request: CreateTodoRequest): Promise<ServiceResponse<Todo>> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.update<Todo>('todos', todoId, {
        title: request.title,
        description: request.description || null,
        due_date: request.due_date || null,
        priority: request.priority || '中',
        status: request.status || '待办',
        category_id: request.category_id || null
      })
      logInfo(`更新待办任务成功: ${request.title}`, 'TodoService')
      return { success: true, data }
    } catch (error) {
      logError('更新待办任务失败', 'TodoService', error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '更新任务失败' }
    }
  },

  async updateTodoStatus(userId: string, todoId: string, isCompleted: boolean): Promise<ServiceResponse<Todo>> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.update<Todo>('todos', todoId, {
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
        status: isCompleted ? '已完成' : '待办'
      })
      logInfo(`更新待办任务状态成功: ID=${todoId}, 完成=${isCompleted}`, 'TodoService')
      return { success: true, data }
    } catch (error) {
      logError('更新待办状态失败', 'TodoService', error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '更新任务状态失败' }
    }
  },

  async deleteTodo(userId: string, todoId: string): Promise<ServiceResponse<void>> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete('todos', todoId)
      logInfo(`删除待办任务成功: ID=${todoId}`, 'TodoService')
      return { success: true }
    } catch (error) {
      logError('删除待办任务失败', 'TodoService', error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '删除任务失败' }
    }
  },

  async searchTodos(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ServiceResponse<{ data: Todo[]; total: number }>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.search<Todo>('todos', keyword, ['title', 'description'], {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })
      return { success: true, data: { data, total } }
    } catch (error) {
      logError('搜索待办任务失败', 'TodoService', error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '搜索任务失败' }
    }
  }
}

export const todoServiceWrapper = {
  category: categoryService,
  todo: todoService
}

export type { ServiceResponse, TodoCategory, Todo, CreateTodoCategoryRequest, CreateTodoRequest }
