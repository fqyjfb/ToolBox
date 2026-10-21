import React, { useState, useCallback } from 'react';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndSensors } from '../../hooks/useDndSensors';
import { useHoverTooltip } from '../../hooks/useHoverTooltip';
import ContextMenu, { ContextMenuItem } from '../ui/ContextMenu';
import type { QuickLaunchItem } from '../../utils/quickLaunch';
import './QuickLaunchBar.css';

interface QuickLaunchBarProps {
  apps: QuickLaunchItem[];
  onLaunch: (path: string) => void;
  onRemove: (appId: string) => void;
  onReorder?: (apps: QuickLaunchItem[]) => void;
}

export interface QuickLaunchIconProps {
  app: QuickLaunchItem;
  className?: string;
}

/** 快启动图标（小窗横向条与首页网格卡片共用同一份渲染） */
export const QuickLaunchIcon: React.FC<QuickLaunchIconProps> = ({ app, className }) => {
  if (!app.icon) return null;
  return <img src={`data:image/png;base64,${app.icon}`} alt={app.name} className={className} />;
};

interface SortableQuickLaunchItemProps {
  app: QuickLaunchItem;
  onLaunch: (path: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

const SortableQuickLaunchItem: React.FC<SortableQuickLaunchItemProps> = ({
  app,
  onLaunch,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
}) => {
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
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <QuickLaunchIcon app={app} className="quicklaunch-icon-x" />
    </div>
  );
};

/** 小窗个人信息区下方的横向快启动条（单行不换行、横向滚动、无滚动条） */
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
  const { tooltipNode, showTooltip, hideTooltip } = useHoverTooltip();

  const handleContextMenu = useCallback((e: React.MouseEvent, appId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, targetAppId: appId });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const moveByOffset = useCallback((offset: number) => {
    if (!contextMenu.targetAppId || !onReorder) return;
    const index = apps.findIndex(app => app.id === contextMenu.targetAppId);
    const targetIndex = index + offset;
    if (index === -1 || targetIndex < 0 || targetIndex >= apps.length) return;
    onReorder(arrayMove(apps, index, targetIndex));
    handleCloseContextMenu();
  }, [contextMenu.targetAppId, apps, onReorder, handleCloseContextMenu]);

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (!contextMenu.targetAppId) return [];

    return [
      {
        id: 'move-forward',
        label: '前移',
        icon: <ChevronUp className="w-4 h-4" />,
        onClick: () => moveByOffset(-1),
      },
      {
        id: 'move-backward',
        label: '后移',
        icon: <ChevronDown className="w-4 h-4" />,
        onClick: () => moveByOffset(1),
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
        },
      }
    ];
  }, [contextMenu.targetAppId, moveByOffset, onRemove]);

  if (apps.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onReorder) {
      const activeIndex = apps.findIndex(app => app.id === active.id);
      const overIndex = apps.findIndex(app => app.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        onReorder(arrayMove(apps, activeIndex, overIndex));
      }
    }
  };

  // 横向模式：鼠标滚轮映射为横向滚动
  const handleWheel = (e: React.WheelEvent) => {
    e.currentTarget.scrollLeft += e.deltaY;
  };

  return (
    <div className="w-full relative z-10 quicklaunch-scroll-x" onWheel={(e) => { hideTooltip(); handleWheel(e); }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={hideTooltip}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={apps.map(app => app.id)}>
          <div className="quicklaunch-bar-x">
            {apps.map((app) => (
              <SortableQuickLaunchItem
                key={app.id}
                app={app}
                onLaunch={onLaunch}
                onContextMenu={(e) => handleContextMenu(e, app.id)}
                onMouseEnter={(e) => showTooltip(e, app.name)}
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

export default QuickLaunchBar;
