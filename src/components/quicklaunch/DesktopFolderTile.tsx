import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Folder, Rocket } from 'lucide-react';
import { QuickLaunchCategory, QuickLaunchItem, toFolderKey } from '../../utils/quickLaunch';
import { AppTileSize, SORTABLE_DISABLED } from './types';

const MINI_ICON = { small: 'w-3.5 h-3.5', medium: 'w-5 h-5' } as const;
const MINI_GAP = { small: 'gap-0.5', medium: 'gap-[3px]' } as const;
const EMPTY_ICON = { small: 'w-5 h-5', medium: 'w-7 h-7' } as const;

/** 2×2 迷你图标预览：只取前 4 个，与手机桌面文件夹一致 */
interface FolderTileVisualProps {
  category: QuickLaunchCategory;
  apps: QuickLaunchItem[];
  iconSize: AppTileSize;
  showText: boolean;
}

export const FolderTileVisual: React.FC<FolderTileVisualProps> = ({
  category,
  apps,
  iconSize,
  showText,
}) => {
  const preview = apps.slice(0, 4);

  return (
    <>
      {preview.length > 0 ? (
        <div className={`ql-folder-mini-grid ${MINI_GAP[iconSize]} ${showText ? 'mb-1' : ''}`}>
          {preview.map((app) =>
            app.icon ? (
              <img
                key={app.id}
                loading="lazy"
                draggable={false}
                src={`data:image/png;base64,${app.icon}`}
                alt={app.name}
                className={`object-contain ${MINI_ICON[iconSize]}`}
              />
            ) : (
              <Rocket key={app.id} className={`text-content-secondary ${MINI_ICON[iconSize]}`} />
            )
          )}
        </div>
      ) : (
        <Folder
          className={`${EMPTY_ICON[iconSize]} ${showText ? 'mb-1' : ''}`}
          style={{ color: category.color }}
        />
      )}
      {showText && (
        <span className={`font-medium text-content-primary truncate w-full text-center ${
          iconSize === 'small' ? 'text-4xs' : 'text-2xs'
        }`}>
          {category.name}
        </span>
      )}
    </>
  );
};

interface DesktopFolderTileProps extends FolderTileVisualProps {
  disabled?: boolean;
  /** 拖拽应用停在磁贴中心区域（松手将归入该文件夹）时为 true，用于高亮提示 */
  groupArmed?: boolean;
  didDragRef: React.MutableRefObject<boolean>;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

/** 分类文件夹磁贴：可拖拽排序，同时作为「拖入归类」的投放目标 */
export const DesktopFolderTile: React.FC<DesktopFolderTileProps> = ({
  category,
  apps,
  iconSize,
  showText,
  disabled,
  groupArmed,
  didDragRef,
  onOpen,
  onContextMenu,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: toFolderKey(category.id), disabled: disabled ? SORTABLE_DISABLED : false });

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
      className={`ql-folder-tile flex flex-col items-center justify-center rounded-md transition-colors w-full cursor-pointer active:cursor-grabbing ${
        iconSize === 'small' ? 'h-quick-launch-sm' : 'h-quick-launch-lg'} ${
        groupArmed ? 'is-drop-target' : ''
      }`}
      onClick={() => {
        if (didDragRef.current) return;
        onOpen();
      }}
      onContextMenu={onContextMenu}
      title={`${category.name}（${apps.length}）`}
    >
      <FolderTileVisual
        category={category}
        apps={apps}
        iconSize={iconSize}
        showText={showText}
      />
    </div>
  );
};


