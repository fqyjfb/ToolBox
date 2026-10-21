import React from 'react';

interface IconCardProps {
  icon: React.ReactNode;
  onClick: () => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/** 1×1 图标卡片外壳：快启动 / 网址收藏 / 网页收藏共用 */
const IconCard: React.FC<IconCardProps> = ({ icon, onClick, onMouseEnter, onMouseLeave, onContextMenu }) => (
  <div
    className="home-icon-card"
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    onContextMenu={onContextMenu}
  >
    {icon}
  </div>
);

export default React.memo(IconCard);
