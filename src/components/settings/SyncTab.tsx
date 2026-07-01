import React, { useEffect, useCallback, useState } from 'react';
import { RefreshCw, Cloud, CloudOff, Loader2, HardDrive, Database, AlertCircle } from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';
import SyncConflictModal from './SyncConflictModal';
import { useSyncStore, SyncSummary } from '../../store/syncStore';
import { useAuthStore } from '../../store/AuthStore';
import { syncManager, SyncProgressInfo } from '../../services/syncManager';
import { useToastStore } from '../../store/toastStore';
import { logError, logInfo } from '../../services/loggerService';
import { SyncModuleKey, StorageLocation, MODULE_TABLE_MAP, ConflictItem, classifySyncError } from '../../types/offline';

const VALID_MODULE_KEYS = Object.keys(MODULE_TABLE_MAP) as SyncModuleKey[];

const TABLE_LABELS: Record<string, string> = {
  todos: '待办事项',
  todo_categories: '待办分类',
  shops: '店铺',
  social_accounts: '社交账号',
  emails: '邮箱',
  phones: '电话',
  companies: '公司',
  credentials: '凭证',
  general_accounts: '通用账号',
  website_accounts: '网站账号',
  website_account_categories: '网站分类',
  quick_replies: '快捷回复',
  quick_reply_categories: '快捷回复分类',
  clipboard_items: '剪贴板',
  clipboard_categories: '剪贴板分类',
  memos: '备忘录',
  memo_categories: '备忘录分类',
};

const getTableNameLabel = (tableName: string): string => TABLE_LABELS[tableName] || tableName;

const SyncTab: React.FC = () => {
  const {
    syncEnabled,
    syncModules,
    isSyncing,
    syncProgress,
    lastSyncTime,
    storageLocation,
    syncOnStartupEnabled,
    currentSyncTable,
    totalSyncedCount,
    lastSyncSummary,
    isOnline,
    isSwitching,
    showConflictModal,
    conflicts,
    tableDataCounts,
    totalDataCount,
    setSyncEnabled,
    setSyncModules,
    toggleModuleSync,
    setIsSyncing,
    setSyncProgress,
    setLastSyncTime,
    setPendingOperationsCount,
    setStorageLocation,
    setSyncOnStartupEnabled,
    setCurrentSyncTable,
    setTableSyncStatuses,
    updateTableSyncStatus,
    setTotalSyncedCount,
    setLastSyncSummary,
    setIsSwitching,
    setShowConflictModal,
    setConflicts,
    setTableDataCounts,
    setTotalDataCount,
  } = useSyncStore();

  const admin = useAuthStore(state => state.admin);
  const addToast = useToastStore(state => state.addToast);
  const [showTableStatusVisible, setShowTableStatusVisible] = useState(false);

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    return `${diffDays}天前`;
  };

  const refreshPendingOperations = useCallback(async () => {
    if (!admin?.id) return;
    try {
      const ops = await syncManager.getPendingOperations(admin.id);
      setPendingOperationsCount(ops.length);
    } catch (error) {
      logError('获取待同步操作失败', 'SyncTab', error as Error);
    }
  }, [admin, setPendingOperationsCount]);

  const loadSyncMetadata = useCallback(async () => {
    if (!admin?.id) return;
    try {
      const metadata = await syncManager.getSyncMetadata(admin.id);
      if (metadata) {
        setSyncEnabled(metadata.syncEnabled);
        if (metadata.lastSyncTime !== '1970-01-01T00:00:00Z') {
          setLastSyncTime(metadata.lastSyncTime);
        }
        if (metadata.syncModules && metadata.syncModules.length > 0) {
          const filteredModules = metadata.syncModules.filter(m => VALID_MODULE_KEYS.includes(m.key));
          setSyncModules(filteredModules);
        }
        setStorageLocation(metadata.storageLocation);
        setSyncOnStartupEnabled(metadata.syncOnStartupEnabled ?? true);
      }
    } catch (error) {
      logError('加载同步配置失败', 'SyncTab', error as Error);
    }
  }, [admin, setSyncEnabled, setLastSyncTime, setSyncModules, setStorageLocation, setSyncOnStartupEnabled]);

  const loadDataCounts = useCallback(async () => {
    if (!admin?.id) return;
    try {
      const counts = await syncManager.getTableDataCounts(admin.id);
      setTableDataCounts(counts);
      const total = counts.reduce((sum, c) => sum + c.count, 0);
      setTotalDataCount(total);
    } catch (error) {
      logError('加载数据量统计失败', 'SyncTab', error as Error);
    }
  }, [admin, setTableDataCounts, setTotalDataCount]);

  const getModuleDataCount = (moduleKey: SyncModuleKey): number => {
    const tables = MODULE_TABLE_MAP[moduleKey];
    return tableDataCounts
      .filter(c => tables.includes(c.tableName))
      .reduce((sum, c) => sum + c.count, 0);
  };

  const handleToggleSync = async (enabled: boolean) => {
    if (!admin?.id) return;
    try {
      await syncManager.setSyncEnabled(admin.id, enabled);
      setSyncEnabled(enabled);
      if (enabled) {
        addToast({ type: 'success', message: '数据同步已启用' });
      } else {
        addToast({ type: 'success', message: '数据同步已禁用' });
      }
    } catch (error) {
      logError('切换同步状态失败', 'SyncTab', error as Error);
      addToast({ type: 'error', message: '操作失败，请重试' });
    }
  };

  const handleToggleSyncOnStartup = async (enabled: boolean) => {
    if (!admin?.id) return;
    syncManager.setSyncOnStartupEnabled(admin.id, enabled).then(() => {
      setSyncOnStartupEnabled(enabled);
      addToast({ type: 'success', message: enabled ? '启动同步已启用' : '启动同步已禁用' });
    }).catch((error) => {
      logError('切换启动同步失败', 'SyncTab', error as Error);
      addToast({ type: 'error', message: '操作失败，请重试' });
    });
  };

  const handleToggleModule = async (key: SyncModuleKey, enabled: boolean) => {
    if (!admin?.id) return;
    syncManager.toggleModuleSync(admin.id, key, enabled).then(() => {
      toggleModuleSync(key);
      addToast({ type: 'success', message: `${syncModules.find(m => m.key === key)?.name} ${enabled ? '已启用' : '已禁用'}` });
    }).catch((error) => {
      logError('切换模块同步状态失败', 'SyncTab', error as Error);
      addToast({ type: 'error', message: '操作失败，请重试' });
    });
  };

  const handleStorageLocationChange = async (location: StorageLocation) => {
    if (!admin?.id || isSwitching) return;

    setIsSwitching(true);

    try {
      await syncManager.setStorageLocation(admin.id, location);
      setStorageLocation(location);

      const message = location === 'local'
        ? '已切换到本地存储，数据已从云端同步到本地'
        : '已切换到云端存储，数据已同步到云端';
      addToast({ type: 'success', message });
      logInfo(`存储位置已切换到${location === 'local' ? '本地' : '云端'}`, 'SyncTab');
    } catch (error) {
      logError('切换存储位置失败', 'SyncTab', error as Error);
      addToast({ type: 'error', message: '切换失败，请重试' });
    } finally {
      setIsSwitching(false);
    }
  };

  const handleSyncClick = async () => {
    if (isSyncing || !isOnline || !admin?.id) return;

    setIsSyncing(true);
    setSyncProgress(0);
    setCurrentSyncTable(null);
    setLastSyncSummary(null);
    setTotalSyncedCount(0);

    const startTime = Date.now();

    try {
      const allTables = Object.values(MODULE_TABLE_MAP).flat();
      const initialStatuses = allTables.map(table => ({
        tableName: table,
        status: 'pending' as const,
        syncedCount: 0,
      }));
      setTableSyncStatuses(initialStatuses);

      const result = await syncManager.syncAll(admin.id, false, (progress: number, info?: SyncProgressInfo) => {
        setSyncProgress(progress);

        if (info) {
          if (info.currentTable) {
            setCurrentSyncTable(info.currentTable);
            if (!info.tableResult) {
              updateTableSyncStatus(info.currentTable, { status: 'syncing' });
            }
          }

          if (info.tableResult && info.currentTable) {
            updateTableSyncStatus(info.currentTable, {
              status: 'completed',
              syncedCount: info.tableResult.synced,
            });
            setTotalSyncedCount(prev => prev + (info.tableResult?.synced ?? 0));
          }
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      let pulledCount = 0;
      let addedCount = 0;
      let conflictCount = 0;

      for (const [, tableResult] of Object.entries(result)) {
        if (tableResult) {
          pulledCount += tableResult.cloudOnly?.length || 0;
          addedCount += tableResult.synced || 0;
          conflictCount += tableResult.conflicts?.length || 0;
        }
      }

      const summary: SyncSummary = {
        pulledCount,
        addedCount,
        conflictCount,
        duration,
        timestamp: new Date().toISOString(),
      };
      setLastSyncSummary(summary);

      const allConflicts: ConflictItem[] = [];
      for (const [, tableResult] of Object.entries(result)) {
        if (tableResult?.conflicts && tableResult.conflicts.length > 0) {
          allConflicts.push(...tableResult.conflicts);
        }
      }

      if (allConflicts.length > 0) {
        setConflicts(allConflicts);
        setShowConflictModal(true);
        await loadDataCounts();
      } else {
        await refreshPendingOperations();
        await loadDataCounts();
        setLastSyncTime(new Date().toISOString());
        addToast({
          type: 'success',
          message: `同步完成：拉取 ${pulledCount} 条，耗时 ${(duration / 1000).toFixed(1)}秒`
        });
        logInfo('数据同步成功完成', 'SyncTab');
      }
    } catch (error) {
      logError('同步失败', 'SyncTab', error as Error);
      const errorDetail = classifySyncError(error);

      if (errorDetail.type === 'network') {
        addToast({ type: 'error', message: '网络错误，请检查网络连接后重试' });
      } else if (errorDetail.type === 'auth') {
        addToast({ type: 'error', message: '认证失败，请重新登录' });
      } else if (errorDetail.type === 'permission') {
        addToast({ type: 'error', message: '权限不足，无法同步数据' });
      } else {
        addToast({ type: 'error', message: `同步失败: ${errorDetail.message}` });
      }
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
      setCurrentSyncTable(null);
    }
  };

  const handleResolveConflict = async (conflictId: string, keepLocal: boolean) => {
    if (!admin?.id) return;
    syncManager.resolveConflict(admin.id, conflictId, keepLocal).then(() => {
      setConflicts(prev => prev.filter(c => c.id !== conflictId));

      if (conflicts.length === 1) {
        setShowConflictModal(false);
        refreshPendingOperations().then(() => {
          setLastSyncTime(new Date().toISOString());
          addToast({ type: 'success', message: '所有冲突已解决' });
        });
      }
    }).catch(() => {
      addToast({ type: 'error', message: '解决冲突失败' });
    });
  };

  useEffect(() => {
    loadSyncMetadata();
    refreshPendingOperations();
    loadDataCounts();
  }, [admin, loadSyncMetadata, refreshPendingOperations, loadDataCounts]);

  const tableSyncStatuses = useSyncStore(state => state.tableSyncStatuses);

  const storageOptions: { value: StorageLocation; label: string; description: string }[] = [
    { value: 'local', label: '本地存储', description: '数据仅存储在本地设备，不与云端同步' },
    { value: 'cloud', label: '云端存储', description: '数据同时存储在本地和云端，保持同步' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <HardDrive size={16} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">数据存储位置</h2>
        </div>
        <div className="p-4 space-y-2">
          {storageOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleStorageLocationChange(option.value)}
              disabled={isSwitching}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                storageLocation === option.value
                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  storageLocation === option.value
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {option.value === 'local' ? (
                    <HardDrive size={16} />
                  ) : (
                    <Cloud size={16} />
                  )}
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{option.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{option.description}</div>
                </div>
              </div>
              {storageLocation === option.value && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {storageLocation === 'cloud' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">同步模块</h2>
            </div>
            <ToggleSwitch enabled={syncEnabled} onChange={handleToggleSync} />
          </div>
          {syncEnabled && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">启动时自动同步</span>
                <ToggleSwitch
                  enabled={syncOnStartupEnabled} onChange={handleToggleSyncOnStartup}
                />
              </div>

              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">数据同步</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {isOnline ? (
                    <span className="flex items-center">
                      <Cloud className="w-3 h-3 mr-1 text-green-500" />
                      {isSyncing ? '同步中...' : lastSyncTime ? getTimeAgo(lastSyncTime) : '从未同步'}
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <CloudOff className="w-3 h-3 mr-1 text-gray-400" />
                      离线
                    </span>
                  )}
                  </span>
                  <button
                    onClick={handleSyncClick}
                    disabled={isSyncing || !isOnline || !admin?.id}
                    className="flex items-center px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSyncing ? (
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3 mr-1.5" />
                  )}
                    {isSyncing ? '同步中' : '立即同步'}
                  </button>
                </div>
              </div>

              {isSyncing && (
                <div className="px-4 pb-2 space-y-2">
                  {currentSyncTable && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>正在同步: {getTableNameLabel(currentSyncTable)}</span>
                    </div>
                  )}

                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>已同步 {totalSyncedCount} 条数据</span>
                    <span>{syncProgress}%</span>
                  </div>

                  {tableSyncStatuses.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowTableStatusVisible(!showTableStatusVisible)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                      >
                        {showTableStatusVisible ? '收起详情 ▲' : '展开详情 ▼'}
                      </button>
                      {showTableStatusVisible && (
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          {tableSyncStatuses.map(status => (
                            <div key={status.tableName} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 dark:text-gray-400">
                                {getTableNameLabel(status.tableName)}
                              </span>
                              <span className={`${
                                status.status === 'completed' ? 'text-green-500' :
                                status.status === 'syncing' ? 'text-blue-500' :
                                status.status === 'failed' ? 'text-red-500' :
                                'text-gray-400'
                              }`}>
                                {status.status === 'completed' ? `✓ ${status.syncedCount}条` :
                                 status.status === 'syncing' ? '同步中...' :
                                 status.status === 'failed' ? '失败' :
                                 '等待'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {lastSyncSummary && !isSyncing && (
                <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-t border-b border-green-100 dark:border-green-800/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-green-800 dark:text-green-300">
                      最近同步结果
                    </span>
                    <span className="text-xs text-green-600 dark:text-green-400">
                      {getTimeAgo(lastSyncSummary.timestamp)}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-green-700 dark:text-green-300 font-medium">
                        {lastSyncSummary.pulledCount}
                      </div>
                      <div className="text-green-600 dark:text-green-400">拉取</div>
                    </div>
                    <div className="text-center">
                      <div className="text-green-700 dark:text-green-300 font-medium">
                        {lastSyncSummary.addedCount}
                      </div>
                      <div className="text-green-600 dark:text-green-400">新增</div>
                    </div>
                    <div className="text-center">
                      <div className="text-green-700 dark:text-green-300 font-medium">
                        {lastSyncSummary.conflictCount}
                      </div>
                      <div className="text-green-600 dark:text-green-400">冲突</div>
                    </div>
                    <div className="text-center">
                      <div className="text-green-700 dark:text-green-300 font-medium">
                        {(lastSyncSummary.duration / 1000).toFixed(1)}s
                      </div>
                      <div className="text-green-600 dark:text-green-400">耗时</div>
                    </div>
                  </div>
                </div>
              )}

              {syncModules.map((module) => (
                <div key={module.key} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{module.name}</span>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {getModuleDataCount(module.key)} 条数据
                      {module.lastSyncTime && ` · 上次同步: ${getTimeAgo(module.lastSyncTime)}`}
                    </p>
                  </div>
                  <ToggleSwitch
                    enabled={module.enabled}
                    onChange={(enabled) => handleToggleModule(module.key, enabled)}
                  />
                </div>
              ))}

              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>本地数据总量</span>
                  <span className="font-medium">{totalDataCount} 条</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {storageLocation === 'local' && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">本地存储模式</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                数据仅存储在本地设备，不会与云端同步。请定期备份数据以防止丢失。
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                注意：本地模式下仅能访问本地存储的数据。如需访问云端数据，请切换到云端模式。
              </p>
            </div>
          </div>
        </div>
      )}

      <SyncConflictModal
        conflicts={conflicts}
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        onResolve={handleResolveConflict}
      />
    </div>
  );
};

export default SyncTab;
