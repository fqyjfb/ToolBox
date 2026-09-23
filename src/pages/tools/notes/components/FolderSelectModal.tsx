import React from 'react';
import { FolderOpen, FileText, HardDrive, CloudOff, Loader2 } from 'lucide-react';

interface FolderSelectModalProps {
  onSelect: () => Promise<boolean>;
  loading: boolean;
}

const FolderSelectModal: React.FC<FolderSelectModalProps> = ({ onSelect, loading }) => {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-6 rounded-2xl bg-surface p-8 shadow-xl">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/20">
          <FolderOpen className="h-12 w-12 text-primary" />
        </div>

        <div className="text-center">
          <h2 className="mb-2 text-xl font-bold text-content-primary dark:text-white">
            选择对话存储位置
          </h2>
          <p className="max-w-sm text-sm text-gray-600 dark:text-content-secondary">
            请选择一个文件夹作为对话路径。对话记录与整理过程会保存在该文件夹中；
            选择完成后，可在左侧列表固定目录来查看其中的笔记文件。
          </p>
        </div>

        <div className="grid w-full max-w-sm grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-surface-secondary p-3">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xs text-gray-600 dark:text-content-secondary">Markdown 格式</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-surface-secondary p-3">
            <HardDrive className="h-6 w-6 text-primary" />
            <span className="text-xs text-gray-600 dark:text-content-secondary">本地存储</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-surface-secondary p-3">
            <FolderOpen className="h-6 w-6 text-primary" />
            <span className="text-xs text-gray-600 dark:text-content-secondary">文件夹管理</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-surface-secondary p-3">
            <CloudOff className="h-6 w-6 text-primary" />
            <span className="text-xs text-gray-600 dark:text-content-secondary">离线可用</span>
          </div>
        </div>

        <button
          className="flex w-full max-w-sm items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium text-button-text transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
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

        <p className="text-xs text-content-tertiary">
          您可以随时更改对话存储位置
        </p>
      </div>
    </div>
  );
};

export default FolderSelectModal;