// 新建 / 存在确认 / 删除确认 对话框

import React, { useState } from 'react';

export interface CreateDialogProps {
  type: 'folder' | 'note';
  onConfirm: () => void;
  onCancel: () => void;
  initialName?: string;
  onNameChange?: (name: string) => void;
}

export const CreateDialog: React.FC<CreateDialogProps> = ({
  type,
  onConfirm,
  onCancel,
  initialName = '',
  onNameChange,
}) => {
  const [name, setName] = useState(initialName);

  const handleConfirm = () => {
    if (name.trim()) {
      onConfirm();
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);
    onNameChange?.(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded-xl bg-surface p-4 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-content-primary dark:text-white">
          {type === 'folder' ? '新建文件夹' : '新建笔记'}
        </h3>

        <input
          type="text"
          className="mb-4 w-full rounded-lg bg-surface-secondary px-3 py-2 text-sm text-content-primary dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none"
          placeholder={type === 'folder' ? '文件夹名称' : '笔记名称'}
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape') onCancel();
          }}
        />

        <div className="flex justify-end gap-2">
          <button
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 dark:text-content-secondary hover:bg-menu-hover"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-button-text hover:bg-primary-hover"
            onClick={handleConfirm}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};

export interface ExistsConfirmDialogProps {
  type: 'folder' | 'note';
  name: string;
  onOverwrite: () => void;
  onCreateCopy: () => void;
  onCancel: () => void;
}

export const ExistsConfirmDialog: React.FC<ExistsConfirmDialogProps> = ({
  type,
  name,
  onOverwrite,
  onCreateCopy,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-xl bg-surface p-4 shadow-xl">
        <h3 className="mb-2 text-lg font-semibold text-content-primary dark:text-white">
          {type === 'folder' ? '文件夹已存在' : '文件已存在'}
        </h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-content-secondary">
          {type === 'folder'
            ? `文件夹 "${name}" 已存在，请选择操作：`
            : `文件 "${name}" 已存在，请选择操作：`}
        </p>

        <div className="flex flex-col gap-2">
          <button
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm text-button-text hover:bg-primary-hover"
            onClick={onOverwrite}
          >
            覆盖原有{type === 'folder' ? '文件夹' : '文件'}
          </button>
          <button
            className="w-full rounded-lg px-3 py-2 text-sm text-content-primary hover:bg-menu-hover"
            onClick={onCreateCopy}
          >
            创建副本
          </button>
          <button
            className="w-full rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-content-secondary hover:bg-menu-hover"
            onClick={onCancel}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export interface DeleteConfirmDialogProps {
  type: 'folder' | 'file';
  name: string;
  /** true：移入系统回收站（可恢复）；false：彻底删除 */
  toTrash?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  type,
  name,
  toTrash = false,
  onConfirm,
  onCancel,
}) => {
  const target = type === 'folder' ? `文件夹 "${name}" 及其所有内容` : `文件 "${name}"`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-xl bg-surface p-4 shadow-xl">
        <h3 className="mb-2 text-lg font-semibold text-content-primary dark:text-white">
          {toTrash ? '确认移入回收站' : '确认删除'}
        </h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-content-secondary">
          {toTrash
            ? `确定要将${target}移入回收站吗？可在系统回收站中还原。`
            : `确定要删除${target}吗？此操作不可撤销。`}
        </p>

        <div className="flex justify-end gap-2">
          <button
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 dark:text-content-secondary hover:bg-menu-hover"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm ${
              toTrash
                ? 'bg-primary text-button-text hover:bg-primary-hover'
                : 'bg-error text-white hover:bg-error/80'
            }`}
            onClick={onConfirm}
          >
            {toTrash ? '移入回收站' : '删除'}
          </button>
        </div>
      </div>
    </div>
  );
};