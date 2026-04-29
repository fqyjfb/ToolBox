import React from 'react';
import { Keyboard, Info } from 'lucide-react';
import ShortcutRow from './ShortcutRow';
import { ShortcutItem } from '../../types/settings';

interface ShortcutsTabProps {
  shortcuts: ShortcutItem[];
  onUpdateShortcut: (shortcut: ShortcutItem) => void;
}

const ShortcutsTab: React.FC<ShortcutsTabProps> = ({ shortcuts, onUpdateShortcut }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="w-5 h-5 flex items-center justify-center text-primary">
          <Keyboard size={16} />
        </div>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">快捷键设置</h2>
      </div>
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-2">
          <Info size={14} className="text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p>1. 全局快捷键标记：程序失去焦点后也能使用</p>
            <p>2. 在macOS系统：Ctrl === Command键，Alt === Option键</p>
            <p>3. 自定义快捷键时，先点击输入框获取焦点，然后按下新的快捷键组合</p>
          </div>
        </div>
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
            onUpdate={onUpdateShortcut}
          />
        ))}
      </div>
    </div>
  );
};

export default ShortcutsTab;
