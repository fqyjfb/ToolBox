import React from 'react';
import type { HomeToolItem } from '../../utils/homeTools';
import { iconMap } from '../../utils/iconMap';

interface ToolGridProps {
  tools: HomeToolItem[];
  onToolClick: (path: string) => void;
}

const ToolGrid: React.FC<ToolGridProps> = ({ tools, onToolClick }) => {
  const renderToolItem = (tool: HomeToolItem, extraClass?: string) => {
    const IconComponent = iconMap[tool.iconName] || iconMap.Clipboard;
    return (
      <div
        key={tool.id}
        className={`tools-item ${extraClass || ''}`}
        style={{ backgroundColor: tool.color }}
        onClick={() => onToolClick(tool.path)}
      >
        <IconComponent className="w-10 h-10" />
        <span className="tools-name" style={{ color: '#FFFFFF' }}>{tool.name}</span>
      </div>
    );
  };

  return (
    <div className="tools-card flex-shrink-0 h-[var(--card-height)] overflow-visible relative z-0">
      <div className="tools-grid">
        {/* 第一列前两行 - 工具1（占2行） */}
        {tools[0] && renderToolItem(tools[0], 'tools-item--tall')}

        {/* 第一行第二、三列 */}
        {tools[1] && renderToolItem(tools[1])}
        {tools[2] && renderToolItem(tools[2])}

        {/* 第二行第二、三列 */}
        {tools[3] && renderToolItem(tools[3])}
        {tools[4] && renderToolItem(tools[4])}

        {/* 第三行第一、二列 - 宽卡片（占2列） */}
        {tools[5] && renderToolItem(tools[5], 'tools-item--wide')}

        {/* 第三行第三列 */}
        {tools[6] && renderToolItem(tools[6])}
      </div>
    </div>
  );
};

export default React.memo(ToolGrid);
