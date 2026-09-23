import React from 'react';
import { AlertTriangle, HardDrive, Cloud } from 'lucide-react';
import Modal from '../ui/Modal';
import { ConflictItem } from '../../types/offline';
import { getTableNameLabel, getTimeAgo } from '../../constants/offline';

interface SyncConflictModalProps {
  conflicts: ConflictItem[];
  isOpen: boolean;
  onClose: () => void;
  onResolve: (conflictId: string, keepLocal: boolean) => void;
}

const SyncConflictModal: React.FC<SyncConflictModalProps> = ({ conflicts, isOpen, onClose, onResolve }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="同步冲突处理"
      showCancel={false}
      showConfirm={false}
      size="lg"
    >
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={16} className="text-orange-500" />
        <span className="text-sm font-medium text-content-primary">
          检测到 {conflicts.length} 个冲突
        </span>
      </div>
      <p className="text-xs text-content-secondary mb-3">
        请选择保留本地版本或云端版本
      </p>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {conflicts.map(conflict => (
          <div
            key={conflict.id}
            className="rounded-lg p-3 bg-surface"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-xs font-medium bg-surface-secondary text-content-secondary rounded">
                {getTableNameLabel(conflict.tableName)}
              </span>
              <span className="text-xs text-content-secondary">
                ID: {conflict.recordId.slice(0, 8)}...
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-2 bg-surface-secondary">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <HardDrive size={12} className="text-blue-500" />
                  <span className="text-xs font-medium text-content-primary">本地版本</span>
                </div>
                <div className="text-xs text-content-secondary mb-1.5">
                  更新于: {getTimeAgo(conflict.local.updated_at)}
                </div>
                <pre className="text-xs text-content-secondary bg-surface p-1.5 rounded overflow-x-auto max-h-24 overflow-y-auto">
                  {JSON.stringify(conflict.local, null, 2)}
                </pre>
              </div>
              <div className="rounded-lg p-2 bg-surface-secondary">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Cloud size={12} className="text-green-500" />
                  <span className="text-xs font-medium text-content-primary">云端版本</span>
                </div>
                <div className="text-xs text-content-secondary mb-1.5">
                  更新于: {getTimeAgo(conflict.cloud.updated_at)}
                </div>
                <pre className="text-xs text-content-secondary bg-surface p-1.5 rounded overflow-x-auto max-h-24 overflow-y-auto">
                  {JSON.stringify(conflict.cloud, null, 2)}
                </pre>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={() => onResolve(conflict.id, true)}
                className="px-2.5 py-1 text-xs bg-primary text-button-text rounded-md hover:bg-primary-hover transition-colors"
              >
                保留本地
              </button>
              <button
                onClick={() => onResolve(conflict.id, false)}
                className="px-2.5 py-1 text-xs bg-gray-600 dark:bg-gray-500 text-button-text rounded-md hover:bg-gray-700 dark:hover:bg-gray-400 transition-colors"
              >
                保留云端
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default SyncConflictModal;
