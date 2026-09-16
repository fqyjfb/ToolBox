// TagPicker —— 收起态是单行按钮（至多 2 个 chip + 「+N」），点击展开面板增删标签。
// 面板必须 createPortal + fixed 挂到 body，否则会落在头部层叠上下文里被 Vditor 工具栏盖住。

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Tag as TagIcon, X } from 'lucide-react';

export interface TagPickerProps {
  filePath: string | null;
  tags: string[];
  knownTags: ReadonlyArray<{ tag: string; count: number; paths: string[] }>;
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  max?: number;
}

const VISIBLE_CHIPS = 2;
const PANEL_Z = 1000;

const TagPicker: React.FC<TagPickerProps> = ({
  filePath,
  tags,
  knownTags,
  onChange,
  disabled = false,
  max = 8,
}) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // 面板的 fixed 定位（相对视口），打开时按触发按钮的位置算出来
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);

  // 顶部贴按钮下沿，右边与按钮右缘对齐
  const placePanel = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPanelPos({
      top: rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  };

  const togglePanel = () => {
    if (open) {
      setOpen(false);
      return;
    }
    placePanel();
    setOpen(true);
  };

  // 打开期间窗口尺寸变化 → 重新定位（fixed 面板不会自己跟随）
  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('resize', placePanel);
    return () => window.removeEventListener('resize', placePanel);
  }, [open]);

  // 候选建议：来自 knownTags，排除已选，按 tag 包含 query 过滤
  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    const selected = new Set(tags);
    return knownTags
      .filter((t) => !selected.has(t.tag))
      .filter((t) => !q || t.tag.toLowerCase().includes(q))
      .slice(0, 8);
  }, [knownTags, tags, input]);

  const canAdd = !disabled && tags.length < max && input.trim().length > 0;

  // 展开后聚焦输入框；收起时清空草稿
  useEffect(() => {
    if (!open) {
      setInput('');
      return undefined;
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const handleAdd = (raw: string) => {
    const v = raw.trim().replace(/^["']|["']$/g, '');
    if (!v || disabled || tags.length >= max) return;
    if (tags.includes(v)) {
      setInput('');
      return;
    }
    onChange([...tags, v]);
    setInput('');
  };

  const handleRemove = (tag: string) => {
    if (disabled) return;
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd(input);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const visibleChips = tags.slice(0, VISIBLE_CHIPS);
  const hiddenCount = tags.length - visibleChips.length;

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={togglePanel}
        className={`flex max-w-[200px] items-center gap-1 rounded-md border border-border bg-bg-secondary px-2 py-1 text-xs transition-colors ${
          disabled ? 'opacity-60' : 'hover:border-primary/60'
        } ${open ? 'border-primary/60' : ''}`}
        title={filePath ? `文件: ${filePath}` : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <TagIcon className="h-3 w-3 flex-shrink-0 text-text-secondary" />
        {tags.length === 0 ? (
          <span className="truncate text-text-secondary">添加标签</span>
        ) : (
          <>
            {visibleChips.map((tag) => (
              <span
                key={tag}
                className="max-w-[72px] truncate rounded bg-accent/10 px-1.5 py-0.5 text-accent"
              >
                {tag}
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className="flex-shrink-0 text-text-secondary">+{hiddenCount}</span>
            )}
          </>
        )}
        <Plus className="h-3 w-3 flex-shrink-0 text-text-secondary" />
      </button>

      {open &&
        panelPos &&
        createPortal(
          <>
            {/* 点击遮罩关闭（不拦截面板内点击），层级只比面板低一级 */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: PANEL_Z - 1 }}
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-label="标签"
              style={{
                position: 'fixed',
                top: panelPos.top,
                right: panelPos.right,
                zIndex: PANEL_Z,
              }}
              className="w-56 rounded-md border border-border bg-bg-primary p-2 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center gap-1 rounded border border-border bg-bg-secondary px-2 py-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tags.length >= max ? `已达上限 ${max} 个` : '输入标签名后回车'}
                disabled={disabled || tags.length >= max}
                maxLength={32}
                className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-secondary/70 disabled:cursor-not-allowed"
              />
              {input.length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setInput('');
                    inputRef.current?.focus();
                  }}
                  className="flex-shrink-0 text-text-secondary hover:text-text-primary"
                  title="清空输入"
                  aria-label="清空输入"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* 未输入时：直接列出常用标签 */}
            {input.trim().length === 0 && suggestions.length > 0 && (
              <div className="mt-2">
                <div className="mb-1 text-[10px] text-text-secondary">常用标签</div>
                <div className="flex flex-wrap gap-1">
                  {suggestions.map((s) => (
                    <button
                      key={s.tag}
                      type="button"
                      disabled={disabled || tags.length >= max}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAdd(s.tag)}
                      className="inline-flex max-w-full items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[11px] text-text-secondary hover:border-primary/60 hover:text-text-primary transition-colors disabled:opacity-50"
                    >
                      <Plus className="h-2.5 w-2.5 flex-shrink-0" />
                      <span className="truncate">{s.tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 自动补全：有输入时才出现 */}
            {input.trim().length > 0 && (suggestions.length > 0 || canAdd) && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded border border-border">
                {suggestions.map((s) => (
                  <button
                    key={s.tag}
                    type="button"
                    // mousedown preventDefault：避免输入框先失焦
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleAdd(s.tag)}
                    className="flex w-full items-center justify-between px-2 py-1 text-left text-xs text-text-primary hover:bg-bg-secondary transition-colors"
                  >
                    <span className="truncate">{s.tag}</span>
                    <span className="ml-2 flex-shrink-0 text-[10px] text-text-secondary">
                      {s.count}
                    </span>
                  </button>
                ))}
                {canAdd && !suggestions.some((s) => s.tag === input.trim()) && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleAdd(input)}
                    className="flex w-full items-center gap-1 border-t border-border px-2 py-1 text-left text-xs text-primary hover:bg-bg-secondary transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    新建 &quot;{input.trim()}&quot;
                  </button>
                )}
              </div>
            )}

            {/* 已选标签：chip 上 ✕ 移除 */}
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 border-t border-border pt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex max-w-full items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent"
                  >
                    <span className="truncate">{tag}</span>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemove(tag)}
                        className="flex-shrink-0 rounded-full hover:bg-accent/30 transition-colors"
                        title={`移除标签 ${tag}`}
                        aria-label={`移除标签 ${tag}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
};

export default TagPicker;
