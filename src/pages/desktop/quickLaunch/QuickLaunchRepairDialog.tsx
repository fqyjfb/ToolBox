import { FolderOpen, Trash2, X } from 'lucide-react';
import type { QuickLaunchItem } from '../../../utils/quickLaunch';

interface Props {
  isOpen: boolean;
  invalidApps: QuickLaunchItem[];
  onClose: () => void;
  onRelocate: (appId: string) => void;
  onRemove: (appId: string) => void;
}

/** 失效应用修复弹窗（从 QuickLaunch.tsx 拆分，行为完全一致） */
export function QuickLaunchRepairDialog({
  isOpen,
  invalidApps,
  onClose,
  onRelocate,
  onRemove,
}: Props) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-surface-60">
          <h2 className="text-sm font-semibold text-content-primary">
            修复失效应用 ({invalidApps.length})
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-content-secondary hover:text-content-primary hover:bg-menu-hover transition-colors"
            title="关闭"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-96 overflow-auto">
          {invalidApps.map(app => (
            <div key={app.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-surface-secondary">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-content-primary truncate">{app.name}</p>
                <p className="text-xs text-content-secondary truncate">{app.path}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onRelocate(app.id)}
                  className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                  title="重新定位"
                >
                  <FolderOpen size={16} />
                </button>
                <button
                  onClick={() => onRemove(app.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  title="移除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center px-4 py-3 bg-surface-40">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-button-text bg-primary hover:bg-primary/90 rounded-md transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
