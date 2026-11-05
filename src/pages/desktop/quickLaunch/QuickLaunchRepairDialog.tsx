import { FolderOpen, Trash2 } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-primary border border-content rounded-xl shadow-2xl p-6 m-4">
        <h2 className="text-lg font-semibold text-content-primary mb-4">
          修复失效应用 ({invalidApps.length})
        </h2>
        <div className="space-y-2 max-h-96 overflow-auto">
          {invalidApps.map(app => (
            <div key={app.id} className="flex items-center justify-between gap-2 p-2 rounded border border-content">
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
        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="btn-primary">关闭</button>
        </div>
      </div>
    </div>
  );
}
