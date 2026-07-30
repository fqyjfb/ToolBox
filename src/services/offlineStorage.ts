import { logError, logInfo } from './loggerService';
import { sqliteClient } from './sqliteClient';

const STORES = [
  'shops', 'social_accounts', 'emails', 'phones', 'companies', 'credentials', 'general_accounts',
  'website_accounts', 'website_account_categories',
  'todos', 'todo_categories',
  'quick_replies', 'quick_reply_categories',
  'clipboard_items', 'clipboard_categories',
  'memos', 'memo_categories',
  'sync_metadata', 'pending_operations'
];

let initPromise: Promise<void> | null = null;

export const offlineStorage = {
  async init(): Promise<void> {
    if (initPromise) {
      return initPromise;
    }

    initPromise = (async () => {
      if (sqliteClient.isAvailable()) {
        try {
          await sqliteClient.init();
          logInfo('SQLite 本地存储初始化完成', 'offlineStorage');
        } catch (error) {
          logError('SQLite 初始化失败，将在查询时重试', 'offlineStorage', error as Error);
          initPromise = null;
        }
      }
    })();

    return initPromise;
  },

  async get<T>(storeName: string, id: string): Promise<T | null> {
    try {
      return await sqliteClient.get<T>(storeName, id);
    } catch (error) {
      logError(`读取数据失败: ${storeName}/${id}`, 'offlineStorage', error as Error);
      return null;
    }
  },

  async queryByUser<T>(storeName: string, userId: string): Promise<T[]> {
    try {
      const results = await sqliteClient.queryByUser<T>(storeName, userId);
      return results || [];
    } catch (error) {
      logError(`按用户查询失败: ${storeName}`, 'offlineStorage', error as Error);
      return [];
    }
  },

  async queryByTimeRange<T extends { user_id: string }>(
    storeName: string,
    userId: string,
    startTime: string,
    endTime?: string
  ): Promise<T[]> {
    try {
      const results = await sqliteClient.queryByTimeRange<T>(storeName, userId, startTime, endTime);
      return results || [];
    } catch (error) {
      logError(`按时间范围查询失败: ${storeName}`, 'offlineStorage', error as Error);
      return [];
    }
  },

  async put<T extends { id: string }>(storeName: string, data: T): Promise<void> {
    try {
      await sqliteClient.put(storeName, data);
    } catch (error) {
      logError(`写入数据失败: ${storeName}`, 'offlineStorage', error as Error);
    }
  },

  async batchPut<T extends { id: string }>(storeName: string, data: T[]): Promise<void> {
    try {
      await sqliteClient.batchPut(storeName, data);
    } catch (error) {
      logError(`批量写入失败: ${storeName}`, 'offlineStorage', error as Error);
    }
  },

  async delete(storeName: string, id: string): Promise<void> {
    try {
      await sqliteClient.delete(storeName, id);
    } catch (error) {
      logError(`删除数据失败: ${storeName}/${id}`, 'offlineStorage', error as Error);
    }
  },

  async batchDelete(storeName: string, ids: string[]): Promise<void> {
    try {
      await sqliteClient.batchDelete(storeName, ids);
    } catch (error) {
      logError(`批量删除失败: ${storeName}`, 'offlineStorage', error as Error);
    }
  },

  async clear(storeName: string): Promise<void> {
    try {
      await sqliteClient.clear(storeName);
    } catch (error) {
      logError(`清空存储失败: ${storeName}`, 'offlineStorage', error as Error);
    }
  },

  async clearByUser(userId: string): Promise<void> {
    try {
      for (const table of STORES) {
        await sqliteClient.clearByUser(table, userId);
      }
      logInfo(`已清除用户 ${userId} 的本地数据`, 'offlineStorage');
    } catch (error) {
      logError('清除用户数据失败', 'offlineStorage', error as Error);
    }
  },

  async getStoredUsers(): Promise<string[]> {
    try {
      return await sqliteClient.getStoredUsers();
    } catch (error) {
      logError('获取存储用户列表失败', 'offlineStorage', error as Error);
      return [];
    }
  },

  async getStorageSize(): Promise<{ used: number; quota: number }> {
    try {
      const size = await sqliteClient.getDatabaseSize();
      return { used: size, quota: 0 };
    } catch {
      return { used: 0, quota: 0 };
    }
  },

  async getStorageStats(userId: string): Promise<{
    websites: number;
    shops: number;
    social: number;
    emails: number;
    phones: number;
    companies: number;
    credentials: number;
    generalAccounts: number;
    todo: number;
    quickReply: number;
    clipboard: number;
    total: number;
  }> {
    try {
      const stats = await sqliteClient.getStorageStats(userId);
      return {
        websites: stats.websites || 0,
        shops: stats.shops || 0,
        social: stats.social || 0,
        emails: stats.emails || 0,
        phones: stats.phones || 0,
        companies: stats.companies || 0,
        credentials: stats.credentials || 0,
        generalAccounts: stats.generalAccounts || 0,
        todo: stats.todo || 0,
        quickReply: stats.quickReply || 0,
        clipboard: stats.clipboard || 0,
        total: stats.total || 0,
      };
    } catch (error) {
      logError('获取存储统计失败', 'offlineStorage', error as Error);
      return {
        websites: 0, shops: 0, social: 0, emails: 0, phones: 0,
        companies: 0, credentials: 0, generalAccounts: 0,
        todo: 0, quickReply: 0, clipboard: 0, total: 0,
      };
    }
  },

  async exportUserData(userId: string): Promise<string> {
    try {
      return await sqliteClient.exportUserData(userId);
    } catch (error) {
      logError('导出用户数据失败', 'offlineStorage', error as Error);
      return '';
    }
  },

  async importUserData(userId: string, data: string): Promise<{ success: boolean; imported: number; failed: number }> {
    try {
      return await sqliteClient.importUserData(userId, data);
    } catch (error) {
      logError('导入用户数据失败', 'offlineStorage', error as Error);
      return { success: false, imported: 0, failed: 0 };
    }
  },

  async clearByUserWithProgress(
    userId: string,
    onProgress?: (progress: number, message: string) => void
  ): Promise<void> {
    try {
      const totalStores = STORES.length;
      let completed = 0;

      onProgress?.(0, '开始清除用户数据...');

      for (const storeName of STORES) {
        await sqliteClient.clearByUser(storeName, userId);
        completed++;
        const progress = Math.round((completed / totalStores) * 100);
        onProgress?.(progress, `已清理 ${storeName}`);
      }

      onProgress?.(100, '清理完成');
      logInfo(`已清除用户 ${userId} 的本地数据`, 'offlineStorage');
    } catch (error) {
      logError('清除用户数据失败', 'offlineStorage', error as Error);
    }
  },
};

offlineStorage.init();