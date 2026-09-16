// ExternalChangeDialog —— 外部修改冲突裁决（纯展示组件，动作由 props 传入）。
// busy：任一按钮点击后禁用全部，动作 settle（void/Promise 都 await）后复位。

import React, { useState } from 'react';
import { FileWarning } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[460px] max-w-[92vw] rounded-lg bg-card shadow-xl border border-border">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <FileWarning className="h-5 w-5 text-warning shrink-0" />
          <h3 className="text-base font-medium text-text-primary truncate">
            文件在外部被修改
          </h3>
        </div>

        <div className="px-4 py-3">
          <p className="text-sm text-text-secondary">
            <span className="text-text-primary">{fileName}</span>
            {' '}在程序外被改动，而你有未保存的修改。请选择保留哪一份：
          </p>
          <ul className="mt-2 space-y-1 text-xs text-text-tertiary">
            <li>· 保留我的：用编辑器内容写回磁盘，覆盖外部修改</li>
            <li>· 采用外部：丢弃未保存修改，载入磁盘上的最新版本</li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={() => run(onDismiss)}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded text-text-secondary hover:bg-card-hover disabled:opacity-50"
          >
            稍后处理
          </button>
          <button
            onClick={() => run(onTakeExternal)}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded text-error hover:bg-card-hover disabled:opacity-50"
          >
            采用外部
          </button>
          <button
            onClick={() => run(onKeepMine)}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded bg-primary text-button-text hover:bg-primary-hover disabled:opacity-50"
          >
            保留我的
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExternalChangeDialog;
