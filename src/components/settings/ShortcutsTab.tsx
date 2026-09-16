import React from 'react';
import { Keyboard } from 'lucide-react';
import ShortcutRow from './ShortcutRow';
import SettingCard from './SettingCard';
import { ShortcutItem } from '../../types/settings';

interface ShortcutsTabProps {
  shortcuts: ShortcutItem[];
  onUpdateShortcut: (shortcut: ShortcutItem) => void;
  onResetShortcuts?: () => void;
}

const ShortcutsTab: React.FC<ShortcutsTabProps> = ({ shortcuts, onUpdateShortcut, onResetShortcuts }) => {
  return (
    <SettingCard>
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center text-primary">
            <Keyboard size={16} />
          </div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">快捷键设置</h2>
        </div>
        {onResetShortcuts && (
          <button
            onClick={onResetShortcuts}
            className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            恢复默认
          </button>
        )}
      </div>
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2">
        <div className="flex items-center">
          <div className="flex-1 text-sm font-medium text-gray-600 dark:text-gray-400">功能描述</div>
          <div className="w-48 text-center text-sm font-medium text-gray-600 dark:text-gray-400">自定义快捷键</div>
          <div className="w-12 text-center text-sm font-medium text-gray-600 dark:text-gray-400">状态</div>
        </div>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {shortcuts.map(shortcut => (
          <ShortcutRow
            key={shortcut.id}
            shortcut={shortcut}
            allShortcuts={shortcuts}
            onUpdate={onUpdateShortcut}
          />
        ))}
      </div>
    </SettingCard>
  );
};

export default ShortcutsTab;
