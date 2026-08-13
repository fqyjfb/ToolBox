import { getDataAccessLayer } from '../dataAccessLayer'
import { logError, logInfo } from '../loggerService'
import { ListResponse, BaseEntity, ServiceResponse } from '../../types/common'

export interface ListOptions {
  filters?: Record<string, unknown>
  orderBy?: { column: string; ascending?: boolean }
  range?: { from: number; to: number }
}

export interface SearchOptions {
  orderBy?: { column: string; ascending?: boolean }
  range?: { from: number; to: number }
}

export abstract class BaseEntityService<T extends BaseEntity> {
  protected tableName: string
  protected serviceName: string
  protected searchFields: string[]

  constructor(tableName: string, serviceName: string, searchFields: string[] = []) {
    this.tableName = tableName
    this.serviceName = serviceName
    this.searchFields = searchFields
  }

  protected async afterRead(item: T): Promise<T> {
    return item
  }

  protected async beforeCreate(data: Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
    return data
  }

  protected async beforeUpdate(data: Partial<T>): Promise<Partial<T>> {
    return data
  }

  private async processList(list: T[]): Promise<T[]> {
    return Promise.all(list.map(item => this.afterRead(item)))
  }

  async getList(userId: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<T>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.list<T>(this.tableName, {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })
      const processedList = await this.processList(data)
      return { list: processedList, total }
    } catch (error) {
      logError(`获取列表失败: ${this.tableName}`, this.serviceName, error instanceof Error ? error : undefined)
      throw error
    }
  }

  async create(userId: string, request: Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<T> {
    try {
      const dal = getDataAccessLayer(userId)
      const processedData = await this.beforeCreate(request)
      const data = await dal.create<T>(this.tableName, processedData)
      logInfo(`创建记录成功: ${this.tableName}`, this.serviceName)
      return this.afterRead(data)
    } catch (error) {
      logError(`创建记录失败: ${this.tableName}`, this.serviceName, error instanceof Error ? error : undefined)
      throw error
    }
  }

  async update(userId: string, id: string, request: Partial<T>): Promise<T> {
    try {
      const dal = getDataAccessLayer(userId)
      const processedData = await this.beforeUpdate(request)
      const data = await dal.update<T>(this.tableName, id, processedData)
      logInfo(`更新记录成功: ${this.tableName}/${id}`, this.serviceName)
      return this.afterRead(data)
    } catch (error) {
      logError(`更新记录失败: ${this.tableName}/${id}`, this.serviceName, error instanceof Error ? error : undefined)
      throw error
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    try {
      const dal = getDataAccessLayer(userId)
      await dal.delete(this.tableName, id)
      logInfo(`删除记录成功: ${this.tableName}/${id}`, this.serviceName)
    } catch (error) {
      logError(`删除记录失败: ${this.tableName}/${id}`, this.serviceName, error instanceof Error ? error : undefined)
      throw error
    }
  }

  async search(userId: string, keyword: string, page: number = 1, pageSize: number = 10): Promise<ListResponse<T>> {
    try {
      const dal = getDataAccessLayer(userId)
      const { data, total } = await dal.search<T>(this.tableName, keyword, this.searchFields, {
        orderBy: { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })
      const processedList = await this.processList(data)
      return { list: processedList, total }
    } catch (error) {
      logError(`搜索失败: ${this.tableName}`, this.serviceName, error instanceof Error ? error : undefined)
      throw error
    }
  }

  // ===== ServiceResponse 兼容层：用于迁移旧 BaseService 的调用方 =====

  async getListCompat(
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
        range: options.range || { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })
      const processedList = await this.processList(data)
      return { success: true, data: { data: processedList, total } }
    } catch (error) {
      logError(`获取列表失败: ${this.tableName}`, this.serviceName, error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '获取列表失败' }
    }
  }

  async getByIdCompat(userId: string, id: string): Promise<ServiceResponse<T>> {
    try {
      const dal = getDataAccessLayer(userId)
      const data = await dal.get<T>(this.tableName, id)
      if (data) {
        const processed = await this.afterRead(data)
        return { success: true, data: processed }
      }
      return { success: false, error: '记录不存在' }
    } catch (error) {
      logError(`获取详情失败: ${this.tableName}/${id}`, this.serviceName, error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '获取详情失败' }
    }
  }

  async createCompat(
    userId: string,
    request: Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<ServiceResponse<T>> {
    try {
      const processedData = await this.beforeCreate(request)
      const dal = getDataAccessLayer(userId)
      const result = await dal.create<T>(this.tableName, processedData)
      logInfo(`创建记录成功: ${this.tableName}`, this.serviceName)
      return { success: true, data: await this.afterRead(result) }
    } catch (error) {
      logError(`创建记录失败: ${this.tableName}`, this.serviceName, error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '创建记录失败' }
    }
  }

  async updateCompat(
    userId: string,
    id: string,
    request: Partial<T>
  ): Promise<ServiceResponse<T>> {
    try {
      const processedData = await this.beforeUpdate(request)
      const dal = getDataAccessLayer(userId)
      const result = await dal.update<T>(this.tableName, id, processedData)
      logInfo(`更新记录成功: ${this.tableName}/${id}`, this.serviceName)
      return { success: true, data: await this.afterRead(result) }
    } catch (error) {
      logError(`更新记录失败: ${this.tableName}/${id}`, this.serviceName, error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '更新记录失败' }
    }
  }

  async deleteCompat(userId: string, id: string): Promise<ServiceResponse<void>> {
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

  async searchCompat(
    userId: string,
    keyword: string,
    searchFields: string[] = this.searchFields,
    options: SearchOptions = {},
    page: number = 1,
    pageSize: number = 10
  ): Promise<ServiceResponse<{ data: T[]; total: number }>> {
    try {
      const dal = getDataAccessLayer(userId)
      const fields = searchFields.length > 0 ? searchFields : this.searchFields
      const { data, total } = await dal.search<T>(this.tableName, keyword, fields, {
        orderBy: options.orderBy || { column: 'created_at', ascending: false },
        range: { from: (page - 1) * pageSize, to: page * pageSize - 1 }
      })
      const processedList = await this.processList(data)
      return { success: true, data: { data: processedList, total } }
    } catch (error) {
      logError(`搜索失败: ${this.tableName}`, this.serviceName, error instanceof Error ? error : undefined)
      return { success: false, error: error instanceof Error ? error.message : '搜索失败' }
    }
  }
}

/**
 * （SimpleService 设计已废弃：BaseServiceCompat 直接实现旧版契约，
 *  使用 BaseServiceCompat 作为旧 BaseService 的替代品即可）
 */

/**
 * 兼容旧 BaseService 的调用：将 BaseEntityService 的子类作为简单 Service
 * 通过 `BaseService<T>(tableName, serviceName)` 直接实例化，相当于旧版 BaseService。
 * 对外部使用者来说，用法与 `new BaseService<T>('todos', 'TodoService')` 完全一致。
 */
export class BaseServiceCompat<T extends BaseEntity> {
  private impl: BaseEntityService<T>

  constructor(tableName: string, serviceName: string = 'BaseService') {
    // 使用一个临时扩展的非抽象子类承载
    class Impl extends BaseEntityService<T> { }
    this.impl = new Impl(tableName, serviceName, [])
  }

  async getList(
    userId: string,
    options: ListOptions = {},
    page: number = 1,
    pageSize: number = 10,
  ) {
    return this.impl.getListCompat(userId, options, page, pageSize)
  }

  async getById(userId: string, id: string) {
    return this.impl.getByIdCompat(userId, id)
  }

  async create(
    userId: string,
    data: Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  ) {
    return this.impl.createCompat(userId, data)
  }

  async update(userId: string, id: string, data: Partial<T>) {
    return this.impl.updateCompat(userId, id, data)
  }

  async delete(userId: string, id: string) {
    return this.impl.deleteCompat(userId, id)
  }

  async search(
    userId: string,
    keyword: string,
    searchFields: string[],
    options: SearchOptions = {},
    page: number = 1,
    pageSize: number = 10,
  ) {
    return this.impl.searchCompat(userId, keyword, searchFields, options, page, pageSize)
  }
}