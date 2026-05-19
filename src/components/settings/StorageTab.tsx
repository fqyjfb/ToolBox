import React, { useState, useEffect } from 'react';
import { Database, Folder, Trash2, Loader2 } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import { logError } from '../../services/loggerService';
import { iconCacheService } from '../../services/iconCacheService';

interface StorageTabProps {
  onClearCache: () => void;
  btnLoading: boolean;
  btnText: string;
}

const StorageTab: React.FC<StorageTabProps> = ({ onClearCache, btnLoading, btnText }) => {
  const addToast = useToastStore(state => state.addToast);
  const [dataPath, setDataPath] = useState<string>('');
  const [iconCacheStats, setIconCacheStats] = useState<{ count: number; size: number }>({ count: 0, size: 0 });
  const [isClearingIconCache, setIsClearingIconCache] = useState(false);
  const [isRefreshingIconCache, setIsRefreshingIconCache] = useState(false);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const refreshIconCacheStats = async () => {
    setIsRefreshingIconCache(true);
    const stats = await iconCacheService.getStats();
    setIconCacheStats(stats);
    setIsRefreshingIconCache(false);
  };

  useEffect(() => {
    const fetchDataPath = async () => {
      try {
        const path = await window.electron?.getUserDataPath();
        if (path) {
          setTimeout(() => setDataPath(path), 0);
        }
      } catch (error) {
        logError('Failed to load data path', 'StorageTab', error as Error);
      }
    };
    fetchDataPath();
    setTimeout(() => refreshIconCacheStats(), 0);
  }, []);

  const clearAllIconCache = async () => {
    setIsClearingIconCache(true);
    try {
      await iconCacheService.clearAll();
      addToast({ type: 'success', message: '图标缓存已清理' });
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

  const handleOpenFolder = async () => {
    try {
      if (window.electron) {
        await window.electron.openUserDataFolder();
      }
    } catch (error) {
      addToast({ type: 'error', message: '无法打开文件夹' });
      logError('Failed to open folder', 'StorageTab', error as Error);
    }
  };

  return (
    <>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
        onClick={handleOpenFolder}
      >
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="w-5 h-5 flex items-center justify-center text-blue-600">
            <Database size={16} />
          </div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">数据库</h2>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Folder className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-500 dark:text-gray-400">文件存放位置</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono break-all">
            {dataPath || '加载中...'}
          </p>
          <p className="text-xs text-blue-500 mt-2">
            查看
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 mt-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center text-blue-600">
              <Database size={16} />
            </div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">图标缓存管理</h2>
          </div>
          <button
            onClick={refreshIconCacheStats}
            disabled={isRefreshingIconCache}
            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="刷新统计"
          >
            {isRefreshingIconCache ? (
              <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
            ) : (
              <Database className="w-4 h-4 text-gray-500" />
            )}
          </button>
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
                  formatSize(iconCacheStats.size)
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={clearExpiredIconCache}
              disabled={isClearingIconCache}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm rounded-md transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearingIconCache ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              清理过期图标
            </button>
            <button
              onClick={clearAllIconCache}
              disabled={isClearingIconCache || iconCacheStats.count === 0}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm rounded-md transition-colors bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearingIconCache ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              清空所有图标
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            图标缓存使用浏览器 Cache API 存储，最大容量 10MB，自动保存 7 天。
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 mt-4">
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
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
    </>
  );
};

export default StorageTab;