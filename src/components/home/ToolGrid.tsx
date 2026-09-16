import React from 'react';
import type { HomeToolItem } from '../../utils/homeTools';
import { iconMap } from '../../utils/iconMap';
import WeatherCard from './WeatherCard';

interface ToolGridProps {
  tools: HomeToolItem[];
  onToolClick: (path: string) => void;
}

const ToolGrid: React.FC<ToolGridProps> = ({ tools, onToolClick }) => {
  const renderToolItem = (tool: HomeToolItem) => {
    const IconComponent = iconMap[tool.iconName] || iconMap.Clipboard;
    return (
      <div
        key={tool.id}
        className="tools-item"
        style={{ backgroundColor: tool.color }}
        onClick={() => onToolClick(tool.path)}
      >
        <IconComponent className="w-10 h-10" />
        <span className="tools-name" style={{ color: tool.textColor }}>{tool.name}</span>
      </div>
    );
  };

  return (
    <div className="flex-shrink-0 h-[var(--card-height)] overflow-visible relative z-0">
      <div className="tools-grid">
        {/* 第一行第一列 - 天气卡片（占2行） */}
        <div 
          className="tools-item tools-item--weather cursor-pointer"
          onClick={() => onToolClick('/tools/weather')}
        >
          <WeatherCard />
        </div>
        
        {/* 第一行第二列 - 工具1 */}
        {tools[0] && renderToolItem(tools[0])}
        
        {/* 第一行第三列 - 工具2 */}
        {tools[1] && renderToolItem(tools[1])}
        
        {/* 第二行第二列 - 工具3 */}
        {tools[2] && renderToolItem(tools[2])}
        
        {/* 第二行第三列 - 工具4 */}
        {tools[3] && renderToolItem(tools[3])}
        
        {/* 第三行第一列 - 新闻（宽卡片，占2列） */}
        {tools[4] && (
          <div
            key={tools[4].id}
            className="tools-item tools-item--news"
            style={{ backgroundColor: tools[4].color }}
            onClick={() => onToolClick(tools[4].path)}
          >
            {React.createElement(iconMap[tools[4].iconName] || iconMap.Clipboard, { className: 'w-10 h-10' })}
            <span className="tools-name" style={{ color: tools[4].textColor }}>{tools[4].name}</span>
          </div>
        )}
        
        {/* 第三行第三列 - 工具6 */}
        {tools[5] && renderToolItem(tools[5])}
      </div>
    </div>
  );
};

export default React.memo(ToolGrid);
