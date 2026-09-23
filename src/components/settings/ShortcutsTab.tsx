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
      <div className="flex items-center justify-between p-4 settings-section-header">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center text-primary">
            <Keyboard size={16} />
          </div>
          <h2 className="text-sm font-semibold text-content-primary">快捷键设置</h2>
        </div>
        {onResetShortcuts && (
          <button
            onClick={onResetShortcuts}
            className="px-3 py-1.5 text-xs text-content-secondary hover:text-content-primary hover:bg-menu-hover rounded-md transition-colors"
          >
            恢复默认
          </button>
        )}
      </div>
      <div className="settings-section-header px-4 py-2">
        <div className="flex items-center">
          <div className="flex-1 text-sm font-medium text-content-secondary">功能描述</div>
          <div className="w-48 text-center text-sm font-medium text-content-secondary">自定义快捷键</div>
          <div className="w-12 text-center text-sm font-medium text-content-secondary">状态</div>
        </div>
      </div>
      <div className="">
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
