// ExternalChangeDialog —— 外部修改冲突裁决

import React, { useState } from 'react';
import { FileWarning, X } from 'lucide-react';

interface ExternalChangeDialogProps {
  fileName: string;
  onKeepMine: () => void | Promise<void>;
  onTakeExternal: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
}

const ExternalChangeDialog: React.FC<ExternalChangeDialogProps> = ({
  fileName,
  onKeepMine,
  onTakeExternal,
  onDismiss,
}) => {
  const [busy, setBusy] = useState(false);

  // 置 busy → 等动作 settle（void/Promise 都 await）→ 复位 busy
  const run = (action: () => void | Promise<void>): void => {
    setBusy(true);
    void Promise.resolve()
      .then(action)
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-surface rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-surface-60">
          <div className="flex items-center gap-2 min-w-0">
            <FileWarning className="h-5 w-5 text-warning shrink-0" />
            <h3 className="text-sm font-semibold text-content-primary truncate">
              文件在外部被修改
            </h3>
          </div>
          <button
            onClick={() => run(onDismiss)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-content-secondary hover:text-content-primary hover:bg-menu-hover transition-colors"
            title="关闭"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-content-secondary">
            <span className="text-content-primary">{fileName}</span>
            {' '}在程序外被改动，而你有未保存的修改。请选择保留哪一份：
          </p>
          <ul className="mt-2 space-y-1 text-xs text-content-tertiary">
            <li>· 保留我的：用编辑器内容写回磁盘，覆盖外部修改</li>
            <li>· 采用外部：丢弃未保存修改，载入磁盘上的最新版本</li>
          </ul>
        </div>

        <div className="flex items-center justify-center gap-3 px-4 py-3 bg-surface-40">
          <button
            onClick={() => run(onDismiss)}
            disabled={busy}
            className="px-4 py-1.5 text-sm font-medium text-content-secondary bg-surface-secondary rounded-md hover:bg-menu-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            稍后处理
          </button>
          <button
            onClick={() => run(onTakeExternal)}
            disabled={busy}
            className="px-4 py-1.5 text-sm font-medium text-error bg-surface-secondary rounded-md hover:bg-menu-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            采用外部
          </button>
          <button
            onClick={() => run(onKeepMine)}
            disabled={busy}
            className="px-4 py-1.5 text-sm font-medium text-button-text bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            保留我的
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExternalChangeDialog;
