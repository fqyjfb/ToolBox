import React, { useState, useCallback } from 'react';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndSensors } from '../../hooks/useDndSensors';
import ContextMenu, { ContextMenuItem } from '../ui/ContextMenu';
import type { QuickLaunchItem } from '../../utils/quickLaunch';

interface QuickLaunchBarProps {
  apps: QuickLaunchItem[];
  onLaunch: (path: string) => void;
  onRemove: (appId: string) => void;
  onReorder?: (apps: QuickLaunchItem[]) => void;
}

const SortableQuickLaunchItem: React.FC<{
  app: QuickLaunchItem;
  onLaunch: (path: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = ({ app, onLaunch, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app.id });

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
      className={`quicklaunch-item cursor-grab active:cursor-grabbing ${isDragging ? 'shadow-lg' : ''}`}
      onClick={() => onLaunch(app.path)}
      onContextMenu={onContextMenu}
    >
      {app.icon ? (
        <img
          src={`data:image/png;base64,${app.icon}`}
          alt={app.name}
          className="w-8 h-8 object-contain"
        />
      ) : null}
      <span className="quicklaunch-title">{app.name}</span>
    </div>
  );
};

const QuickLaunchBar: React.FC<QuickLaunchBarProps> = ({ apps, onLaunch, onRemove, onReorder }) => {
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    targetAppId?: string;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  const sensors = useDndSensors();

  const handleContextMenu = useCallback((e: React.MouseEvent, appId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, targetAppId: appId });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleMoveForward = useCallback(() => {
    if (!contextMenu.targetAppId || !onReorder) return;
    const index = apps.findIndex(app => app.id === contextMenu.targetAppId);
    if (index > 0) {
      const newApps = arrayMove(apps, index, index - 1);
      onReorder(newApps);
    }
    handleCloseContextMenu();
  }, [contextMenu.targetAppId, apps, onReorder, handleCloseContextMenu]);

  const handleMoveBackward = useCallback(() => {
    if (!contextMenu.targetAppId || !onReorder) return;
    const index = apps.findIndex(app => app.id === contextMenu.targetAppId);
    if (index < apps.length - 1) {
      const newApps = arrayMove(apps, index, index + 1);
      onReorder(newApps);
    }
    handleCloseContextMenu();
  }, [contextMenu.targetAppId, apps, onReorder, handleCloseContextMenu]);

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (!contextMenu.targetAppId) return [];

    return [
      {
        id: 'move-forward',
        label: '前移',
        icon: <ChevronUp className="w-4 h-4" />,
        onClick: handleMoveForward,
      },
      {
        id: 'move-backward',
        label: '后移',
        icon: <ChevronDown className="w-4 h-4" />,
        onClick: handleMoveBackward,
      },
      { id: 'divider1', divider: true },
      {
        id: 'delete',
        label: '删除',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => {
          if (contextMenu.targetAppId) {
            onRemove(contextMenu.targetAppId);
          }
          handleCloseContextMenu();
        }
      }
    ];
  }, [contextMenu.targetAppId, handleMoveForward, handleMoveBackward, onRemove, handleCloseContextMenu]);

  if (apps.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onReorder) {
      const activeIndex = apps.findIndex(app => app.id === active.id);
      const overIndex = apps.findIndex(app => app.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        const reordered = arrayMove(apps, activeIndex, overIndex);
        onReorder(reordered);
      }
    }
  };

  return (
    <div className="w-full relative z-10">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={apps.map(app => app.id)} strategy={verticalListSortingStrategy}>
          <div className="quicklaunch-bar">
            {apps.map((app) => (
              <SortableQuickLaunchItem
                key={app.id}
                app={app}
                onLaunch={onLaunch}
                onContextMenu={(e) => handleContextMenu(e, app.id)}
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
    </div>
  );
};

export default QuickLaunchBar;