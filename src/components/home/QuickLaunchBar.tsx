import React from 'react';
import { X } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { QuickLaunchItem } from '../../utils/quickLaunch';

interface QuickLaunchBarProps {
  apps: QuickLaunchItem[];
  onLaunch: (path: string) => void;
  onRemove: (appId: string) => void;
  onReorder?: (apps: QuickLaunchItem[]) => void;
}

const SortableQuickLaunchItem: React.FC<{ app: QuickLaunchItem; onLaunch: (path: string) => void; onRemove: (appId: string) => void; }> = ({ app, onLaunch, onRemove }) => {
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
    >
      {app.icon ? (
        <img
          src={`data:image/png;base64,${app.icon}`}
          alt={app.name}
          className="w-10 h-10 object-contain"
        />
      ) : null}
      <span className="quicklaunch-title">{app.name}</span>
      <button
        className="quicklaunch-remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(app.id);
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
};

const QuickLaunchBar: React.FC<QuickLaunchBarProps> = ({ apps, onLaunch, onRemove, onReorder }) => {
  if (apps.length === 0) return null;

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
      const activeIndex = apps.findIndex(app => app.id === active.id);
      const overIndex = apps.findIndex(app => app.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        const reordered = arrayMove(apps, activeIndex, overIndex);
        onReorder(reordered);
      }
    }
  };

  return (
    <div className="w-full relative z-[60]">
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
                onRemove={onRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default QuickLaunchBar;