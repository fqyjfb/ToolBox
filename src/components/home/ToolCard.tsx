import React from 'react';
import { Plus } from 'lucide-react';
import type { HomeToolItem } from '../../utils/homeTools';
import { iconMap } from '../../utils/iconMap';

interface ToolCardProps {
  tool: HomeToolItem;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** 提供后右上角显示新增按钮（扩展工具无数据时仍可新增） */
  onAdd?: () => void;
}

/** 首页单个工具的独立 2×2 卡片（原 3×3 工具网格已拆散为独立卡片） */
const ToolCard: React.FC<ToolCardProps> = ({ tool, onClick, onContextMenu, onAdd }) => {
  const IconComponent = iconMap[tool.iconName] || iconMap.Clipboard;

  return (
    <div
      className="home-card home-card--panel home-tool-card"
      style={{ backgroundColor: tool.color }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <IconComponent className="home-tool-card__icon" />
      <span className="home-tool-card__name">{tool.name}</span>
      {onAdd && (
        <button
          type="button"
          className="home-card__add-btn home-tool-card__add"
          title={`新增${tool.name}`}
          aria-label={`新增${tool.name}`}
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
        >
          <Plus size={16} />
        </button>
      )}
    </div>
  );
};

export default React.memo(ToolCard);
