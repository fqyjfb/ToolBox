import React, { useState, useEffect } from 'react';
import { Database, Folder, Trash2 } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import { logError } from '../../services/loggerService';

interface StorageTabProps {
  onClearCache: () => void;
  btnLoading: boolean;
  btnText: string;
}

const StorageTab: React.FC<StorageTabProps> = ({ onClearCache, btnLoading, btnText }) => {
  const addToast = useToastStore(state => state.addToast);
  const [dataPath, setDataPath] = useState<string>('');

  useEffect(() => {
    const fetchDataPath = async () => {
      try {
        if (window.electron) {
          const path = await window.electron.getUserDataPath();
          setTimeout(() => setDataPath(path), 0);
        }
      } catch (error) {
        logError('Failed to load data path', 'StorageTab', error as Error);
      }
    };
    fetchDataPath();
  }, []);

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
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="w-5 h-5 flex items-center justify-center text-orange-600">
            <Trash2 size={16} />
          </div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">缓存管理</h2>
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
