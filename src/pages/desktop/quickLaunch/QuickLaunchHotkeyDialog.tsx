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
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface-primary border border-content rounded-xl shadow-2xl p-6 m-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-content-tertiary hover:text-content-secondary transition-colors"
          title="关闭"
          aria-label="关闭"
        >
          <X size={18} />
        </button>
        <h2 className="text-lg font-semibold text-content-primary mb-4">
          {hotkeyTargetApp ? `设置热键 - ${hotkeyTargetApp.name}` : '设置热键'}
        </h2>
        <div className="space-y-4">
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
                className="w-full px-4 py-2 border-content rounded-lg bg-surface-secondary text-content-primary placeholder-text-content-secondary focus:outline-none focus:border-[var(--color-primary)]"
                style={{ borderWidth: '1px', borderColor: 'var(--color-border)' }}
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
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary">取消</button>
          <button onClick={onConfirm} className="btn-primary">保存</button>
        </div>
      </div>
    </div>
  );
}
