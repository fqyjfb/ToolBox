import { supabase } from './supabase';
import { offlineStorage } from './offlineStorage';
import { getDataAccessLayer } from './dataAccessLayer';
import { logError, logInfo } from './loggerService';
import {
  SyncModuleKey,
  SyncModule,
  SyncMetadata,
  PendingOperation,
  ConflictItem,
  SyncResult,
  TableSyncResult,
  MODULE_TABLE_MAP,
  StorageLocation,
  SyncRecord,
  classifySyncError,
  SyncErrorDetail
} from '../types/offline';

// 有效同步模块键列表（需与 MODULE_TABLE_MAP 保持一致，否则对应模块配置会被 filterValidModules 丢弃）
const VALID_MODULE_KEYS: readonly SyncModuleKey[] = ['account', 'todo', 'quickReply', 'clipboard', 'memo', 'reminder'];

// 默认同步模块（含 reminder，需与 VALID_MODULE_KEYS 保持一致）
const DEFAULT_SYNC_MODULES: SyncModule[] = [
  { key: 'account', name: '账号管理', enabled: true },
  { key: 'todo', name: '待办事项', enabled: true },
  { key: 'quickReply', name: '快捷回复', enabled: true },
  { key: 'clipboard', name: '云剪贴板', enabled: false },
  { key: 'memo', name: '备忘录', enabled: true },
  { key: 'reminder', name: '定时提醒', enabled: true },
];

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// 过滤出有效的同步模块
function filterValidModules(modules: SyncMetadata['syncModules']): SyncMetadata['syncModules'] {
  return modules.filter(m => VALID_MODULE_KEYS.includes(m.key));
}

// 同步并发控制锁
let isSyncingLock = false;

// 表同步最大并发数
const SYNC_CONCURRENCY = 3;

// 分批并发执行表同步任务
async function syncTablesWithConcurrency(
  tables: string[],
  task: (table: string) => Promise<void>
): Promise<void> {
  for (let i = 0; i < tables.length; i += SYNC_CONCURRENCY) {
    const batch = tables.slice(i, i + SYNC_CONCURRENCY);
    await Promise.all(batch.map(task));
  }
}

// 同步项类型（云端/本地通用结构）
type SyncItem = SyncRecord;

// 同步进度回调附加信息
export interface SyncProgressInfo {
  currentTable: string;
  completedTables: number;
  totalTables: number;
  tableResult?: TableSyncResult;
}

export const syncManager = {
  async getSyncMetadata(userId: string): Promise<SyncMetadata | null> {
    try {
      let metadata = await offlineStorage.get<SyncMetadata>('sync_metadata', userId);
      if (!metadata) {
        metadata = {
          id: userId,
          user_id: userId,
          lastSyncTime: '1970-01-01T00:00:00Z',
          syncEnabled: false,
          storageLocation: 'cloud',
          syncModules: DEFAULT_SYNC_MODULES,
        };
        await offlineStorage.put('sync_metadata', metadata);
        return metadata;
      }

      const defaultModules: SyncModule[] = DEFAULT_SYNC_MODULES;

      const existingKeys = new Set(metadata.syncModules?.map(m => m.key) || []);
      const missingModules = defaultModules.filter(m => !existingKeys.has(m.key));

      if (missingModules.length > 0) {
        metadata.syncModules = [...(metadata.syncModules || []), ...missingModules];
        await offlineStorage.put('sync_metadata', metadata);
      }

      return metadata;
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
      user_id: userId,
      lastSyncTime: '1970-01-01T00:00:00Z',
      syncEnabled: false,
      storageLocation: 'cloud' as StorageLocation,
      syncModules: DEFAULT_SYNC_MODULES,
    };

    const oldLocation = metadata.storageLocation || 'cloud';
    metadata.storageLocation = location;
    metadata.lastSyncTime = new Date().toISOString();
    metadata.syncModules = filterValidModules(metadata.syncModules);

    await offlineStorage.put('sync_metadata', metadata);

    const dal = getDataAccessLayer(userId);
    dal.setLocationMemoryOnly(location);

    if (isSyncingLock) {
      logInfo('同步正在进行中，跳过存储位置切换时的数据同步', 'syncManager');
      return;
    }

    if (location === 'local' && oldLocation === 'cloud') {
      await this.syncCloudToLocal(userId);
    } else if (location === 'cloud' && oldLocation === 'local') {
      await this.syncLocalToCloud(userId);
    }
  },

  async syncCloudToLocal(userId: string): Promise<void> {
    logInfo('正在将云端数据同步到本地...', 'syncManager');
    try {
      const allTables = Object.values(MODULE_TABLE_MAP).flat();

      await syncTablesWithConcurrency(allTables, async (table) => {
        try {
          const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
          if (error) {
            logError(`同步表 ${table} 到本地失败`, 'syncManager', error as Error);
            return;
          }

          const cloudRows = (data || []) as SyncItem[];
          if (cloudRows.length > 0) {
            await offlineStorage.batchPut(table, cloudRows);
          }

          // 全量覆盖语义：清理云端已不存在的本地记录，避免他机删除后本机残留
          const localRows = await offlineStorage.queryByUser<SyncItem>(table, userId);
          await this.reconcileDeletions(
            table,
            localRows,
            new Set(cloudRows.map(row => row.id)),
            null
          );

          logInfo(`同步表 ${table} 到本地: ${cloudRows.length} 条`, 'syncManager');
        } catch (error) {
          logError(`同步表 ${table} 失败`, 'syncManager', error as Error);
        }
      });

      logInfo('云端到本地同步完成', 'syncManager');
    } catch (error) {
      logError('云端到本地同步失败', 'syncManager', error as Error);
      throw error;
    }
  },

  async syncLocalToCloud(userId: string): Promise<void> {
    logInfo('正在将本地数据同步到云端...', 'syncManager');
    try {
      const BATCH_SIZE = 20;
      const BATCH_DELAY = 100;

      const allTables = Object.values(MODULE_TABLE_MAP).flat();

      await syncTablesWithConcurrency(allTables, async (table) => {
        try {
          interface TableRecord {
            id: string;
            user_id: string;
            [key: string]: unknown;
          }
          const localData = await offlineStorage.queryByUser<TableRecord>(table, userId);

          for (let i = 0; i < localData.length; i += BATCH_SIZE) {
            const batch = localData.slice(i, i + BATCH_SIZE);

            const { error: upsertError } = await supabase
              .from(table)
              .upsert(batch, { onConflict: 'id' });

            if (upsertError) {
              logError(`批量同步失败: ${table}`, 'syncManager', upsertError as Error);
            }

            if (i + BATCH_SIZE < localData.length) {
              await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
          }

          logInfo(`同步表 ${table} 到云端: ${localData.length} 条`, 'syncManager');
        } catch (error) {
          logError(`同步表 ${table} 到云端失败`, 'syncManager', error as Error);
        }
      });

      logInfo('本地到云端同步完成', 'syncManager');
    } catch (error) {
      logError('本地到云端同步失败', 'syncManager', error as Error);
      throw error;
    }
  },

  async setSyncEnabled(userId: string, enabled: boolean): Promise<void> {
    const metadata = await this.getSyncMetadata(userId) || {
      id: userId,
      user_id: userId,
      lastSyncTime: '1970-01-01T00:00:00Z',
      syncEnabled: false,
      storageLocation: 'cloud' as StorageLocation,
      syncModules: DEFAULT_SYNC_MODULES,
    };

    metadata.syncEnabled = enabled;
    metadata.syncModules = filterValidModules(metadata.syncModules);
    await offlineStorage.put('sync_metadata', metadata);
  },

  async toggleModuleSync(userId: string, moduleKey: SyncModuleKey, enabled: boolean): Promise<void> {
    const metadata = await this.getSyncMetadata(userId) || {
      id: userId,
      user_id: userId,
      lastSyncTime: '1970-01-01T00:00:00Z',
      syncEnabled: false,
      storageLocation: 'cloud' as StorageLocation,
      syncModules: DEFAULT_SYNC_MODULES,
    };

    metadata.syncModules = filterValidModules(metadata.syncModules)
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

  // 分页拉取云端当前全量 id 集合（只取 id，负载极小）。
  // Supabase 单次请求默认上限 1000 行，必须分页，否则 id 集合不完整会误删本地数据。
  // 失败时返回 null，调用方据此跳过删除对账，绝不误删。
  async fetchCloudIdSet(table: string, userId: string): Promise<Set<string> | null> {
    const PAGE_SIZE = 1000;
    const ids = new Set<string>();
    let from = 0;

    try {
      for (;;) {
        const { data, error } = await supabase
          .from(table)
          .select('id')
          .eq('user_id', userId)
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          logError(`拉取云端 id 集合失败: ${table}`, 'syncManager', error as Error);
          return null;
        }
        if (!data || data.length === 0) break;

        for (const row of data) {
          const id = (row as { id?: unknown }).id;
          if (typeof id === 'string') ids.add(id);
        }
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return ids;
    } catch (error) {
      logError(`拉取云端 id 集合异常: ${table}`, 'syncManager', error as Error);
      return null;
    }
  },

  // 删除对账：本地有、云端没有 → 判定为「远端已删除」，清理本地副本。
  // 删除是物理 DELETE，云端不留痕迹，增量同步（updated_at > lastSyncTime）无法感知，只能靠 id 差集识别。
  // lastSyncTime 传 null 表示全量对账（syncCloudToLocal / syncLocalToCloud 场景）。
  async reconcileDeletions(
    storeName: string,
    localData: Array<{ id: string; updated_at?: unknown }>,
    cloudIdSet: Set<string>,
    lastSyncTime: string | null
  ): Promise<string[]> {
    const lastSyncDate = lastSyncTime ? new Date(lastSyncTime) : null;

    const deletedRemotely = localData.filter(item => {
      if (cloudIdSet.has(item.id)) return false;
      if (lastSyncDate === null) return true;

      // 增量对账：只清理「上次同步前就已存在」的记录。
      // updated_at 晚于上次同步的说明是本机新增/修改且尚未上传，必须保留（由 localOnly 负责上传）。
      const updatedAt = typeof item.updated_at === 'string' ? new Date(item.updated_at) : null;
      return updatedAt !== null && !Number.isNaN(updatedAt.getTime()) && updatedAt <= lastSyncDate;
    });

    if (deletedRemotely.length === 0) return [];

    const ids = deletedRemotely.map(item => item.id);
    await offlineStorage.batchDelete(storeName, ids);
    logInfo(`对账删除 ${storeName}: ${ids.length} 条（云端已删除）`, 'syncManager');
    return ids;
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

      const localData = await offlineStorage.queryByUser<SyncItem>(storeName, userId);

      // 使用 Map 将冲突检测查找从 O(n) 降为 O(1)
      const localMap = new Map<string, SyncItem>(localData.map(item => [item.id, item]));
      const localIds = new Set(localData.map(item => item.id));

      const cloudOnly: SyncItem[] = [];
      const conflicts: ConflictItem[] = [];
      const cloudIds = new Set<string>();

      for (const cloudItem of cloudData || []) {
        const cloudItemTyped = cloudItem as SyncItem;
        cloudIds.add(cloudItemTyped.id);
        if (!localIds.has(cloudItemTyped.id)) {
          cloudOnly.push(cloudItemTyped);
        } else {
          const localItem = localMap.get(cloudItemTyped.id);
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

      // 检测本地新增/修改但云端没有的记录（仅检查上次同步后的记录，避免误判已同步数据）
      const lastSyncDate = new Date(lastSyncTime);
      const localOnly: SyncItem[] = localData.filter(item =>
        new Date(item.updated_at) > lastSyncDate && !cloudIds.has(item.id)
      );

      if (cloudOnly.length > 0) {
        await offlineStorage.batchPut(storeName, cloudOnly);
      }

      if (localOnly.length > 0) {
        const BATCH_SIZE = 20;
        for (let i = 0; i < localOnly.length; i += BATCH_SIZE) {
          const batch = localOnly.slice(i, i + BATCH_SIZE);
          const { error: upsertError } = await supabase
            .from(tableName)
            .upsert(batch, { onConflict: 'id' });
          if (upsertError) {
            logError(`上传本地独有记录失败: ${tableName}`, 'syncManager', upsertError as Error);
          }
        }
      }

      if (conflicts.length > 0) {
        await this.handleConflicts(userId, conflicts);
      }

      // 删除对账：物理删除在云端不留痕迹，增量同步无法感知，需按云端 id 差集清理本地残留。
      // 仅在云端模式下执行——本地模式的数据本就不在云端，对账会误删。
      if (await this.getStorageLocation(userId) === 'cloud') {
        const cloudIdSet = await this.fetchCloudIdSet(tableName, userId);
        if (cloudIdSet) {
          await this.reconcileDeletions(storeName, localData, cloudIdSet, lastSyncTime);
        }
      }

      return {
        cloudOnly,
        localOnly,
        conflicts,
        synced: cloudOnly.length + localOnly.length,
        conflictsHandled: conflicts.length
      };
    } catch (error) {
      logError(`Sync failed for ${tableName}`, 'syncManager', error as Error);
      throw error;
    }
  },

  async syncWithRetry(
    userId: string,
    tableName: string,
    storeName: string,
    incremental: boolean = true,
    retries: number = 0
  ): Promise<TableSyncResult> {
    try {
      return await this.syncTable(userId, tableName, storeName, incremental);
    } catch (error) {
      const errorDetail = classifySyncError(error);

      if (!errorDetail.retryable) {
        logError(`同步 ${tableName} 失败（不可重试）`, 'syncManager', error as Error);
        throw error;
      }

      if (retries < MAX_RETRIES) {
        logInfo(`同步 ${tableName} 失败，${RETRY_DELAY}ms 后重试（第 ${retries + 1} 次）`, 'syncManager');
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return await this.syncWithRetry(userId, tableName, storeName, incremental, retries + 1);
      }

      logError(`同步 ${tableName} 失败（重试 ${MAX_RETRIES} 次后仍失败）`, 'syncManager', error as Error);
      throw error;
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

  async syncAll(
    userId: string,
    incremental: boolean = true,
    onProgress?: (progress: number, info?: SyncProgressInfo) => void
  ): Promise<SyncResult> {
    if (isSyncingLock) {
      logInfo('同步已在进行中，跳过本次请求', 'syncManager');
      return {};
    }

    isSyncingLock = true;

    try {
      const result: SyncResult = {};
      const allTables = Object.values(MODULE_TABLE_MAP).flat();
      const totalTables = allTables.length;
      let completedTables = 0;
      const errors: { tableName: string; error: SyncErrorDetail }[] = [];

      for (const [, tables] of Object.entries(MODULE_TABLE_MAP)) {
        for (const table of tables) {
          try {
            if (onProgress && totalTables > 0) {
              onProgress(
                Math.round((completedTables / totalTables) * 100),
                { currentTable: table, completedTables, totalTables }
              );
            }

            result[table] = await this.syncWithRetry(userId, table, table, incremental);
            completedTables++;

            if (onProgress && totalTables > 0) {
              onProgress(
                Math.round((completedTables / totalTables) * 100),
                { currentTable: table, completedTables, totalTables, tableResult: result[table] }
              );
            }
          } catch (error) {
            errors.push({ tableName: table, error: classifySyncError(error) });
            result[table] = { cloudOnly: [], localOnly: [], conflicts: [], synced: 0, conflictsHandled: 0 };
            completedTables++;

            if (onProgress && totalTables > 0) {
              onProgress(
                Math.round((completedTables / totalTables) * 100),
                { currentTable: table, completedTables, totalTables }
              );
            }
          }
        }
      }

      if (errors.length > 0) {
        // 有表同步失败时不推进同步位点：否则本地未上传成功的记录会在下一轮对账中
        // 因「updated_at <= lastSyncTime 且云端不存在」被误判为远端已删除而清除
        logInfo(`同步完成，但有 ${errors.length} 个表失败，保持同步位点不变`, 'syncManager');
        for (const { tableName, error } of errors) {
          logError(`表 ${tableName} 同步失败: ${error.message}`, 'syncManager');
        }
      } else {
        await this.updateSyncTime(userId);
      }

      if (onProgress) {
        onProgress(100, { currentTable: '', completedTables: totalTables, totalTables });
      }

      return result;
    } finally {
      isSyncingLock = false;
    }
  },

  // 外部查询同步状态
  isSyncInProgress(): boolean {
    return isSyncingLock;
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
        } else {
          const errMsg = error instanceof Error ? error.message : (error as { message?: string })?.message ?? 'unknown error';
          logError(`Conflict resolve failed: ${conflict.tableName} ${conflict.recordId}`, 'syncManager', error as Error);
          throw new Error(`Conflict resolve failed: ${errMsg}`);
        }
      } else {
        await offlineStorage.put(conflict.tableName, conflict.cloud);
        logInfo(`Resolved conflict: cloud wins for ${conflict.tableName} ${conflict.recordId}`, 'syncManager');
      }
    }
  },

  async resolveConflict(conflict: ConflictItem, keepLocal: boolean): Promise<void> {
    if (keepLocal) {
      const { error } = await supabase.from(conflict.tableName)
        .update(conflict.local)
        .eq('id', conflict.recordId);

      if (error) {
        logError(`Failed to resolve conflict (local wins): ${conflict.tableName} ${conflict.recordId}`, 'syncManager', error);
        throw new Error('保存本地版本失败');
      }
      logInfo(`Resolved conflict: local wins for ${conflict.tableName} ${conflict.recordId}`, 'syncManager');
    } else {
      await offlineStorage.put(conflict.tableName, conflict.cloud);
      logInfo(`Resolved conflict: cloud wins for ${conflict.tableName} ${conflict.recordId}`, 'syncManager');
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
    metadata.syncModules = filterValidModules(metadata.syncModules);

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

  async getSyncOnStartupEnabled(userId: string): Promise<boolean> {
    const metadata = await this.getSyncMetadata(userId);
    return metadata?.syncOnStartupEnabled ?? true;
  },

  async setSyncOnStartupEnabled(userId: string, enabled: boolean): Promise<void> {
    const metadata = await this.getSyncMetadata(userId) || {
      id: userId,
      user_id: userId,
      lastSyncTime: '1970-01-01T00:00:00Z',
      syncEnabled: false,
      storageLocation: 'cloud' as StorageLocation,
      syncModules: DEFAULT_SYNC_MODULES,
    };

    metadata.syncOnStartupEnabled = enabled;
    await offlineStorage.put('sync_metadata', metadata);
  },

  async syncOnStartup(userId: string): Promise<void> {
    if (!userId) {
      logInfo('启动同步跳过：用户未登录', 'syncManager');
      return;
    }

    if (!navigator.onLine) {
      logInfo('启动同步跳过：网络离线', 'syncManager');
      return;
    }

    try {
      const startupEnabled = await this.getSyncOnStartupEnabled(userId);
      if (!startupEnabled) {
        logInfo('启动同步跳过：启动同步未启用', 'syncManager');
        return;
      }

      const storageLocation = await this.getStorageLocation(userId);
      if (storageLocation !== 'cloud') {
        logInfo('启动同步跳过：非云端存储模式', 'syncManager');
        return;
      }

      // 云端模式下 DAL 的写操作本来就会同步到云端，若同时关闭后台同步，
      // 会造成「新增能同步、删除不能同步」的不一致状态。
      // 因此「从未同步过」的用户按启用处理并回写，使设置页开关与实际行为一致；
      // 已同步过的用户则尊重其显式选择。
      if (!(await this.isSyncEnabled(userId))) {
        const metadata = await this.getSyncMetadata(userId);
        if (!metadata || metadata.lastSyncTime !== '1970-01-01T00:00:00Z') {
          logInfo('启动同步跳过：同步未启用', 'syncManager');
          return;
        }
        await this.setSyncEnabled(userId, true);
        logInfo('云端模式且从未同步，已自动启用数据同步', 'syncManager');
      }

      if (isSyncingLock) {
        logInfo('启动同步跳过：同步已在进行中', 'syncManager');
        return;
      }

      logInfo('启动静默同步开始', 'syncManager');
      await this.syncAll(userId, true);
      logInfo('启动静默同步完成', 'syncManager');
    } catch (error) {
      logError('启动静默同步失败', 'syncManager', error as Error);
    }
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

  async getTableDataCounts(userId: string): Promise<{ tableName: string; count: number }[]> {
    const counts: { tableName: string; count: number }[] = [];
    const allTables = Object.values(MODULE_TABLE_MAP).flat();

    for (const table of allTables) {
      try {
        const data = await offlineStorage.queryByUser(table, userId);
        counts.push({ tableName: table, count: data.length });
      } catch (error) {
        logError(`获取表 ${table} 数据量失败`, 'syncManager', error as Error);
        counts.push({ tableName: table, count: 0 });
      }
    }

    return counts;
  },

  async getTotalDataCount(userId: string): Promise<number> {
    const counts = await this.getTableDataCounts(userId);
    return counts.reduce((sum, item) => sum + item.count, 0);
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
