import React from 'react';
import { Globe } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndSensors } from '../../hooks/useDndSensors';
import { openUrl } from '../../services/browserService';
import { DISPLAY_LIMITS } from '../../constants/timers';
import CachedIcon from '../ui/CachedIcon';
import './FavoritesBar.css';

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  ico_url?: string;
}

interface FavoritesBarProps {
  favorites: Bookmark[];
  onReorder?: (favorites: Bookmark[]) => void;
}

const SortableFavoriteItem: React.FC<{ bookmark: Bookmark; onClick: () => void; }> = ({ bookmark, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bookmark.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
    scale: isDragging ? 1.1 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`favorite-item cursor-grab active:cursor-grabbing ${isDragging ? 'shadow-lg' : ''}`}
      onClick={onClick}
    >
      <span className="favorite-title">{bookmark.title}</span>
      {bookmark.ico_url ? (
        <CachedIcon
          src={bookmark.ico_url}
          alt={bookmark.title}
          className="w-8 h-8 object-contain"
          defaultIcon={<Globe className="w-8 h-8 text-gray-500 dark:text-gray-400" />}
          type="general"
        />
      ) : (
        <Globe className="w-8 h-8 text-gray-500 dark:text-gray-400" />
      )}
    </div>
  );
};

const FavoritesBar: React.FC<FavoritesBarProps> = ({ favorites, onReorder }) => {
  const sensors = useDndSensors();

  if (favorites.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onReorder) {
      const activeIndex = favorites.findIndex(fav => fav.id === active.id);
      const overIndex = favorites.findIndex(fav => fav.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        const reordered = arrayMove(favorites, activeIndex, overIndex);
        onReorder(reordered);
      }
    }
  };

  return (
    <div className="max-w-2xl w-full mx-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={favorites.map(fav => fav.id)} strategy={verticalListSortingStrategy}>
          <div className="favorites-bar">
            {favorites.slice(0, DISPLAY_LIMITS.FAVORITES).map((bookmark) => (
              <SortableFavoriteItem
                key={bookmark.id}
                bookmark={bookmark}
                onClick={() => openUrl(bookmark.url)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default FavoritesBar;