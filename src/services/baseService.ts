import { getDataAccessLayer } from './dataAccessLayer'
import { logError, logInfo } from './loggerService'

interface ServiceResponse<T> {
  success: boolean
  data?: T
  error?: string
}

interface ListOptions {
  filters?: Record<string, unknown>
  orderBy?: { column: string; ascending?: boolean }
  range?: { from: number; to: number }
}

interface SearchOptions {
  orderBy?: { column: string; ascending?: boolean }
  range?: { from: number; to: number }
}

export class BaseService<T extends { id: string; user_id: string; created_at: string; updated_at: string }> {
  protected tableName: string
  protected serviceName: string

  constructor(tableName: string, serviceName: string = 'BaseService') {
    this.tableName = tableName
    this.serviceName = serviceName
  }

  async getList(
    userId: string,
    options: ListOptions = {},
    page: number = 1,
    pageSize: number = 10
  ): Promise<ServiceResponse<{ data: T[]; total: number }>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.list<T>(this.tableName, {
        filters: options.filters,
        orderBy: options.orderBy || { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })
      return { success: true, data: { data, total } }
    } catch (error) {
      logError(`获取列表失败: ${this.tableName}`, this.serviceName, error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '获取列表失败' }
    }
  }

  async getById(userId: string, id: string): Promise<ServiceResponse<T>> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.get<T>(this.tableName, id)
      if (data) {
        return { success: true, data }
      }
      return { success: false, error: '记录不存在' }
    } catch (error) {
      logError(`获取详情失败: ${this.tableName}/${id}`, this.serviceName, error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '获取详情失败' }
    }
  }

  async create(
    userId: string,
    data: Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<ServiceResponse<T>> {
    try {
      const dal = getDataAccessLayer(userId)
      const result = await dal.create<T>(this.tableName, data)
      logInfo(`创建记录成功: ${this.tableName}`, this.serviceName)
      return { success: true, data: result }
    } catch (error) {
      logError(`创建记录失败: ${this.tableName}`, this.serviceName, error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '创建记录失败' }
    }
  }

  async update(
    userId: string,
    id: string,
    data: Partial<T>
  ): Promise<ServiceResponse<T>> {
    try {
      const dal = getDataAccessLayer(userId)
      const result = await dal.update<T>(this.tableName, id, data)
      logInfo(`更新记录成功: ${this.tableName}/${id}`, this.serviceName)
      return { success: true, data: result }
    } catch (error) {
      logError(`更新记录失败: ${this.tableName}/${id}`, this.serviceName, error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '更新记录失败' }
    }
  }

  async delete(userId: string, id: string): Promise<ServiceResponse<void>> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete(this.tableName, id)
      logInfo(`删除记录成功: ${this.tableName}/${id}`, this.serviceName)
      return { success: true }
    } catch (error) {
      logError(`删除记录失败: ${this.tableName}/${id}`, this.serviceName, error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '删除记录失败' }
    }
  }

  async search(
    userId: string,
    keyword: string,
    searchFields: string[],
    options: SearchOptions = {},
    page: number = 1,
    pageSize: number = 10
  ): Promise<ServiceResponse<{ data: T[]; total: number }>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.search<T>(this.tableName, keyword, searchFields, {
        orderBy: options.orderBy || { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })
      return { success: true, data: { data, total } }
    } catch (error) {
      logError(`搜索失败: ${this.tableName}`, this.serviceName, error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '搜索失败' }
    }
  }
}

export type { ServiceResponse, ListOptions, SearchOptions }
