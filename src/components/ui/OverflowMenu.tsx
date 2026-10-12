import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface OverflowMenuItem {
  key: string;
  label: React.ReactNode;
  /** 当前选中项，下拉中高亮 */
  active?: boolean;
  /** 分类色点（备忘录等带颜色的分类） */
  color?: string;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
  /** 触发按钮文案，默认「更多」 */
  label?: string;
  /** 触发按钮样式：chip 为分类胶囊，plain 为文字按钮 */
  variant?: 'chip' | 'plain';
}

/** 分类 / 标签栏放不下时的「更多」下拉，交互与网址导航页的分类下拉一致 */
const OverflowMenu: React.FC<OverflowMenuProps> = ({ items, label = '更多', variant = 'chip' }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={
          variant === 'chip'
            ? 'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full text-content-secondary hover:bg-menu-hover dark:text-content-secondary dark:hover:bg-menu-hover transition-colors'
            : 'flex items-center gap-1 px-2 py-1 text-sm font-medium text-content-secondary hover:text-content-primary transition-colors'
        }
        title={label}
      >
        <span>{label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[112px] max-w-[200px] max-h-60 overflow-y-auto scrollbar-hide bg-surface border border-content rounded-lg shadow-lg py-1">
            {items.map((item) => (
              <button
                key={item.key}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  item.onClick();
                }}
                onContextMenu={(e) => {
                  setIsOpen(false);
                  item.onContextMenu?.(e);
                }}
                className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm transition-colors ${
                  item.active
                    ? 'bg-surface-secondary text-content-primary font-medium'
                    : 'text-content-secondary hover:bg-menu-hover dark:text-content-secondary dark:hover:bg-menu-hover'
                }`}
              >
                {item.color && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                )}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default OverflowMenu;
