import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { iconMap } from '../../utils/iconMap';
import type { HomeToolItem } from '../../utils/homeTools';

export type PreviewItemType = 'todo' | 'memo' | 'reminder' | 'quick-reply' | 'clipboard';

export interface PreviewItem {
  id: string;
  title: string;
  subtitle?: string;
  detail?: string;
  type?: PreviewItemType;
  /**
   * 原始实体（Todo / Memo / Reminder / QuickReply / ClipboardItem）。
   * 卡片数据行的「编辑」要回填完整字段（优先级、分类、提醒时间等），
   * 仅靠预览用的 title / subtitle 无法还原，故一并携带。
   */
  raw?: unknown;
}

interface ExpandedToolCardProps {
  tool: HomeToolItem;
  items: PreviewItem[];
  totalCount: number;
  onClick: () => void;
  onAdd: () => void;
  onItemTap?: (item: PreviewItem) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** 数据行右键：提供「新增 / 编辑 / 删除」菜单 */
  onItemContextMenu?: (e: React.MouseEvent, item: PreviewItem) => void;
}

/**
 * 首页扩展工具卡：宽度 ×2（colSpan 4 × rowSpan 3），展示最多 6 条随机预览数据。
 * 标题行右侧为新增按钮，内容列表支持滚动（隐藏滚动条），点击行弹出详情预览。
 */
const ExpandedToolCard: React.FC<ExpandedToolCardProps> = ({
  tool, items, totalCount, onClick, onAdd, onItemTap, onContextMenu, onItemContextMenu,
}) => {
  const IconComponent = iconMap[tool.iconName] || iconMap.Clipboard;

  // 固定随机预览（useMemo 防止鼠标交互时重排导致跳动）
  const previewItems = useMemo(() => {
    if (items.length === 0) return [];
    return [...items].sort(() => Math.random() - 0.5).slice(0, 6);
  }, [items]);

  return (
    <div
      className="home-card home-card--panel home-tool-card expanded-tool-card"
      style={{ backgroundColor: tool.color }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className="expanded-tool-card__header">
        <IconComponent className="expanded-tool-card__icon" />
        <span className="expanded-tool-card__name">{tool.name}</span>
        {totalCount > 0 && <span className="expanded-tool-card__count">{totalCount}</span>}
        <button
          type="button"
          className="home-card__add-btn expanded-tool-card__add"
          title={`新增${tool.name}`}
          aria-label={`新增${tool.name}`}
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
        >
          <Plus size={16} />
        </button>
      </div>
      {previewItems.length > 0 && (
        <div className="expanded-tool-card__body">
          {previewItems.map(item => (
            <div
              key={item.id}
              className="expanded-tool-card__row"
              onClick={(e) => { e.stopPropagation(); onItemTap?.(item); }}
              onContextMenu={onItemContextMenu ? (e) => onItemContextMenu(e, item) : undefined}
            >
              <span className="expanded-tool-card__title">{item.title}</span>
              {item.subtitle && (
                <span className="expanded-tool-card__subtitle">{item.subtitle}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default React.memo(ExpandedToolCard);
