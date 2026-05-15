import { supabase } from './supabase'
import { logError } from './loggerService';

export interface BackupInfo {
  version: string
  timestamp: string
  tables: string[]
  recordCount: number
}

export interface TableData {
  profiles: Record<string, unknown>[]
  users: Record<string, unknown>[]
  announcements: Record<string, unknown>[]
  blog_categories: Record<string, unknown>[]
  blog_posts: Record<string, unknown>[]
  blog_comments: Record<string, unknown>[]
  clipboard_categories: Record<string, unknown>[]
  clipboard_items: Record<string, unknown>[]
  password_categories: Record<string, unknown>[]
  passwords: Record<string, unknown>[]
  tiktok_forms: Record<string, unknown>[]
  tiktok_form_fields: Record<string, unknown>[]
  tiktok_customers: Record<string, unknown>[]
  tiktok_settings: Record<string, unknown>[]
  tiktok_sync_configs: Record<string, unknown>[]
  quick_reply_categories: Record<string, unknown>[]
  quick_replies: Record<string, unknown>[]
  categories: Record<string, unknown>[]
  bookmarks: Record<string, unknown>[]
  user_favorites: Record<string, unknown>[]
  tool_categories: Record<string, unknown>[]
  tools: Record<string, unknown>[]
}

export interface BackupData extends TableData {
  _info?: BackupInfo
}

class DatabaseBackupService {
  private tables: (keyof TableData)[] = [
    'profiles', 'users', 'announcements', 'blog_categories', 'blog_posts', 
    'blog_comments', 'clipboard_categories', 'clipboard_items', 
    'password_categories', 'passwords', 'tiktok_forms', 'tiktok_form_fields', 
    'tiktok_customers', 'tiktok_settings', 'tiktok_sync_configs', 
    'quick_reply_categories', 'quick_replies', 'categories', 'bookmarks', 
    'user_favorites', 'tool_categories', 'tools'
  ]

  async exportToSQL(): Promise<string> {
    try {
      const backupData = await this.exportData()
      return this.generateSQL(backupData)
    } catch (error) {
      logError('导出SQL失败', 'DatabaseBackupService', error as Error);
      throw error;
    }
  }

  async exportData(): Promise<BackupData> {
    try {
      const backupData: Partial<TableData> = {} as Partial<TableData>
      let totalRecords = 0

      for (const table of this.tables) {
        try {
          const { data, error } = await supabase.from(table).select('*')
          if (error) {
            logError(`导出表 ${table} 失败`, 'DatabaseBackupService', error as Error);
            backupData[table] = []
          } else {
            backupData[table] = data || []
            totalRecords += (data || []).length
          }
        } catch (error) {
          logError(`导出表 ${table} 失败`, 'DatabaseBackupService', error as Error);
          backupData[table] = []
        }
      }

      const info: BackupInfo = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        tables: this.tables as string[],
        recordCount: totalRecords
      }

      return { _info: info, ...backupData } as BackupData
    } catch (error) {
      logError('导出数据失败', 'DatabaseBackupService', error as Error);
      throw error;
    }
  }

  private generateSQL(backupData: BackupData): string {
    const timestamp = new Date().toISOString()
    let sql = '-- ToolBox 数据库备份\n-- 备份时间: ' + timestamp + '\n-- 版本: 1.0\n\nBEGIN TRANSACTION;\n\n'

    for (const table of this.tables) {
      const records = backupData[table] || []
      
      if (records.length === 0) {
        sql += '-- 表 ' + table + ' 无数据\n\n'
        continue
      }

      sql += '-- 表: ' + table + '\n'
      sql += 'DELETE FROM ' + table + ';\n'

      for (const record of records) {
        const columns = Object.keys(record).join(', ')
        const values = Object.values(record).map(value => this.formatValue(value)).join(', ')
        sql += 'INSERT INTO ' + table + ' (' + columns + ') VALUES (' + values + ');\n'
      }

      sql += '\n'
    }

    sql += 'COMMIT;\n'
    return sql
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    if (typeof value === 'number') return value.toString()
    if (typeof value === 'object') return '\'' + JSON.stringify(value).replace(/'/g, "''") + '\''
    return '\'' + String(value).replace(/'/g, "''") + '\''
  }

  async importFromJSON(jsonData: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = JSON.parse(jsonData) as BackupData
      return await this.importData(data)
    } catch (error) {
      logError('导入JSON失败', 'DatabaseBackupService', error as Error);
      return { success: false, message: '无效的JSON格式' }
    }
  }

  async importData(data: BackupData): Promise<{ success: boolean; message: string }> {
    try {
      for (const table of this.tables) {
        const records = data[table] || []
        if (records.length === 0) continue

        await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from(table).insert(records)
      }

      return { success: true, message: '数据恢复成功' }
    } catch (error) {
      logError('数据恢复失败', 'DatabaseBackupService', error as Error);
      return { success: false, message: '数据恢复失败: ' + (error as Error).message }
    }
  }

  downloadSQL(sql: string, filename?: string): void {
    const blob = new Blob([sql], { type: 'text/sql' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'backup_' + new Date().toISOString().slice(0, 10) + '.sql'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  downloadJSON(data: BackupData, filename?: string): void {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'backup_' + new Date().toISOString().slice(0, 10) + '.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

export const databaseBackupService = new DatabaseBackupService()
