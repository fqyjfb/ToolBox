import React from 'react';
import { Globe } from 'lucide-react';
import IconCard from './IconCard';
import CachedIcon from '../ui/CachedIcon';
import type { Bookmark } from '../../types/website';

interface FavoriteCardProps {
  bookmark: Bookmark;
  onOpen: () => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

/** 首页网页收藏的独立 1×1 卡片 */
const FavoriteCard: React.FC<FavoriteCardProps> = ({ bookmark, onOpen, onMouseEnter, onMouseLeave }) => (
  <IconCard
    icon={
      bookmark.ico_url ? (
        <CachedIcon
          src={bookmark.ico_url}
          alt={bookmark.title}
          className="home-icon-card__icon"
          defaultIcon={<Globe className="home-icon-card__icon text-content-secondary" />}
          type="general"
          iconOnly
        />
      ) : (
        <Globe className="home-icon-card__icon text-content-secondary" />
      )
    }
    onClick={onOpen}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  />
);

export default React.memo(FavoriteCard);
