// 草稿恢复弹窗

import React, { useState } from 'react';
import { AlertCircle, Trash2, RotateCcw, X } from 'lucide-react';
import type { DraftInfo } from '../hooks/useNotesDraftRecovery';

const basenameOf = (absolutePath: string): string =>
  String(absolutePath).split(/[\\/]/).pop() ?? '';

interface DraftRecoveryDialogProps {
  isOpen: boolean;
  drafts: DraftInfo[];
  onRecover: (draft: DraftInfo) => Promise<void> | void;
  onDiscard: (draft: DraftInfo) => Promise<void> | void;
  onClose: () => void;
}

const DraftRecoveryDialog: React.FC<DraftRecoveryDialogProps> = ({
  isOpen,
  drafts,
  onRecover,
  onDiscard,
  onClose,
}) => {
  const [busy, setBusy] = useState<string | null>(null);

  if (!isOpen || drafts.length === 0) return null;

  const handleRecoverAll = async () => {
    setBusy('all');
    try {
      for (const d of drafts) await onRecover(d);
      onClose();
    } finally {
      setBusy(null);
    }
  };
  const handleDiscardAll = async () => {
    setBusy('all');
    try {
      for (const d of drafts) await onDiscard(d);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-surface rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-surface-60">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            <h3 className="text-sm font-semibold text-content-primary">
              检测到未提交的草稿
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-content-secondary hover:text-content-primary hover:bg-menu-hover transition-colors"
            title="关闭"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 max-h-72 overflow-y-auto scrollbar-5px">
          <p className="text-sm text-content-secondary mb-3">
            上次退出时存在 {drafts.length} 个未保存的草稿，请选择恢复或丢弃：
          </p>
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li
                key={d.hash}
                className="flex items-center justify-between text-sm rounded px-3 py-2 bg-surface-secondary"
              >
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm text-content-primary truncate"
                    title={`草稿 hash: ${d.hash}`}
                  >
                    {basenameOf(d.absolutePath)}
                  </div>
                  <div
                    className="text-xs text-content-tertiary mt-0.5 truncate"
                    title={d.absolutePath}
                  >
                    {d.absolutePath} · {d.size} 字节 · {new Date(d.mtime).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={async () => {
                      setBusy(d.hash);
                      try {
                        await onRecover(d);
                      } finally {
                        setBusy(null);
                      }
                    }}
                    disabled={busy !== null}
                    className="p-1 rounded text-primary hover:bg-primary/10 disabled:opacity-50"
                    title="恢复"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      setBusy(d.hash);
                      try {
                        await onDiscard(d);
                      } finally {
                        setBusy(null);
                      }
                    }}
                    disabled={busy !== null}
                    className="p-1 rounded text-error hover:bg-error/10 disabled:opacity-50"
                    title="丢弃"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-center gap-3 px-4 py-3 bg-surface-40">
          <button
            onClick={handleDiscardAll}
            disabled={busy !== null}
            className="px-4 py-1.5 text-sm font-medium text-content-secondary bg-surface-secondary rounded-md hover:bg-menu-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            全部丢弃
          </button>
          <button
            onClick={handleRecoverAll}
            disabled={busy !== null}
            className="px-4 py-1.5 text-sm font-medium text-button-text bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            全部恢复
          </button>
        </div>
      </div>
    </div>
  );
};

export default DraftRecoveryDialog;