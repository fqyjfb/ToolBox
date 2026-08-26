import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Wrench, RefreshCw, FolderOpen, Search, Play } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const formatDate = (mtimeMs: number): string => {
  const date = new Date(mtimeMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const OfflineToolsPage: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);

  const [dirPath, setDirPath] = useState<string | null>(null);
  const [files, setFiles] = useState<OfflineToolFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadFiles = useCallback(async (targetDir: string | null) => {
    if (!targetDir || !window.electron?.offlineTools) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await window.electron.offlineTools.list(targetDir);
      if (result.success) {
        setFiles(result.files);
      } else {
        setFiles([]);
        setLoadError(result.error || '读取目录失败');
      }
    } catch {
      setLoadError('读取目录失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initDir = async () => {
      const saved = await window.electron?.offlineTools?.getDir();
      if (saved) {
        setDirPath(saved);
        loadFiles(saved);
      }
    };
    initDir();
  }, [loadFiles]);

  const handleSelectDir = useCallback(async () => {
    if (!window.electron?.offlineTools) return;
    const selected = await window.electron.selectFolder();
    if (!selected) return;
    const result = await window.electron.offlineTools.setDir(selected);
    if (result.success) {
      setDirPath(selected);
      loadFiles(selected);
    } else {
      addToast({ message: result.error || '设置目录失败', type: 'error' });
    }
  }, [addToast, loadFiles]);

  const handleOpenFile = useCallback(async (file: OfflineToolFile) => {
    const result = await window.electron?.offlineTools?.open(file.path);
    if (result && !result.success) {
      addToast({ message: result.error || '打开文件失败', type: 'error' });
    }
  }, [addToast]);

  const handleRefresh = useCallback(() => {
    loadFiles(dirPath);
  }, [dirPath, loadFiles]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    const query = searchQuery.toLowerCase();
    return files.filter(f =>
      f.name.toLowerCase().includes(query) ||
      f.fileName.toLowerCase().includes(query)
    );
  }, [files, searchQuery]);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Wrench className="w-4 h-4 text-button-text" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">离线工具</h1>
          {dirPath && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md" title={dirPath}>{dirPath}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {dirPath && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 pl-8 pr-3 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:border-primary text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
              <button
                onClick={handleRefresh}
                className="w-6 h-6 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                title="刷新"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}
          <button
            onClick={handleSelectDir}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <FolderOpen className="w-3 h-3" />
            选择目录
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !dirPath ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <FolderOpen className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">请先选择包含 HTML 工具的目录</p>
            <button
              onClick={handleSelectDir}
              className="mt-3 px-4 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              选择目录
            </button>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Wrench className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">{loadError}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 px-4 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              刷新
            </button>
          </div>
        ) : filteredFiles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredFiles.map((file) => (
              <div
                key={file.path}
                className="group relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md transition-all duration-200 cursor-pointer"
                onClick={() => handleOpenFile(file)}
                title={`在新窗口打开 ${file.fileName}`}
              >
                <div className="flex items-start gap-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
                    <Wrench className="w-5 h-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {file.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {file.fileName}
                    </p>

                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
                        {formatFileSize(file.size)}
                      </span>
                      <span className="px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded">
                        {formatDate(file.mtimeMs)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate pr-2" title={file.path}>
                    {file.fileName}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFile(file);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-button-text bg-primary dark:bg-primary rounded-md hover:bg-primary/90 dark:hover:bg-primary/90 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    运行
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : searchQuery ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Search className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">没有找到匹配的工具</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Wrench className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">该目录下没有 HTML 文件</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflineToolsPage;
