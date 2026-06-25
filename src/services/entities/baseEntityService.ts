import { getDataAccessLayer } from '../dataAccessLayer'
import { logError, logInfo } from '../loggerService'
import { ListResponse, BaseEntity } from '../../types/common'

export abstract class BaseEntityService<T extends BaseEntity> {
  protected tableName: string
  protected serviceName: string
  protected searchFields: string[]

  constructor(tableName: string, serviceName: string, searchFields: string[]) {
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
}