import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Database, Trash2, Loader2, HardDrive, Download, Upload, AlertTriangle, BarChart3 } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import { useStorageStore } from '../../store/storageStore';
import { useAuthStore } from '../../store/AuthStore';
import { logError, logInfo } from '../../services/loggerService';
import { iconCacheService } from '../../services/iconCacheService';
import { offlineStorage } from '../../services/offlineStorage';
import { formatBytes } from '../../utils';
import ConfirmDialog from '../ui/ConfirmDialog';
import SettingCard from './SettingCard';
import { PlatformVisibility } from '../../types/account';
import { localStorageService, STORAGE_KEYS } from '../../services/localStorageService';

interface StorageTabProps {
  onClearCache: () => void;
  btnLoading: boolean;
  btnText: string;
}

const STORAGE_THRESHOLD_WARNING = 0.8;
const STORAGE_THRESHOLD_DANGER = 0.9;

const StorageTab: React.FC<StorageTabProps> = ({ onClearCache, btnLoading, btnText }) => {
  const addToast = useToastStore(state => state.addToast);
  const { 
    storageUsed, 
    storageQuota, 
    isLoading, 
    stats, 
    isStatsLoading,
    refreshStorageInfo, 
    refreshStorageStats 
  } = useStorageStore();
  const admin = useAuthStore(state => state.admin);
  
  const [platformVisibility, setPlatformVisibility] = useState<PlatformVisibility | null>(null);
  const [iconCacheStats, setIconCacheStats] = useState<{ count: number; size: number }>({ count: 0, size: 0 });
  const [isClearingIconCache, setIsClearingIconCache] = useState(false);
  const [isRefreshingIconCache, setIsRefreshingIconCache] = useState(false);
  const [isClearingUserData, setIsClearingUserData] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showClearUserDataConfirm, setShowClearUserDataConfirm] = useState(false);
  const [clearProgress, setClearProgress] = useState<number>(0);
  const [clearProgressMessage, setClearProgressMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshIconCacheStats = useCallback(async () => {
    setIsRefreshingIconCache(true);
    const stats = await iconCacheService.getStats();
    setIconCacheStats(stats);
    setIsRefreshingIconCache(false);
  }, []);

  const storageUsagePercent = storageQuota > 0 ? (storageUsed / storageQuota) : 0;
  const showWarning = storageUsagePercent >= STORAGE_THRESHOLD_WARNING;
  const showDanger = storageUsagePercent >= STORAGE_THRESHOLD_DANGER;

  useEffect(() => {
    if (!admin?.id) return;
    refreshIconCacheStats();
    refreshStorageInfo();
    refreshStorageStats(admin.id);
  }, [admin?.id, refreshIconCacheStats, refreshStorageInfo, refreshStorageStats]);

  useEffect(() => {
    const saved = localStorageService.get<PlatformVisibility>(STORAGE_KEYS.PLATFORM_VISIBILITY, null as unknown as PlatformVisibility);
    if (saved) {
      setPlatformVisibility(saved);
    }
  }, []);

  useEffect(() => {
    if (showWarning) {
      addToast({ 
        type: showDanger ? 'error' : 'warning', 
        message: showDanger 
          ? `存储空间即将用尽！已使用 ${(storageUsagePercent * 100).toFixed(1)}%` 
          : `存储空间使用较高，已使用 ${(storageUsagePercent * 100).toFixed(1)}%` 
      });
    }
  }, [storageUsagePercent, showWarning, showDanger, addToast]);

  const clearAllIconCache = async () => {
    setIsClearingIconCache(true);
    try {
      await iconCacheService.clearAll();
      addToast({ type: 'success', message: '图标缓存已清除' });
      await refreshIconCacheStats();
    } catch {
      addToast({ type: 'error', message: '清理失败，请重试' });
    }
    setIsClearingIconCache(false);
  };

  const clearExpiredIconCache = async () => {
    setIsClearingIconCache(true);
    try {
      await iconCacheService.clearExpired();
      addToast({ type: 'success', message: '过期图标缓存已清理' });
      await refreshIconCacheStats();
    } catch {
      addToast({ type: 'error', message: '清理失败，请重试' });
    }
    setIsClearingIconCache(false);
  };

  const handleClearUserData = async () => {
    if (!admin?.id) return;
    setShowClearUserDataConfirm(false);
    setIsClearingUserData(true);
    setClearProgress(0);
    setClearProgressMessage('');
    
    try {
      await offlineStorage.clearByUserWithProgress(admin.id, (progress, message) => {
        setClearProgress(progress);
        setClearProgressMessage(message);
      });
      addToast({ type: 'success', message: '本地数据已清除' });
      logInfo('Local user data cleared', 'StorageTab');
      await refreshStorageInfo();
      await refreshStorageStats(admin.id);
    } catch (error) {
      logError('Failed to clear user data', 'StorageTab', error as Error);
      addToast({ type: 'error', message: '清除失败，请重试' });
    } finally {
      setIsClearingUserData(false);
      setClearProgress(0);
      setClearProgressMessage('');
    }
  };

  const handleExportData = async () => {
    if (!admin?.id) return;
    setShowExportConfirm(false);
    setIsExporting(true);
    
    try {
      const data = await offlineStorage.exportUserData(admin.id);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `toolbox-backup-${admin.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      addToast({ type: 'success', message: '数据导出成功' });
      logInfo(`Data exported for user ${admin.id}`, 'StorageTab');
    } catch (error) {
      logError('Failed to export data', 'StorageTab', error as Error);
      addToast({ type: 'error', message: '导出失败，请重试' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async () => {
    if (!admin?.id || !fileInputRef.current) return;
    
    const file = fileInputRef.current.files?.[0];
    if (!file) return;
    
    setShowImportConfirm(false);
    setIsImporting(true);
    
    try {
      const text = await file.text();
      const result = await offlineStorage.importUserData(admin.id, text);
      
      if (result.success) {
        addToast({ type: 'success', message: `数据导入成功，共导入 ${result.imported} 条记录` });
      } else {
        addToast({ type: 'warning', message: `数据导入完成，${result.imported} 成功，${result.failed} 失败` });
      }
      logInfo(`Data imported for user ${admin.id}: ${result.imported} success, ${result.failed} failed`, 'StorageTab');
      await refreshStorageInfo();
      await refreshStorageStats(admin.id);
    } catch (error) {
      logError('Failed to import data', 'StorageTab', error as Error);
      addToast({ type: 'error', message: '导入失败，请检查文件格式' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const statItems = [
    { key: 'websites', label: '网站', count: stats.websites, color: 'text-blue-500', platformKey: 'website_account' as const },
    { key: 'shops', label: '店铺', count: stats.shops, color: 'text-green-500', platformKey: 'shops' as const },
    { key: 'social', label: '社媒', count: stats.social, color: 'text-purple-500', platformKey: 'social' as const },
    { key: 'emails', label: '邮箱', count: stats.emails, color: 'text-pink-500', platformKey: 'emails' as const },
    { key: 'phones', label: '手机号', count: stats.phones, color: 'text-orange-500', platformKey: 'phones' as const },
    { key: 'companies', label: '企业信息', count: stats.companies, color: 'text-cyan-500', platformKey: 'companies' as const },
    { key: 'credentials', label: '证件信息', count: stats.credentials, color: 'text-yellow-500', platformKey: 'credentials' as const },
    { key: 'generalAccounts', label: '通用', count: stats.generalAccounts, color: 'text-gray-500', platformKey: 'general' as const },
    { key: 'todo', label: '待办事项', count: stats.todo, color: 'text-indigo-500' },
    { key: 'quickReply', label: '快捷回复', count: stats.quickReply, color: 'text-teal-500' },
    { key: 'clipboard', label: '云剪贴板', count: stats.clipboard, color: 'text-purple-600' },
  ];

  return (
    <SettingCard>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={() => setShowImportConfirm(true)}
      />

      <ConfirmDialog
        isOpen={showExportConfirm}
        onClose={() => setShowExportConfirm(false)}
        title="导出数据"
        message="确定要导出当前用户的数据吗？导出的文件包含您的所有账号、密码、待办等信息，请妥善保管。"
        onConfirm={handleExportData}
        confirmText="确认导出"
        cancelText="取消"
      />

      <ConfirmDialog
        isOpen={showImportConfirm}
        onClose={() => setShowImportConfirm(false)}
        title="导入数据"
        message="确定要导入数据吗？导入的数据将与现有数据合并，重复的记录将被覆盖。"
        onConfirm={handleImportData}
        confirmText="确认导入"
        cancelText="取消"
      />

      <ConfirmDialog
        isOpen={showClearUserDataConfirm}
        onClose={() => setShowClearUserDataConfirm(false)}
        title="清除用户数据"
        message="确定要清除当前用户的所有本地数据吗？此操作不可恢复！"
        onConfirm={handleClearUserData}
        confirmText="确认清除"
        cancelText="取消"
      />

      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center text-blue-600">
            <HardDrive size={16} />
          </div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">存储使用情况</h2>
          {(showWarning || showDanger) && (
            <AlertTriangle size={16} className={`ml-2 ${showDanger ? 'text-red-500' : 'text-yellow-500'}`} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowClearUserDataConfirm(true)}
            disabled={isClearingUserData || !admin?.id}
            className="flex items-center px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClearingUserData ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3 mr-1" />
            )}
            清空数据
          </button>
          <button
            onClick={() => setShowExportConfirm(true)}
            disabled={isExporting || !admin?.id}
            className="flex items-center px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Download className="w-3 h-3 mr-1" />
            )}
            导出
          </button>
          <button
            onClick={handleFileSelect}
            disabled={isImporting || !admin?.id}
            className="flex items-center px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Upload className="w-3 h-3 mr-1" />
            )}
            导入
          </button>
          <button
            onClick={() => { 
              refreshStorageInfo(); 
              if (admin?.id) refreshStorageStats(admin.id); 
            }}
            disabled={isLoading || isStatsLoading}
            className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="刷新统计"
          >
            {isLoading || isStatsLoading ? (
              <Loader2 className="w-3 h-3 text-gray-500 animate-spin" />
            ) : (
              <Database className="w-3 h-3 text-gray-500" />
            )}
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>已使用空间</span>
            <span>{formatBytes(storageUsed)} / {formatBytes(storageQuota)}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                showDanger ? 'bg-red-500' : showWarning ? 'bg-yellow-500' : 'bg-primary'
              }`}
              style={{ width: `${storageQuota > 0 ? storageUsagePercent * 100 : 0}%` }}
            />
          </div>
          {showWarning && (
            <p className={`text-xs mt-2 ${showDanger ? 'text-red-500' : 'text-yellow-500'}`}>
              {showDanger ? '存储空间即将用尽，请及时清理！' : '建议清理不需要的数据以释放空间'}
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-6 gap-2">
          {statItems.map(item => {
            if (item.platformKey && platformVisibility && !platformVisibility[item.platformKey]) {
              return null;
            }
            return (
              <div key={item.key} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
                <div className={`text-sm font-semibold ${item.color}`}>
                  {isStatsLoading ? <Loader2 className="w-4 h-4 inline animate-spin" /> : item.count}
                </div>
              </div>
            );
          })}
        </div>
        
        {isClearingUserData && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>清理进度</span>
              <span>{clearProgressMessage}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
              <div
                className="bg-primary h-1 rounded-full transition-all"
                style={{ width: `${clearProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center text-blue-600">
              <BarChart3 size={16} />
            </div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">图标缓存管理</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearExpiredIconCache}
              disabled={isClearingIconCache}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearingIconCache ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              清理过期
            </button>
            <button
              onClick={clearAllIconCache}
              disabled={isClearingIconCache || iconCacheStats.count === 0}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearingIconCache ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              清空
            </button>
            <button
              onClick={refreshIconCacheStats}
              disabled={isRefreshingIconCache}
              className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="刷新统计"
            >
              {isRefreshingIconCache ? (
                <Loader2 className="w-3 h-3 text-gray-500 animate-spin" />
              ) : (
                <Database className="w-3 h-3 text-gray-500" />
              )}
            </button>
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">缓存图标数量</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {isRefreshingIconCache ? (
                  <Loader2 className="w-5 h-5 inline animate-spin" />
                ) : (
                  iconCacheStats.count
                )}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">缓存总大小</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {isRefreshingIconCache ? (
                  <Loader2 className="w-5 h-5 inline animate-spin" />
                ) : (
                  formatBytes(iconCacheStats.size)
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            图标缓存使用浏览器 Cache API 存储，最大容量 10MB，自动保存 7 天。
          </p>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800">
          <div className="w-5 h-5 flex items-center justify-center text-orange-600">
            <Trash2 size={16} />
          </div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">应用缓存管理</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <div>
              <span className="text-sm text-gray-700 dark:text-gray-300">清除缓存</span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                清除浏览器缓存、应用临时文件等
              </p>
            </div>
            <button
              onClick={onClearCache}
              disabled={btnLoading}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md transition-colors ${
                btnLoading
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
            >
              <Trash2 size={14} />
              {btnText}
            </button>
          </div>
        </div>
      </div>
    </SettingCard>
  );
};

export default StorageTab;