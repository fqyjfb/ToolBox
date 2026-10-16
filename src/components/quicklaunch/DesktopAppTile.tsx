import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Rocket } from 'lucide-react';
import { QuickLaunchItem, toAppKey } from '../../utils/quickLaunch';
import { AppTileSize, SORTABLE_DISABLED } from './types';

interface AppTileVisualProps {
  app: QuickLaunchItem;
  iconSize: AppTileSize;
  showText: boolean;
}

/** 纯展示层（不含 dnd 钩子），供桌面网格、文件夹弹层与拖拽预览共用 */
export const AppTileVisual: React.FC<AppTileVisualProps> = ({ app, iconSize, showText }) => (
  <>
    <div className="relative">
      {app.icon ? (
        <img
          loading="lazy"
          draggable={false}
          src={`data:image/png;base64,${app.icon}`}
          alt={app.name}
          className={`object-contain ${showText ? 'mb-1' : ''} ${
            iconSize === 'small' ? 'w-8 h-8' : 'w-12 h-12'
          }`}
        />
      ) : (
        <Rocket className={`text-content-secondary ${showText ? 'mb-1' : ''} ${
          iconSize === 'small' ? 'w-8 h-8' : 'w-12 h-12'
        }`} />
      )}
    </div>
    {showText && (
      <span className={`font-medium text-content-primary truncate w-full text-center ${
        iconSize === 'small' ? 'text-4xs' : 'text-2xs'
      }`}>
        {app.name}
      </span>
    )}
  </>
);

interface DesktopAppTileProps extends AppTileVisualProps {
  disabled?: boolean;
  singleClick?: boolean;
  /** 拖拽刚结束时浏览器仍会派发 click，用此守卫避免误启动 */
  didDragRef: React.MutableRefObject<boolean>;
  onLaunch: (path: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const DesktopAppTile: React.FC<DesktopAppTileProps> = ({
  app,
  iconSize,
  showText,
  disabled,
  singleClick,
  didDragRef,
  onLaunch,
  onContextMenu,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: toAppKey(app.id),
    disabled: disabled ? SORTABLE_DISABLED : false,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(disabled ? {} : listeners)}
      className={`flex flex-col items-center justify-center rounded-md transition-colors w-full ${
        disabled ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${iconSize === 'small' ? 'h-quick-launch-sm' : 'h-quick-launch-lg'} ${
        isDragging ? 'shadow-lg' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
      }`}
      onClick={() => {
        if (didDragRef.current || !singleClick) return;
        onLaunch(app.path);
      }}
      onDoubleClick={() => {
        if (didDragRef.current || singleClick) return;
        onLaunch(app.path);
      }}
      onContextMenu={onContextMenu}
    >
      <AppTileVisual app={app} iconSize={iconSize} showText={showText} />
    </div>
  );
};
