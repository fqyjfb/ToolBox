import React, { useState, useCallback } from 'react';
import { ExternalLink, Copy, ChevronUp, ChevronDown, Globe, X } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndSensors } from '../../hooks/useDndSensors';
import { useHoverTooltip } from '../../hooks/useHoverTooltip';
import ContextMenu, { ContextMenuItem } from '../ui/ContextMenu';
import CachedIcon from '../ui/CachedIcon';
import { openUrl } from '../../services/browserService';
import { useToastStore } from '../../store/toastStore';
import { getHomeBookmarkIcon, type HomeBookmark } from '../../utils/homeBookmarks';

interface HomeBookmarkBarProps {
  bookmarks: HomeBookmark[];
  onRemove: (id: string) => void;
  onReorder?: (orderedIds: string[]) => void;
}

const SortableBookmarkItem: React.FC<{
  bookmark: HomeBookmark;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}> = ({ bookmark, onOpen, onContextMenu, onMouseEnter, onMouseLeave }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bookmark.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
    scale: isDragging ? 1.1 : 1,
  };

  const icon = getHomeBookmarkIcon(bookmark);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`quicklaunch-item cursor-grab active:cursor-grabbing ${isDragging ? 'shadow-lg' : ''}`}
      onClick={onOpen}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {icon ? (
        <CachedIcon
          src={icon}
          alt={bookmark.title}
          className="w-8 h-8 object-contain"
          type="general"
          defaultIcon={<Globe className="w-8 h-8 text-content-secondary" />}
        />
      ) : (
        <Globe className="w-8 h-8 text-content-secondary" />
      )}
    </div>
  );
};

const HomeBookmarkBar: React.FC<HomeBookmarkBarProps> = ({ bookmarks, onRemove, onReorder }) => {
  const addToast = useToastStore(state => state.addToast);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    targetId?: string;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  const sensors = useDndSensors();
  const { tooltipNode, showTooltip, hideTooltip } = useHoverTooltip();

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, targetId: id });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const reorderByOffset = useCallback((offset: number) => {
    if (!contextMenu.targetId || !onReorder) return;
    const index = bookmarks.findIndex(bookmark => bookmark.id === contextMenu.targetId);
    const targetIndex = index + offset;
    if (index === -1 || targetIndex < 0 || targetIndex >= bookmarks.length) return;
    onReorder(arrayMove(bookmarks, index, targetIndex).map(bookmark => bookmark.id));
    handleCloseContextMenu();
  }, [contextMenu.targetId, bookmarks, onReorder, handleCloseContextMenu]);

  const handleCopyUrl = useCallback(async () => {
    const target = bookmarks.find(bookmark => bookmark.id === contextMenu.targetId);
    if (target) {
      try {
        await navigator.clipboard.writeText(target.url);
        addToast({ type: 'success', message: '网址已复制到剪贴板' });
      } catch {
        addToast({ type: 'error', message: '复制失败' });
      }
    }
    handleCloseContextMenu();
  }, [contextMenu.targetId, bookmarks, addToast, handleCloseContextMenu]);

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (!contextMenu.targetId) return [];

    return [
      {
        id: 'open',
        label: '打开',
        icon: <ExternalLink className="w-4 h-4" />,
        onClick: () => {
          const target = bookmarks.find(bookmark => bookmark.id === contextMenu.targetId);
          if (target) openUrl(target.url);
        },
      },
      {
        id: 'copy-url',
        label: '复制网址',
        icon: <Copy className="w-4 h-4" />,
        onClick: handleCopyUrl,
      },
      { id: 'divider1', divider: true },
      {
        id: 'move-forward',
        label: '前移',
        icon: <ChevronUp className="w-4 h-4" />,
        onClick: () => reorderByOffset(-1),
      },
      {
        id: 'move-backward',
        label: '后移',
        icon: <ChevronDown className="w-4 h-4" />,
        onClick: () => reorderByOffset(1),
      },
      { id: 'divider2', divider: true },
      {
        id: 'remove',
        label: '从首页移除',
        icon: <X className="w-4 h-4" />,
        onClick: () => {
          if (contextMenu.targetId) {
            onRemove(contextMenu.targetId);
          }
        },
      },
    ];
  }, [contextMenu.targetId, bookmarks, handleCopyUrl, reorderByOffset, onRemove]);

  if (bookmarks.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onReorder) {
      const activeIndex = bookmarks.findIndex(bookmark => bookmark.id === active.id);
      const overIndex = bookmarks.findIndex(bookmark => bookmark.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        const reordered = arrayMove(bookmarks, activeIndex, overIndex);
        onReorder(reordered.map(bookmark => bookmark.id));
      }
    }
  };

  return (
    <div className="w-full relative z-10 quicklaunch-scroll" onWheel={hideTooltip}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={hideTooltip}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={bookmarks.map(bookmark => bookmark.id)} strategy={rectSortingStrategy}>
          <div className="quicklaunch-bar">
            {bookmarks.map((bookmark) => (
              <SortableBookmarkItem
                key={bookmark.id}
                bookmark={bookmark}
                onOpen={() => openUrl(bookmark.url)}
                onContextMenu={(e) => handleContextMenu(e, bookmark.id)}
                onMouseEnter={(e) => showTooltip(e, bookmark.title)}
                onMouseLeave={hideTooltip}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        items={getContextMenuItems()}
        onClose={handleCloseContextMenu}
      />

      {tooltipNode}
    </div>
  );
};

export default HomeBookmarkBar;
