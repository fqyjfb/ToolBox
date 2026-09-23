import React, { useEffect, useCallback, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { RefreshCw, Cloud, CloudOff, Loader2, HardDrive, Database, AlertCircle } from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';
import SyncConflictModal from './SyncConflictModal';
import SettingCard from './SettingCard';
import { useSyncStore, SyncSummary } from '../../store/syncStore';
import { useAuthStore } from '../../store/AuthStore';
import { syncManager, SyncProgressInfo } from '../../services/syncManager';
import { useToastStore } from '../../store/toastStore';
import { logError, logInfo } from '../../services/loggerService';
import { SyncModuleKey, StorageLocation, MODULE_TABLE_MAP, ConflictItem, classifySyncError } from '../../types/offline';
import { getTableNameLabel, getTimeAgo } from '../../constants/offline';

const VALID_MODULE_KEYS = Object.keys(MODULE_TABLE_MAP) as SyncModuleKey[];

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
  } = useSyncStore(useShallow((s) => ({
    syncEnabled: s.syncEnabled,
    syncModules: s.syncModules,
    isSyncing: s.isSyncing,
    syncProgress: s.syncProgress,
    lastSyncTime: s.lastSyncTime,
    storageLocation: s.storageLocation,
    syncOnStartupEnabled: s.syncOnStartupEnabled,
    currentSyncTable: s.currentSyncTable,
    totalSyncedCount: s.totalSyncedCount,
    lastSyncSummary: s.lastSyncSummary,
    isOnline: s.isOnline,
    isSwitching: s.isSwitching,
    showConflictModal: s.showConflictModal,
    conflicts: s.conflicts,
    tableDataCounts: s.tableDataCounts,
    totalDataCount: s.totalDataCount,
    setSyncEnabled: s.setSyncEnabled,
    setSyncModules: s.setSyncModules,
    toggleModuleSync: s.toggleModuleSync,
    setIsSyncing: s.setIsSyncing,
    setSyncProgress: s.setSyncProgress,
    setLastSyncTime: s.setLastSyncTime,
    setPendingOperationsCount: s.setPendingOperationsCount,
    setStorageLocation: s.setStorageLocation,
    setSyncOnStartupEnabled: s.setSyncOnStartupEnabled,
    setCurrentSyncTable: s.setCurrentSyncTable,
    setTableSyncStatuses: s.setTableSyncStatuses,
    updateTableSyncStatus: s.updateTableSyncStatus,
    setTotalSyncedCount: s.setTotalSyncedCount,
    setLastSyncSummary: s.setLastSyncSummary,
    setIsSwitching: s.setIsSwitching,
    setShowConflictModal: s.setShowConflictModal,
    setConflicts: s.setConflicts,
    setTableDataCounts: s.setTableDataCounts,
    setTotalDataCount: s.setTotalDataCount,
  })));

  const user = useAuthStore(state => state.user);
  const addToast = useToastStore(state => state.addToast);
  const [showTableStatusVisible, setShowTableStatusVisible] = useState(false);

  const refreshPendingOperations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const ops = await syncManager.getPendingOperations(user.id);
      setPendingOperationsCount(ops.length);
    } catch (error) {
      logError('获取待同步操作失败', 'SyncTab', error as Error);
    }
  }, [user, setPendingOperationsCount]);

  const loadSyncMetadata = useCallback(async () => {
    if (!user?.id) return;
    try {
      const metadata = await syncManager.getSyncMetadata(user.id);
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
  }, [user, setSyncEnabled, setLastSyncTime, setSyncModules, setStorageLocation, setSyncOnStartupEnabled]);

  const loadDataCounts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const counts = await syncManager.getTableDataCounts(user.id);
      setTableDataCounts(counts);
      const total = counts.reduce((sum, c) => sum + c.count, 0);
      setTotalDataCount(total);
    } catch (error) {
      logError('加载数据量统计失败', 'SyncTab', error as Error);
    }
  }, [user, setTableDataCounts, setTotalDataCount]);

  const getModuleDataCount = (moduleKey: SyncModuleKey): number => {
    const tables = MODULE_TABLE_MAP[moduleKey];
    return tableDataCounts
      .filter(c => tables.includes(c.tableName))
      .reduce((sum, c) => sum + c.count, 0);
  };

  const handleToggleSync = async (enabled: boolean) => {
    if (!user?.id) {
      addToast({ type: 'warning', message: '请先登录' });
      return;
    }
    try {
      await syncManager.setSyncEnabled(user.id, enabled);
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
    if (!user?.id) {
      addToast({ type: 'warning', message: '请先登录' });
      return;
    }
    syncManager.setSyncOnStartupEnabled(user.id, enabled).then(() => {
      setSyncOnStartupEnabled(enabled);
      addToast({ type: 'success', message: enabled ? '启动同步已启用' : '启动同步已禁用' });
    }).catch((error) => {
      logError('切换启动同步失败', 'SyncTab', error as Error);
      addToast({ type: 'error', message: '操作失败，请重试' });
    });
  };

  const handleToggleModule = async (key: SyncModuleKey, enabled: boolean) => {
    if (!user?.id) {
      addToast({ type: 'warning', message: '请先登录' });
      return;
    }
    syncManager.toggleModuleSync(user.id, key, enabled).then(() => {
      toggleModuleSync(key);
      addToast({ type: 'success', message: `${syncModules.find(m => m.key === key)?.name} ${enabled ? '已启用' : '已禁用'}` });
    }).catch((error) => {
      logError('切换模块同步状态失败', 'SyncTab', error as Error);
      addToast({ type: 'error', message: '操作失败，请重试' });
    });
  };

  const handleStorageLocationChange = async (location: StorageLocation) => {
    if (!user?.id) {
      addToast({ type: 'warning', message: '请先登录' });
      return;
    }
    if (isSwitching) return;

    setIsSwitching(true);

    try {
      await syncManager.setStorageLocation(user.id, location);
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
    if (isSyncing || !isOnline || !user?.id) return;

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

      const result = await syncManager.syncAll(user.id, false, (progress: number, info?: SyncProgressInfo) => {
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
    if (!user?.id) return;
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) {
      addToast({ type: 'error', message: '冲突不存在' });
      return;
    }
    try {
      await syncManager.resolveConflict(conflict, keepLocal);
      setConflicts(prev => {
        const remaining = prev.filter(c => c.id !== conflictId);
        if (remaining.length === 0) {
          setShowConflictModal(false);
          refreshPendingOperations().then(() => {
            setLastSyncTime(new Date().toISOString());
            addToast({ type: 'success', message: '所有冲突已解决' });
          });
        }
        return remaining;
      });
    } catch {
      addToast({ type: 'error', message: '解决冲突失败' });
    }
  };

  useEffect(() => {
    loadSyncMetadata();
    refreshPendingOperations();
    loadDataCounts();
  }, [user, loadSyncMetadata, refreshPendingOperations, loadDataCounts]);

  const tableSyncStatuses = useSyncStore(state => state.tableSyncStatuses);

  const storageOptions: { value: StorageLocation; label: string; description: string }[] = [
    { value: 'local', label: '本地存储', description: '数据仅存储在本地设备，不与云端同步' },
    { value: 'cloud', label: '云端存储', description: '数据同时存储在本地和云端，保持同步' },
  ];

  return (
    <div className="space-y-4">
      <SettingCard>
        <div className="flex items-center gap-2 p-4 settings-section-header">
          <HardDrive size={16} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-content-primary">数据存储位置</h2>
        </div>
        <div className="p-4 space-y-2">
          {storageOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleStorageLocationChange(option.value)}
              disabled={isSwitching}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                storageLocation === option.value
                  ? 'border border-primary bg-primary/5 dark:bg-primary/10'
                  : 'hover:border hover:border-content'
              } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  storageLocation === option.value
                    ? 'bg-primary text-button-text'
                    : 'bg-surface-secondary text-content-secondary'
                }`}>
                  {option.value === 'local' ? (
                    <HardDrive size={16} />
                  ) : (
                    <Cloud size={16} />
                  )}
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-content-primary">{option.label}</div>
                  <div className="text-xs text-content-secondary">{option.description}</div>
                </div>
              </div>
              {storageLocation === option.value && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <svg className="w-3 h-3 text-button-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </SettingCard>

      {storageLocation === 'cloud' && (
        <SettingCard>
          <div className="flex items-center justify-between p-4 settings-section-header">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-content-primary">同步模块</h2>
            </div>
            <ToggleSwitch enabled={syncEnabled} onChange={handleToggleSync} />
          </div>
          {syncEnabled && (
            <div className="">
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-content-primary">启动时自动同步</span>
                <ToggleSwitch
                  enabled={syncOnStartupEnabled} onChange={handleToggleSyncOnStartup}
                />
              </div>

              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-content-primary">数据同步</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-content-secondary">
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
                    disabled={isSyncing || !isOnline || !user?.id}
                    className="flex items-center px-3 py-1.5 text-xs bg-primary text-button-text rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="flex items-center gap-2 text-xs text-content-secondary">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>正在同步: {getTableNameLabel(currentSyncTable)}</span>
                    </div>
                  )}

                  <div className="w-full bg-surface-secondary rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-content-secondary">
                    <span>已同步 {totalSyncedCount} 条数据</span>
                    <span>{syncProgress}%</span>
                  </div>

                  {tableSyncStatuses.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowTableStatusVisible(!showTableStatusVisible)}
                        className="text-xs text-content-secondary hover:text-content-primary transition-colors"
                      >
                        {showTableStatusVisible ? '收起详情 ▲' : '展开详情 ▼'}
                      </button>
                      {showTableStatusVisible && (
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          {tableSyncStatuses.map(status => (
                            <div key={status.tableName} className="flex items-center justify-between text-xs">
                              <span className="text-content-secondary">
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
                <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20">
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
                    <span className="text-sm text-content-primary">{module.name}</span>
                    <p className="text-xs text-content-secondary mt-0.5">
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

              <div className="px-4 py-2 bg-surface-secondary">
                <div className="flex items-center justify-between text-xs text-content-secondary">
                  <span>本地数据总量</span>
                  <span className="font-medium">{totalDataCount} 条</span>
                </div>
              </div>
            </div>
          )}
        </SettingCard>
      )}

      {storageLocation === 'local' && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
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
