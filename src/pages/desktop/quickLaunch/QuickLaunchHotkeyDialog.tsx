import React from 'react';
import { X } from 'lucide-react';
import type { QuickLaunchItem } from '../../../utils/quickLaunch';

interface Props {
  isOpen: boolean;
  hotkeyTargetApp: QuickLaunchItem | null;
  hotkeyInput: string;
  onClose: () => void;
  onConfirm: () => void;
  onHotkeyKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

/** 热键设置弹窗（从 QuickLaunch.tsx 拆分，行为完全一致） */
export function QuickLaunchHotkeyDialog({
  isOpen,
  hotkeyTargetApp,
  hotkeyInput,
  onClose,
  onConfirm,
  onHotkeyKeyDown,
  onClear,
}: Props) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-surface-60">
          <h2 className="text-sm font-semibold text-content-primary">
            {hotkeyTargetApp ? `设置热键 - ${hotkeyTargetApp.name}` : '设置热键'}
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
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-primary mb-2">快捷键</label>
            <div className="relative">
              <input
                type="text"
                value={hotkeyInput}
                onKeyDown={onHotkeyKeyDown}
                onChange={() => {}}
                placeholder="按下组合键（如 Ctrl+Alt+1），Esc 清除"
                readOnly
                className="w-full px-4 py-2 rounded-lg bg-surface-secondary text-content-primary placeholder-text-content-secondary focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {hotkeyInput && (
                <button
                  type="button"
                  onClick={onClear}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-content-tertiary hover:text-content-secondary rounded transition-colors"
                  title="清空"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <p className="text-xs text-content-secondary mt-2">
              支持修饰键: Ctrl / Alt / Shift / Win + 字母或数字。按 Esc 清除当前输入，留空保存则取消绑定。
            </p>
          </div>
          {hotkeyTargetApp?.hotkey && (
            <div className="text-sm text-content-primary">
              当前热键: <span className="font-mono font-semibold">{hotkeyTargetApp.hotkey}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 px-4 py-3 bg-surface-40">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-content-secondary bg-surface-secondary rounded-md hover:bg-menu-hover transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 text-sm font-medium text-button-text bg-primary hover:bg-primary/90 rounded-md transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
