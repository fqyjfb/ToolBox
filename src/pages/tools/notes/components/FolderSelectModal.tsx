import React from 'react';
import { FolderOpen, FileText, HardDrive, CloudOff, Loader2 } from 'lucide-react';

interface FolderSelectModalProps {
  onSelect: () => Promise<boolean>;
  loading: boolean;
}

const FolderSelectModal: React.FC<FolderSelectModalProps> = ({ onSelect, loading }) => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-xl">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
          <FolderOpen className="h-12 w-12 text-blue-500" />
        </div>

        <div className="text-center">
          <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
            选择笔记存储位置
          </h2>
          <p className="max-w-sm text-sm text-gray-600 dark:text-gray-300">
            请选择一个文件夹用于存储您的笔记文件。所有笔记将以 Markdown
            格式保存在该文件夹中。
          </p>
        </div>

        <div className="grid w-full max-w-sm grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 p-3">
            <FileText className="h-6 w-6 text-blue-500" />
            <span className="text-xs text-gray-600 dark:text-gray-300">Markdown 格式</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 p-3">
            <HardDrive className="h-6 w-6 text-blue-500" />
            <span className="text-xs text-gray-600 dark:text-gray-300">本地存储</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 p-3">
            <FolderOpen className="h-6 w-6 text-blue-500" />
            <span className="text-xs text-gray-600 dark:text-gray-300">文件夹管理</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 p-3">
            <CloudOff className="h-6 w-6 text-blue-500" />
            <span className="text-xs text-gray-600 dark:text-gray-300">离线可用</span>
          </div>
        </div>

        <button
          className="flex w-full max-w-sm items-center justify-center gap-2 rounded-lg bg-blue-500 py-3 font-medium text-white transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
          onClick={onSelect}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              正在处理...
            </>
          ) : (
            <>
              <FolderOpen className="h-5 w-5" />
              选择文件夹
            </>
          )}
        </button>

        <p className="text-xs text-gray-400">
          您可以随时更改存储位置
        </p>
      </div>
    </div>
  );
};

export default FolderSelectModal;