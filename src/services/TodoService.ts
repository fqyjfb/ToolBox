import { BaseServiceCompat as BaseService } from './entities/baseEntityService'
import { getDataAccessLayer } from './dataAccessLayer'
import { TodoCategory, Todo, CreateTodoCategoryRequest, CreateTodoRequest } from '../types/todo'
import { logError, logInfo } from './loggerService'

// 分类服务
const categoryService = {
  async getCategories(userId: string): Promise<{ success: boolean; data?: TodoCategory[]; error?: string }> {
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

  async createCategory(userId: string, request: CreateTodoCategoryRequest) {
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

  async updateCategory(userId: string, categoryId: string, request: CreateTodoCategoryRequest) {
    try {
      const dal = getDataAccessLayer(userId)
      const updates: Partial<TodoCategory> = { name: request.name }
      if (request.color !== undefined) updates.color = request.color
      if (request.parent_id !== undefined) updates.parent_id = request.parent_id || null
      const data = await dal.update<TodoCategory>('todo_categories', categoryId, updates)
      logInfo(`更新待办分类成功: ${request.name}`, 'TodoService')
      return { success: true, data }
    } catch (error) {
      logError('更新待办分类失败', 'TodoService', error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '更新分类失败' }
    }
  },

  async deleteCategory(userId: string, categoryId: string) {
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

// 待办任务服务
const todoService = {
  async getTodos(userId: string, filter?: { category_id?: string }, page: number = 1, pageSize: number = 10) {
    const baseService = new BaseService<Todo>('todos', 'TodoService')
    const filters = filter?.category_id ? { category_id: filter.category_id } : undefined
    return baseService.getList(userId, { filters }, page, pageSize)
  },

  async createTodo(userId: string, request: CreateTodoRequest) {
    const baseService = new BaseService<Todo>('todos', 'TodoService')
    const result = await baseService.create(userId, {
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
    if (result.success) {
      logInfo(`创建待办任务成功: ${request.title}`, 'TodoService')
    }
    return result
  },

  async updateTodo(userId: string, todoId: string, request: CreateTodoRequest) {
    const baseService = new BaseService<Todo>('todos', 'TodoService')
    const result = await baseService.update(userId, todoId, {
      title: request.title,
      description: request.description || null,
      due_date: request.due_date || null,
      priority: request.priority || '中',
      status: request.status || '待办',
      category_id: request.category_id || null
    })
    if (result.success) {
      logInfo(`更新待办任务成功: ${request.title}`, 'TodoService')
    }
    return result
  },

  async updateTodoStatus(userId: string, todoId: string, isCompleted: boolean) {
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

  async deleteTodo(userId: string, todoId: string) {
    const baseService = new BaseService<Todo>('todos', 'TodoService')
    const result = await baseService.delete(userId, todoId)
    if (result.success) {
      logInfo(`删除待办任务成功: ID=${todoId}`, 'TodoService')
    }
    return result
  },

  async searchTodos(userId: string, keyword: string, page: number = 1, pageSize: number = 10) {
    const baseService = new BaseService<Todo>('todos', 'TodoService')
    return baseService.search(userId, keyword, ['title', 'description'], {}, page, pageSize)
  }
}

export const todoServiceWrapper = {
  category: categoryService,
  todo: todoService
}

export type { TodoCategory, Todo, CreateTodoCategoryRequest, CreateTodoRequest }
