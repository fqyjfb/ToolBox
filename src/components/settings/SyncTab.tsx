import React, { useEffect, useCallback, useState } from 'react';
import { RefreshCw, Cloud, CloudOff, Loader2, HardDrive, Database, AlertCircle } from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/AuthStore';
import { syncManager } from '../../services/syncManager';
import { useToastStore } from '../../store/toastStore';
import { logError, logInfo } from '../../services/loggerService';
import { SyncModuleKey, StorageLocation, MODULE_TABLE_MAP } from '../../types/offline';

const VALID_MODULE_KEYS = Object.keys(MODULE_TABLE_MAP) as SyncModuleKey[];

const SyncTab: React.FC = () => {
  const {
    syncEnabled,
    syncModules,
    isSyncing,
    syncProgress,
    lastSyncTime,
    storageLocation,
    setSyncEnabled,
    setSyncModules,
    toggleModuleSync,
    setIsSyncing,
    setSyncProgress,
    setLastSyncTime,
    setPendingOperationsCount,
    setStorageLocation,
  } = useThemeStore();

  const admin = useAuthStore(state => state.admin);
  const addToast = useToastStore(state => state.addToast);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSwitching, setIsSwitching] = useState(false);

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
  }, [admin?.id, setPendingOperationsCount]);

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
      }
    } catch (error) {
      logError('加载同步配置失败', 'SyncTab', error as Error);
    }
  }, [admin?.id, setSyncEnabled, setLastSyncTime, setSyncModules, setStorageLocation]);

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

  const handleToggleModule = async (key: SyncModuleKey, enabled: boolean) => {
    if (!admin?.id) return;
    try {
      await syncManager.toggleModuleSync(admin.id, key, enabled);
      toggleModuleSync(key);
      addToast({ type: 'success', message: `${syncModules.find(m => m.key === key)?.name} ${enabled ? '已启用' : '已禁用'}` });
    } catch (error) {
      logError('切换模块同步状态失败', 'SyncTab', error as Error);
      addToast({ type: 'error', message: '操作失败，请重试' });
    }
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

    try {
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setSyncProgress(i);
      }

      await syncManager.syncAll(admin.id, false);
      await refreshPendingOperations();
      setLastSyncTime(new Date().toISOString());
      addToast({ type: 'success', message: '数据同步完成' });
      logInfo('数据同步成功完成', 'SyncTab');
    } catch (error) {
      logError('同步失败', 'SyncTab', error as Error);
      addToast({ type: 'error', message: '同步失败，请重试' });
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };

  useEffect(() => {
    const handleOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  useEffect(() => {
    loadSyncMetadata();
    refreshPendingOperations();
  }, [admin?.id, loadSyncMetadata, refreshPendingOperations]);

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
                <div className="px-4 pb-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div
                      className="bg-primary h-1 rounded-full transition-all"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {syncModules.map((module) => (
                <div key={module.key} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{module.name}</span>
                    {module.lastSyncTime && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        上次同步: {getTimeAgo(module.lastSyncTime)}
                      </p>
                    )}
                  </div>
                  <ToggleSwitch
                    enabled={module.enabled}
                    onChange={(enabled) => handleToggleModule(module.key, enabled)}
                  />
                </div>
              ))}
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
    </div>
  );
};

export default SyncTab;
