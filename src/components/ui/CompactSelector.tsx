import React, { useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useHoverMenu } from '../../hooks/useHoverMenu';

export interface CompactSelectorItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  active?: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

interface CompactSelectorProps {
  items: CompactSelectorItem[];
  /** 当前选中项的 key，用于高亮和显示 */
  selectedKey: string | null;
  /** 触发按钮的图标，默认 ChevronDown */
  triggerIcon?: React.ReactNode;
  /** 下拉菜单标题 */
  title?: string;
  /** 空状态文案 */
  emptyText?: string;
  /** 是否为子级选择器（视觉弱化，与主级区分） */
  isSubLevel?: boolean;
}

/** CompactSelector 只有一个菜单，用固定 key 占位 */
const MENU_KEY = 'menu';

/**
 * 小窗模式下分类/标签的选择器：显示当前选中项 + 图标按钮，点击弹出下拉菜单。
 * 替代原有 OverflowMenu 的「更多」收拢方式，交互更直观。
 */
const CompactSelector: React.FC<CompactSelectorProps> = ({
  items,
  selectedKey,
  triggerIcon,
  title,
  emptyText = '暂无选项',
  isSubLevel = false,
}) => {
  const { openKey, closeMenu, toggleMenu, getTriggerProps } = useHoverMenu();
  const containerRef = useRef<HTMLDivElement>(null);
  const isOpen = openKey === MENU_KEY;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeMenu]);

  const selectedItem = items.find(item => item.key === selectedKey);

  if (items.length === 0) {
    return (
      <div className="text-xs text-content-tertiary px-2 py-1">{emptyText}</div>
    );
  }

  // 子级选择器：视觉弱化，与主级区分
  const selectedButtonClass = isSubLevel
    ? 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 bg-surface-secondary text-content-primary border border-content-light'
    : 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 bg-primary text-button-text shadow-sm';

  const triggerButtonClass = isSubLevel
    ? 'p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-menu-hover rounded-full transition-colors'
    : 'p-1.5 text-content-secondary hover:text-content-primary hover:bg-menu-hover rounded-full transition-colors';

  return (
    <div
      ref={containerRef}
      className="relative flex-shrink-0 overflow-visible"
      {...getTriggerProps(MENU_KEY)}
    >
      <div className="flex items-center gap-1">
        {/* 当前选中项展示 */}
        {selectedItem && (
          <button
            onClick={() => selectedItem.onClick()}
            onContextMenu={selectedItem.onContextMenu}
            className={selectedButtonClass}
          >
            {selectedItem.color && (
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedItem.color }} />
            )}
            {selectedItem.icon}
            <span className="truncate max-w-[80px]">{selectedItem.label}</span>
          </button>
        )}
        {/* 下拉触发按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMenu(MENU_KEY);
          }}
          className={triggerButtonClass}
          title={title || '切换'}
        >
          {triggerIcon || <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
        </button>
      </div>

      {isOpen && (
        /* 外层 pt-1 负责与触发器的视觉间距，同时把间距纳入悬浮区域，避免鼠标跨越空隙时菜单关闭 */
        <div className="absolute left-0 top-full pt-1 z-50">
          <div className="min-w-[112px] max-w-[200px] max-h-60 overflow-y-auto scrollbar-hide bg-surface border border-content rounded-lg shadow-lg py-1">
            {items.map((item) => (
              <button
                key={item.key}
                onClick={(e) => {
                  e.stopPropagation();
                  closeMenu();
                  item.onClick();
                }}
                onContextMenu={(e) => {
                  closeMenu();
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
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompactSelector;
