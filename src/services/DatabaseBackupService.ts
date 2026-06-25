import { supabase } from './supabase';
import { offlineStorage } from './offlineStorage';
import { logError, logInfo } from './loggerService';
import { 
  SyncModuleKey, 
  SyncMetadata, 
  PendingOperation, 
  ConflictItem, 
  SyncResult, 
  TableSyncResult,
  MODULE_TABLE_MAP,
  StorageLocation
} from '../types/offline';

export const syncManager = {
  async getSyncMetadata(userId: string): Promise<SyncMetadata | null> {
    try {
      return await offlineStorage.get<SyncMetadata>('sync_metadata', userId);
    } catch {
      return null;
    }
  },

  async getStorageLocation(userId: string): Promise<StorageLocation> {
    const metadata = await this.getSyncMetadata(userId);
    return metadata?.storageLocation ?? 'cloud';
  },

  async setStorageLocation(userId: string, location: StorageLocation): Promise<void> {
    const metadata = await this.getSyncMetadata(userId) || {
      id: userId,
      lastSyncTime: '1970-01-01T00:00:00Z',
      syncEnabled: false,
      storageLocation: 'cloud' as StorageLocation,
      syncModules: [
        { key: 'account', name: '账号管理', enabled: true },
        { key: 'todo', name: '待办事项', enabled: true },
        { key: 'quickReply', name: '快捷回复', enabled: true },
        { key: 'clipboard', name: '云剪贴板', enabled: false },
      ]
    };

    const oldLocation = metadata.storageLocation;
    metadata.storageLocation = location;
    metadata.lastSyncTime = new Date().toISOString();
    metadata.syncModules = metadata.syncModules.filter(m => 
      ['account', 'todo', 'quickReply', 'clipboard'].includes(m.key)
    );

    await offlineStorage.put('sync_metadata', metadata);

    if (location === 'local' && oldLocation === 'cloud') {
      await this.syncCloudToLocal(userId);
    } else if (location === 'cloud' && oldLocation === 'local') {
      await this.syncLocalToCloud(userId);
    }
  },

  async syncCloudToLocal(userId: string): Promise<void> {
    logInfo('正在将云端数据同步到本地...', 'syncManager');
    try {
      for (const [, tables] of Object.entries(MODULE_TABLE_MAP)) {
        for (const table of tables) {
          const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
          if (!error && data) {
            await offlineStorage.batchPut(table, data);
          }
        }
      }
      logInfo('云端到本地同步完成', 'syncManager');
    } catch (error) {
      logError('云端到本地同步失败', 'syncManager', error as Error);
      throw error;
    }
  },

  async syncLocalToCloud(userId: string): Promise<void> {
    logInfo('正在将本地数据同步到云端...', 'syncManager');
    try {
      for (const [, tables] of Object.entries(MODULE_TABLE_MAP)) {
        for (const table of tables) {
          interface TableRecord {
            id: string;
            user_id: string;
            [key: string]: unknown;
          }
          const localData = await offlineStorage.queryByUser<TableRecord>(table, userId);
          for (const item of localData) {
            const { data, error } = await supabase.from(table).select('id').eq('id', item.id).single();
            if (error || !data) {
              await supabase.from(table).insert(item);
            } else {
              await supabase.from(table).update(item).eq('id', item.id);
            }
          }
        }
      }
      logInfo('本地到云端同步完成', 'syncManager');
    } catch (error) {
      logError('本地到云端同步失败', 'syncManager', error as Error);
      throw error;
    }
  },

  async setSyncEnabled(userId: string, enabled: boolean): Promise<void> {
    const metadata = await this.getSyncMetadata(userId) || {
      id: userId,
      lastSyncTime: '1970-01-01T00:00:00Z',
      syncEnabled: false,
      syncModules: [
        { key: 'account', name: '账号管理', enabled: true },
        { key: 'todo', name: '待办事项', enabled: true },
        { key: 'quickReply', name: '快捷回复', enabled: true },
        { key: 'clipboard', name: '云剪贴板', enabled: false },
      ]
    };
    
    metadata.syncEnabled = enabled;
    metadata.syncModules = metadata.syncModules.filter(m => 
      ['account', 'todo', 'quickReply', 'clipboard'].includes(m.key)
    );
    await offlineStorage.put('sync_metadata', metadata);
  },

  async toggleModuleSync(userId: string, moduleKey: SyncModuleKey, enabled: boolean): Promise<void> {
    const metadata = await this.getSyncMetadata(userId);
    if (!metadata) return;
    
    metadata.syncModules = metadata.syncModules
      .filter(m => ['account', 'todo', 'quickReply', 'clipboard'].includes(m.key))
      .map(m => m.key === moduleKey ? { ...m, enabled } : m);
    await offlineStorage.put('sync_metadata', metadata);
  },

  async addPendingOperation(operation: Omit<PendingOperation, 'id' | 'createdAt'>): Promise<void> {
    const pendingOp: PendingOperation = {
      ...operation,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      createdAt: new Date().toISOString()
    };
    await offlineStorage.put('pending_operations', pendingOp);
  },

  async removePendingOperation(operationId: string): Promise<void> {
    await offlineStorage.delete('pending_operations', operationId);
  },

  async getPendingOperations(userId: string): Promise<PendingOperation[]> {
    return await offlineStorage.queryByUser('pending_operations', userId);
  },

  async syncTable(
    userId: string, 
    tableName: string, 
    storeName: string,
    incremental: boolean = true
  ): Promise<TableSyncResult> {
    try {
      const metadata = await this.getSyncMetadata(userId);
      const lastSyncTime = incremental && metadata?.lastSyncTime ? metadata.lastSyncTime : '1970-01-01T00:00:00Z';

      const { data: cloudData, error: cloudError } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', lastSyncTime);

      if (cloudError) {
        logError(`Sync failed for ${tableName}`, 'syncManager', cloudError as Error);
        return { cloudOnly: [], localOnly: [], conflicts: [], synced: 0, conflictsHandled: 0 };
      }

      interface SyncItem {
        id: string;
        updated_at: string;
        user_id: string;
        [key: string]: unknown;
      }

      const localData = await offlineStorage.queryByUser<SyncItem>(storeName, userId);
      const localIds = new Set(localData.map(item => item.id));

      const cloudOnly: SyncItem[] = [];
      const conflicts: ConflictItem[] = [];

      for (const cloudItem of cloudData || []) {
        const cloudItemTyped = cloudItem as SyncItem;
        if (!localIds.has(cloudItemTyped.id)) {
          cloudOnly.push(cloudItemTyped);
        } else {
          const localItem = localData.find(item => item.id === cloudItemTyped.id);
          if (localItem && localItem.updated_at !== cloudItemTyped.updated_at) {
            conflicts.push({
              id: `${tableName}_${cloudItemTyped.id}`,
              local: localItem,
              cloud: cloudItemTyped,
              tableName,
              recordId: cloudItemTyped.id
            });
          }
        }
      }

      if (cloudOnly.length > 0) {
        await offlineStorage.batchPut(storeName, cloudOnly);
      }

      if (conflicts.length > 0) {
        await this.handleConflicts(userId, conflicts);
      }

      return {
        cloudOnly,
        localOnly: [],
        conflicts,
        synced: cloudOnly.length,
        conflictsHandled: conflicts.length
      };
    } catch (error) {
      logError(`Sync failed for ${tableName}`, 'syncManager', error as Error);
      return { cloudOnly: [], localOnly: [], conflicts: [], synced: 0, conflictsHandled: 0 };
    }
  },

  async syncModule(userId: string, moduleKey: SyncModuleKey, incremental: boolean = true): Promise<SyncResult> {
    const tables = MODULE_TABLE_MAP[moduleKey];
    const result: SyncResult = {};

    for (const table of tables) {
      result[table] = await this.syncTable(userId, table, table, incremental);
    }

    await this.updateSyncTime(userId, moduleKey);
    
    return result;
  },

  async syncAll(userId: string, incremental: boolean = true): Promise<SyncResult> {
    const result: SyncResult = {};
    
    for (const [, tables] of Object.entries(MODULE_TABLE_MAP)) {
      for (const table of tables) {
        result[table] = await this.syncTable(userId, table, table, incremental);
      }
    }

    await this.updateSyncTime(userId);
    return result;
  },

  async handleConflicts(_userId: string, conflicts: ConflictItem[], strategy: 'auto' | 'manual' = 'auto'): Promise<void> {
    if (strategy === 'manual') {
      return;
    }

    for (const conflict of conflicts) {
      const localUpdated = new Date(conflict.local.updated_at);
      const cloudUpdated = new Date(conflict.cloud.updated_at);

      if (localUpdated > cloudUpdated) {
        const { error } = await supabase.from(conflict.tableName)
          .update(conflict.local)
          .eq('id', conflict.recordId);
        
        if (!error) {
          logInfo(`Resolved conflict: local wins for ${conflict.tableName} ${conflict.recordId}`, 'syncManager');
        }
      } else {
        await offlineStorage.put(conflict.tableName, conflict.cloud);
        logInfo(`Resolved conflict: cloud wins for ${conflict.tableName} ${conflict.recordId}`, 'syncManager');
      }
    }
  },

  async applyPendingOperations(userId: string): Promise<void> {
    const pendingOps = await this.getPendingOperations(userId);

    for (const op of pendingOps) {
      try {
        const data = op.data as Record<string, unknown>;
        switch (op.operationType) {
          case 'create':
            await supabase.from(op.tableName).insert(data);
            break;
          case 'update':
            await supabase.from(op.tableName)
              .update(data)
              .eq('id', op.recordId);
            break;
          case 'delete':
            await supabase.from(op.tableName).delete().eq('id', op.recordId);
            break;
        }
        await this.removePendingOperation(op.id);
      } catch (error) {
        logError(`Failed to apply operation ${op.id}`, 'syncManager', error as Error);
      }
    }
  },

  async updateSyncTime(userId: string, moduleKey?: SyncModuleKey): Promise<void> {
    const metadata = await this.getSyncMetadata(userId);
    if (!metadata) return;
    
    metadata.lastSyncTime = new Date().toISOString();
    metadata.syncModules = metadata.syncModules.filter(m => 
      ['account', 'todo', 'quickReply', 'clipboard'].includes(m.key)
    );
    
    if (moduleKey) {
      metadata.syncModules = metadata.syncModules.map(m => 
        m.key === moduleKey ? { ...m, lastSyncTime: metadata.lastSyncTime } : m
      );
    }
    
    await offlineStorage.put('sync_metadata', metadata);
  },

  async isSyncEnabled(userId: string): Promise<boolean> {
    const metadata = await this.getSyncMetadata(userId);
    return metadata?.syncEnabled ?? false;
  },

  async isModuleSyncEnabled(userId: string, moduleKey: SyncModuleKey): Promise<boolean> {
    const metadata = await this.getSyncMetadata(userId);
    return metadata?.syncModules.find(m => m.key === moduleKey)?.enabled ?? false;
  },

  startAutoSync(): void {
    logInfo('Auto sync feature not implemented', 'syncManager');
  },

  stopAutoSync(): void {
    logInfo('Auto sync feature not implemented', 'syncManager');
  },

  getAutoSyncStatus(): { running: boolean; interval: number } {
    return { running: false, interval: 0 };
  },

  async hasCloudUpdates(userId: string): Promise<boolean> {
    try {
      const metadata = await this.getSyncMetadata(userId);
      const lastSyncTime = metadata?.lastSyncTime || '1970-01-01T00:00:00Z';

      const tables = Object.values(MODULE_TABLE_MAP).flat();
      
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('id')
          .eq('user_id', userId)
          .gt('updated_at', lastSyncTime)
          .limit(1);

        if (!error && data && data.length > 0) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }
};

// 独立的数据库备份服务
export const databaseBackupService = {
  async exportToSQL(): Promise<string> {
    const db = await offlineStorage.init();
    const sqlLines: string[] = ['-- ToolBox Database Backup'];
    sqlLines.push(`-- Generated at: ${new Date().toISOString()}`);
    sqlLines.push('');

    for (const [moduleKey, tables] of Object.entries(MODULE_TABLE_MAP)) {
      sqlLines.push(`-- Module: ${moduleKey}`);
      for (const table of tables) {
        try {
          const data = await new Promise<unknown[]>((resolve, reject) => {
            const transaction = db.transaction(table, 'readonly');
            const store = transaction.objectStore(table);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
          });
          if (data && data.length > 0) {
            sqlLines.push(`-- Table: ${table} (${data.length} rows)`);
            for (const row of data as Record<string, unknown>[]) {
              const columns = Object.keys(row);
              const values = Object.values(row).map(v => {
                if (v === null || v === undefined) return 'NULL';
                if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
                if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
                return String(v);
              });
              sqlLines.push(`-- INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
            }
            sqlLines.push('');
          }
        } catch {
          sqlLines.push(`-- Error reading table: ${table}`);
        }
      }
    }

    return sqlLines.join('\n');
  },

  downloadSQL(sql: string): void {
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toolbox_backup_${new Date().toISOString().slice(0, 10)}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async exportData(): Promise<string> {
    const db = await offlineStorage.init();
    const exportData: Record<string, unknown[]> = {};
    
    for (const [, tables] of Object.entries(MODULE_TABLE_MAP)) {
      for (const table of tables) {
        try {
          const data = await new Promise<unknown[]>((resolve, reject) => {
            const transaction = db.transaction(table, 'readonly');
            const store = transaction.objectStore(table);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
          });
          if (data) {
            exportData[table] = data;
          }
        } catch {
          exportData[table] = [];
        }
      }
    }

    return JSON.stringify(exportData, null, 2);
  },

  downloadJSON(data: string): void {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toolbox_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async importFromJSON(jsonData: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = JSON.parse(jsonData) as Record<string, unknown[]>;
      let totalImported = 0;

      for (const [table, records] of Object.entries(data)) {
        if (Array.isArray(records)) {
          for (const record of records) {
            try {
              await offlineStorage.put(table, record as { id: string });
              totalImported++;
            } catch {
              // 忽略单条记录的错误
            }
          }
        }
      }

      return { success: true, message: `成功恢复 ${totalImported} 条数据` };
    } catch {
      return { success: false, message: '备份文件格式错误' };
    }
  }
};
