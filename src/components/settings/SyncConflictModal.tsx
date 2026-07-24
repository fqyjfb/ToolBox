import React from 'react';
import { AlertTriangle, HardDrive, Cloud } from 'lucide-react';
import Modal from '../ui/Modal';
import { ConflictItem } from '../../types/offline';

interface SyncConflictModalProps {
  conflicts: ConflictItem[];
  isOpen: boolean;
  onClose: () => void;
  onResolve: (conflictId: string, keepLocal: boolean) => void;
}

const TABLE_LABELS: Record<string, string> = {
  todos: '待办事项',
  todo_categories: '待办分类',
  shops: '店铺',
  social_accounts: '社交账号',
  emails: '邮箱',
  phones: '电话',
  companies: '公司',
  credentials: '凭证',
  general_accounts: '通用账号',
  website_accounts: '网站账号',
  website_account_categories: '网站分类',
  quick_replies: '快捷回复',
  quick_reply_categories: '快捷回复分类',
  clipboard_items: '剪贴板',
  clipboard_categories: '剪贴板分类',
};

const getTableNameLabel = (tableName: string): string => TABLE_LABELS[tableName] || tableName;

const getTimeAgo = (dateString: string): string => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  return `${diffDays}天前`;
};

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
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          检测到 {conflicts.length} 个冲突
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        请选择保留本地版本或云端版本
      </p>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {conflicts.map(conflict => (
          <div
            key={conflict.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                {getTableNameLabel(conflict.tableName)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ID: {conflict.recordId.slice(0, 8)}...
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <HardDrive size={12} className="text-blue-500" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">本地版本</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                  更新于: {getTimeAgo(conflict.local.updated_at)}
                </div>
                <pre className="text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 p-1.5 rounded overflow-x-auto max-h-24 overflow-y-auto">
                  {JSON.stringify(conflict.local, null, 2)}
                </pre>
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Cloud size={12} className="text-green-500" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">云端版本</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                  更新于: {getTimeAgo(conflict.cloud.updated_at)}
                </div>
                <pre className="text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 p-1.5 rounded overflow-x-auto max-h-24 overflow-y-auto">
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
                className="px-2.5 py-1 text-xs bg-gray-600 dark:bg-gray-500 text-white dark:text-gray-200 rounded-md hover:bg-gray-700 dark:hover:bg-gray-400 transition-colors"
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
