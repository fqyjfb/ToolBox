import React from 'react';
import { Globe } from 'lucide-react';
import IconCard from './IconCard';
import CachedIcon from '../ui/CachedIcon';
import { getHomeBookmarkIcon, type HomeBookmark } from '../../utils/homeBookmarks';

interface HomeBookmarkCardProps {
  bookmark: HomeBookmark;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

/** 首页网址收藏的独立 1×1 卡片（右键菜单由首页统一提供） */
const HomeBookmarkCard: React.FC<HomeBookmarkCardProps> = ({
  bookmark,
  onOpen,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
}) => {
  const icon = getHomeBookmarkIcon(bookmark);

  return (
    <IconCard
      icon={
        icon ? (
          <CachedIcon
            src={icon}
            alt={bookmark.title}
            className="home-icon-card__icon"
            type="general"
            defaultIcon={<Globe className="home-icon-card__icon text-content-secondary" />}
            // 卡片常驻可见，直接加载，避免 IntersectionObserver 漏加载导致空白
            iconOnly
          />
        ) : (
          <Globe className="home-icon-card__icon text-content-secondary" />
        )
      }
      onClick={onOpen}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
};

export default React.memo(HomeBookmarkCard);
