// 新建 / 存在确认 / 删除确认 对话框

import React, { useState } from 'react';
import { X } from 'lucide-react';

const BTN_SECONDARY =
  'px-4 py-1.5 text-sm font-medium text-content-secondary bg-surface-secondary rounded-md hover:bg-menu-hover transition-colors';
const BTN_PRIMARY =
  'px-4 py-1.5 text-sm font-medium text-button-text bg-primary hover:bg-primary/90 rounded-md transition-colors';
const BTN_DANGER =
  'px-4 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors';

interface DialogShellProps {
  title: string;
  onClose: () => void;
  widthClass?: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}

/** 与共享 Modal 一致的头部 / 内容 / 底部结构 */
const DialogShell: React.FC<DialogShellProps> = ({
  title,
  onClose,
  widthClass = 'max-w-md',
  footer,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
    <div className={`relative w-full ${widthClass} bg-surface rounded-lg shadow-lg overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-3 bg-surface-60">
        <h3 className="text-sm font-semibold text-content-primary">{title}</h3>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-content-secondary hover:text-content-primary hover:bg-menu-hover transition-colors"
          title="关闭"
          aria-label="关闭"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-4">{children}</div>
      <div className="flex items-center justify-center gap-3 px-4 py-3 bg-surface-40">{footer}</div>
    </div>
  </div>
);

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
    <DialogShell
      title={type === 'folder' ? '新建文件夹' : '新建笔记'}
      onClose={onCancel}
      widthClass="max-w-sm"
      footer={(
        <>
          <button className={BTN_SECONDARY} onClick={onCancel}>取消</button>
          <button className={BTN_PRIMARY} onClick={handleConfirm}>确定</button>
        </>
      )}
    >
      <input
        type="text"
        className="w-full rounded-lg bg-surface-secondary px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary focus:ring-2 focus:ring-primary/30 focus:outline-none"
        placeholder={type === 'folder' ? '文件夹名称' : '笔记名称'}
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleConfirm();
          if (e.key === 'Escape') onCancel();
        }}
      />
    </DialogShell>
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
    <DialogShell
      title={type === 'folder' ? '文件夹已存在' : '文件已存在'}
      onClose={onCancel}
      widthClass="max-w-md"
      footer={(
        <>
          <button className={BTN_SECONDARY} onClick={onCancel}>取消</button>
          <button className={BTN_SECONDARY} onClick={onCreateCopy}>创建副本</button>
          <button className={BTN_PRIMARY} onClick={onOverwrite}>
            覆盖原有{type === 'folder' ? '文件夹' : '文件'}
          </button>
        </>
      )}
    >
      <p className="text-sm text-content-secondary">
        {type === 'folder'
          ? `文件夹 "${name}" 已存在，请选择操作：`
          : `文件 "${name}" 已存在，请选择操作：`}
      </p>
    </DialogShell>
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
    <DialogShell
      title={toTrash ? '确认移入回收站' : '确认删除'}
      onClose={onCancel}
      widthClass="max-w-md"
      footer={(
        <>
          <button className={BTN_SECONDARY} onClick={onCancel}>取消</button>
          <button className={toTrash ? BTN_PRIMARY : BTN_DANGER} onClick={onConfirm}>
            {toTrash ? '移入回收站' : '删除'}
          </button>
        </>
      )}
    >
      <p className="text-sm text-content-secondary">
        {toTrash
          ? `确定要将${target}移入回收站吗？可在系统回收站中还原。`
          : `确定要删除${target}吗？此操作不可撤销。`}
      </p>
    </DialogShell>
  );
};
