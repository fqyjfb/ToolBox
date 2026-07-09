import { supabase } from './supabase'
import { offlineStorage } from './offlineStorage'
import { StorageLocation, SyncMetadata } from '../types/offline'
import { logError, logInfo } from './loggerService'
import { BaseEntity } from '../types/common'

type CreateInput<T extends BaseEntity> = Omit<T, keyof BaseEntity>

const SYNC_TABLES = [
  'shops', 'social_accounts', 'emails', 'phones', 'companies', 'credentials', 'general_accounts',
  'website_accounts', 'website_account_categories',
  'todos', 'todo_categories',
  'quick_replies', 'quick_reply_categories',
  'clipboard_items', 'clipboard_categories',
  'memos', 'memo_categories'
]

class StorageContext {
  private userId: string = ''
  private storageLocation: StorageLocation = 'cloud'
  private listeners: Set<(location: StorageLocation) => void> = new Set()

  async init(userId: string): Promise<void> {
    this.userId = userId
    try {
      const metadata = await offlineStorage.get<SyncMetadata>('sync_metadata', userId)
      this.storageLocation = metadata?.storageLocation ?? 'cloud'
      logInfo(`存储上下文初始化完成，模式: ${this.storageLocation}`, 'StorageContext')
    } catch (error) {
      logError('存储上下文初始化失败', 'StorageContext', error as Error)
      this.storageLocation = 'cloud'
    }
  }

  getLocation(): StorageLocation {
    return this.storageLocation
  }

  isCloudMode(): boolean {
    return this.storageLocation === 'cloud'
  }

  isLocalMode(): boolean {
    return this.storageLocation === 'local'
  }

  async setLocation(location: StorageLocation): Promise<void> {
    const oldLocation = this.storageLocation
    this.storageLocation = location

    try {
      const metadata = await offlineStorage.get<SyncMetadata>('sync_metadata', this.userId)
      const updatedMetadata: SyncMetadata = {
        ...metadata!,
        storageLocation: location,
        lastSyncTime: new Date().toISOString()
      }
      await offlineStorage.put('sync_metadata', updatedMetadata)

      this.listeners.forEach(listener => listener(location))
      logInfo(`存储位置已切换: ${oldLocation} -> ${location}`, 'StorageContext')
    } catch (error) {
      this.storageLocation = oldLocation
      logError('存储位置切换失败', 'StorageContext', error as Error)
      throw error
    }
  }

  subscribe(listener: (location: StorageLocation) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async get<T>(table: string, id: string): Promise<T | null> {
    if (this.storageLocation === 'local') {
      return await offlineStorage.get<T>(table, id)
    }

    const local = await offlineStorage.get<T>(table, id)
    if (local) return local

    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single()

      if (!error && data) {
        await offlineStorage.put(table, data)
        return data
      }
      return null
    } catch (error) {
      logError(`读取数据失败: ${table}/${id}`, 'StorageContext', error as Error)
      return null
    }
  }

  async list<T>(
    table: string,
    options?: {
      filters?: Record<string, unknown>
      orderBy?: { column: string; ascending?: boolean }
      range?: { from: number; to: number }
    }
  ): Promise<{ data: T[]; total: number }> {
    if (this.storageLocation === 'local') {
      let data = await offlineStorage.queryByUser<T>(table, this.userId)
      if (options?.filters) data = this.applyFilters(data, options.filters)
      if (options?.orderBy) data = this.applyOrderBy(data, options.orderBy.column, options.orderBy.ascending ?? true)
      const total = data.length
      if (options?.range) data = data.slice(options.range.from, options.range.to + 1)
      return { data, total }
    }

    let localData = await offlineStorage.queryByUser<T>(table, this.userId)
    if (localData.length > 0) {
      if (options?.filters) localData = this.applyFilters(localData, options.filters)
      if (options?.orderBy) localData = this.applyOrderBy(localData, options.orderBy.column, options.orderBy.ascending ?? true)
      const total = localData.length
      if (options?.range) localData = localData.slice(options.range.from, options.range.to + 1)
      return { data: localData, total }
    }

    try {
      let query = supabase.from(table).select('*', { count: 'exact' }).eq('user_id', this.userId)
      if (options?.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          if (Array.isArray(value)) {
            query = query.in(key, value)
          } else {
            query = query.eq(key, value)
          }
        }
      }
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true })
      }
      if (options?.range) {
        query = query.range(options.range.from, options.range.to)
      }

      const { data, error, count } = await query
      if (error) {
        logError(`查询失败: ${table}`, 'StorageContext', error as Error)
        return { data: [], total: 0 }
      }

      if (data && data.length > 0) {
        await offlineStorage.batchPut(table, data)
      }

      return { data: data || [], total: count || 0 }
    } catch (error) {
      logError(`查询失败: ${table}`, 'StorageContext', error as Error)
      return { data: [], total: 0 }
    }
  }

  async search<T>(
    table: string,
    keyword: string,
    searchFields: string[],
    options?: {
      orderBy?: { column: string; ascending?: boolean }
      range?: { from: number; to: number }
    }
  ): Promise<{ data: T[]; total: number }> {
    if (this.storageLocation === 'local') {
      const allData = await offlineStorage.queryByUser<T>(table, this.userId)
      const filtered = this.applySearch(allData, keyword, searchFields)
      if (options?.orderBy) {
        filtered.sort((a, b) => this.compareValues(a, b, options.orderBy!.column) * (options.orderBy!.ascending ? 1 : -1))
      }
      const total = filtered.length
      if (options?.range) {
        return { data: filtered.slice(options.range.from, options.range.to + 1), total }
      }
      return { data: filtered, total }
    }

    try {
      let query = supabase.from(table).select('*', { count: 'exact' }).eq('user_id', this.userId)
      if (searchFields.length > 0) {
        const orCondition = searchFields.map(field => `${field}.ilike.%${keyword}%`).join(',')
        query = query.or(orCondition)
      }
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true })
      }
      if (options?.range) {
        query = query.range(options.range.from, options.range.to)
      }

      const { data, error, count } = await query
      if (error) {
        logError(`搜索失败: ${table}`, 'StorageContext', error as Error)
        return { data: [], total: 0 }
      }

      if (data && data.length > 0) {
        await offlineStorage.batchPut(table, data)
      }

      return { data: data || [], total: count || 0 }
    } catch (error) {
      logError(`搜索失败: ${table}`, 'StorageContext', error as Error)
      return { data: [], total: 0 }
    }
  }

  async create<T extends BaseEntity>(
    table: string,
    data: CreateInput<T>
  ): Promise<T> {
    const record = {
      ...data,
      id: crypto.randomUUID(),
      user_id: this.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as T

    await offlineStorage.put(table, record)

    if (this.storageLocation === 'cloud') {
      try {
        const { error } = await supabase.from(table).insert(record)
        if (error) {
          logError(`创建记录同步到云端失败: ${table}`, 'StorageContext', error as Error)
        } else {
          logInfo(`创建记录成功: ${table}`, 'StorageContext')
        }
      } catch (error) {
        logError(`创建记录同步到云端失败: ${table}`, 'StorageContext', error as Error)
      }
    }

    return record
  }

  async update<T extends BaseEntity>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<T> {
    const existing = await offlineStorage.get<T>(table, id)
    if (!existing) throw new Error('记录不存在')

    const updated = { ...existing, ...data, updated_at: new Date().toISOString() } as T

    await offlineStorage.put(table, updated)

    if (this.storageLocation === 'cloud') {
      try {
        const { error } = await supabase.from(table).update(updated).eq('id', id)
        if (error) {
          logError(`更新记录同步到云端失败: ${table}`, 'StorageContext', error as Error)
        } else {
          logInfo(`更新记录成功: ${table}`, 'StorageContext')
        }
      } catch (error) {
        logError(`更新记录同步到云端失败: ${table}`, 'StorageContext', error as Error)
      }
    }

    return updated
  }

  async delete(table: string, id: string): Promise<void> {
    await offlineStorage.delete(table, id)

    if (this.storageLocation === 'cloud') {
      try {
        const { error } = await supabase.from(table).delete().eq('id', id)
        if (error) {
          logError(`删除记录同步到云端失败: ${table}`, 'StorageContext', error as Error)
        } else {
          logInfo(`删除记录成功: ${table}`, 'StorageContext')
        }
      } catch (error) {
        logError(`删除记录同步到云端失败: ${table}`, 'StorageContext', error as Error)
      }
    }
  }

  async syncCloudToLocal(): Promise<void> {
    if (this.storageLocation !== 'cloud') return

    logInfo('开始从云端同步数据到本地...', 'StorageContext')

    for (const table of SYNC_TABLES) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', this.userId)

        if (!error && data && data.length > 0) {
          await offlineStorage.batchPut(table, data)
          logInfo(`同步表 ${table} 到本地: ${data.length} 条`, 'StorageContext')
        }
      } catch (error) {
        logError(`同步表 ${table} 失败`, 'StorageContext', error as Error)
      }
    }

    logInfo('云端数据同步到本地完成', 'StorageContext')
  }

  async syncLocalToCloud(): Promise<void> {
    if (this.storageLocation !== 'local') return

    logInfo('开始从本地上传数据到云端...', 'StorageContext')

    for (const table of SYNC_TABLES) {
      try {
        const localData = await offlineStorage.queryByUser<Record<string, unknown>>(table, this.userId)

        for (const item of localData) {
          const { data } = await supabase
            .from(table)
            .select('id')
            .eq('id', item.id)
            .single()

          if (!data) {
            await supabase.from(table).insert(item)
          } else {
            await supabase.from(table).update(item).eq('id', item.id)
          }
        }

        logInfo(`同步表 ${table} 到云端: ${localData.length} 条`, 'StorageContext')
      } catch (error) {
        logError(`同步表 ${table} 到云端失败`, 'StorageContext', error as Error)
      }
    }

    logInfo('本地数据同步到云端完成', 'StorageContext')
  }

  private applyFilters<T>(data: T[], filters: Record<string, unknown>): T[] {
    return data.filter(item => {
      for (const [key, value] of Object.entries(filters)) {
        const itemValue = (item as Record<string, unknown>)[key]
        if (Array.isArray(value)) {
          if (!value.includes(itemValue)) return false
        } else {
          if (itemValue !== value) return false
        }
      }
      return true
    })
  }

  private applyOrderBy<T>(data: T[], column: string, ascending: boolean): T[] {
    return [...data].sort((a, b) => {
      const comparison = this.compareValues(a, b, column)
      return ascending ? comparison : -comparison
    })
  }

  private applySearch<T>(data: T[], keyword: string, fields: string[]): T[] {
    const lowerKeyword = keyword.toLowerCase()
    return data.filter(item => {
      return fields.some(field => {
        const value = (item as Record<string, unknown>)[field]
        return value && String(value).toLowerCase().includes(lowerKeyword)
      })
    })
  }

  private compareValues(a: unknown, b: unknown, column: string): number {
    const aVal = (a as Record<string, unknown>)[column]
    const bVal = (b as Record<string, unknown>)[column]

    if (aVal === bVal) return 0
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal)
    }

    if (aVal < bVal) return -1
    return 1
  }
}

const instances = new Map<string, StorageContext>()

export function getDataAccessLayer(userId: string): StorageContext {
  let instance = instances.get(userId)
  if (!instance) {
    instance = new StorageContext()
    instances.set(userId, instance)
  }
  return instance
}
