import React from 'react';
import { Globe } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { openUrl } from '../../services/browserService';

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

  const proxyImageUrl = (url: string): string => {
    const raw = (url || '').trim();
    if (!raw) return './网址.png';
    if (/^(data|blob):/i.test(raw)) return raw;
    try {
      return `https://images.weserv.nl/?url=${encodeURIComponent(raw)}`;
    } catch {
      return './网址.png';
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, originalUrl: string) => {
    const target = e.target as HTMLImageElement;
    if (target.src === originalUrl) {
      try {
        target.src = `https://images.weserv.nl/?url=${encodeURIComponent(originalUrl)}`;
      } catch {
        target.src = './网址.png';
      }
    } else {
      target.src = './网址.png';
    }
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
        <img
          src={proxyImageUrl(bookmark.ico_url)}
          alt={bookmark.title}
          className="w-8 h-8 object-contain"
          onError={(e) => handleImageError(e, bookmark.ico_url || '')}
        />
      ) : (
        <Globe className="w-8 h-8 text-gray-500 dark:text-gray-400" />
      )}
    </div>
  );
};

const FavoritesBar: React.FC<FavoritesBarProps> = ({ favorites, onReorder }) => {
  if (favorites.length === 0) return null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
            {favorites.slice(0, 12).map((bookmark) => (
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