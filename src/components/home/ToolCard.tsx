import React from 'react';
import type { HomeToolItem } from '../../utils/homeTools';
import { iconMap } from '../../utils/iconMap';

interface ToolCardProps {
  tool: HomeToolItem;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/** 首页单个工具的独立 2×2 卡片（原 3×3 工具网格已拆散为独立卡片） */
const ToolCard: React.FC<ToolCardProps> = ({ tool, onClick, onContextMenu }) => {
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
    </div>
  );
};

export default React.memo(ToolCard);
