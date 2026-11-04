import { useCallback, useEffect, useRef } from 'react';
import './PlainTextEditor.css';

export interface PlainTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  placeholder?: string;
  readonly?: boolean;
  className?: string;
  /** 是否在组件内处理 Ctrl+S；宿主已统一注册快捷键时传 false，避免一次按键触发两次保存 */
  registerSaveShortcut?: boolean;
}

/**
 * 纯文本源码编辑器（HTML / JSON / TXT 等）。
 *
 * 🔴 为什么必须有它而不是统一用 MarkdownEditor：
 * 块投影会把 HTML 标签（`<div>`）、JSON 花括号（`{`）误判为块结构，
 * 导致源码被"渲染"破坏。非 Markdown 文件必须走纯文本通道。
 *
 * 与 `AutoResizeTextarea` 的区别：那是 account 面板的**表单小控件**
 * （非等宽、无长文本优化，被 7 个面板共用），这里需要等宽 + 大文本承载，
 * 故独立实现，不去改共享组件。
 */
export function PlainTextEditor({
  value,
  onChange,
  onSave,
  placeholder,
  readonly = false,
  className,
  registerSaveShortcut = true,
}: PlainTextEditorProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // 回调用 ref 持有：identity 变化不应触发重建
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl/Cmd+S 保存（宿主已统一注册时跳过）
      if (
        registerSaveShortcut &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 's'
      ) {
        event.preventDefault();
        onSaveRef.current?.(value);
        return;
      }
      // Tab 插入两个空格，而不是跳焦点（源码编辑的常规预期）
      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        const el = event.currentTarget;
        const { selectionStart, selectionEnd } = el;
        const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
        onChange(next);
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = selectionStart + 2;
        });
      }
    },
    [onChange, registerSaveShortcut, value],
  );

  // 切换文件时把光标/滚动重置到开头
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [value]);

  return (
    <div className={className ? `pte ${className}` : 'pte'}>
      <textarea
        ref={ref}
        className="pte-area"
        value={value}
        spellCheck={false}
        readOnly={readonly}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="源码编辑器"
      />
    </div>
  );
}

export default PlainTextEditor;
