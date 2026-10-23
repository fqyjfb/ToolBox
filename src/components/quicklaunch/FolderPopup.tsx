import React, { useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { Plus, X } from 'lucide-react';
import { QuickLaunchItem, toAppKey } from '../../utils/quickLaunch';
import { DesktopAppTile } from './DesktopAppTile';
import { AppTileSize } from './types';

/** 弹层面板投放区前缀（拖到面板空白处 = 归入该文件夹） */
export const FOLDER_POPUP_PREFIX = 'folder-popup:';

interface FolderPopupProps {
  /** 文件夹标识（categoryId），用于弹层投放区 id */
  folderKey: string;
  /** 文件夹名称 */
  title: string;
  apps: QuickLaunchItem[];
  iconSize: AppTileSize;
  showText: boolean;
  singleClick: boolean;
  didDragRef: React.MutableRefObject<boolean>;
  onLaunch: (path: string) => void;
  onAppContextMenu: (e: React.MouseEvent, appId: string) => void;
  /** 弹层内右键（文件夹专属菜单，需阻止冒泡到根容器） */
  onFolderContextMenu: (e: React.MouseEvent) => void;
  onAddApp: () => void;
  onClose: () => void;
  /** 原生文件拖入（Electron）：必须 preventDefault，否则会触发浏览器默认跳转 */
  onFileDragOver: (e: React.DragEvent) => void;
  onFileDrop: (e: React.DragEvent) => void;
}

const FolderPopup: React.FC<FolderPopupProps> = ({
  folderKey,
  title,
  apps,
  iconSize,
  showText,
  singleClick,
  didDragRef,
  onLaunch,
  onAppContextMenu,
  onFolderContextMenu,
  onAddApp,
  onClose,
  onFileDragOver,
  onFileDrop,
}) => {
  // 弹层整体作为投放区：指针落在面板空白处时命中面板，落在面板外（遮罩）时无命中 → 移出文件夹
  const { setNodeRef } = useDroppable({ id: `${FOLDER_POPUP_PREFIX}${folderKey}` });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const gridClass = iconSize === 'small'
    ? 'grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 auto-rows-quick-launch-sm'
    : 'grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-3 auto-rows-quick-launch-lg';

  return (
    <div
      className="ql-folder-backdrop"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onFolderContextMenu(e);
      }}
      onDragOver={onFileDragOver}
      onDrop={onFileDrop}
    >
      <div
        ref={setNodeRef}
        className="ql-folder-panel p-4 scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFolderContextMenu(e);
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-sm font-semibold text-content-primary truncate">
            {title}
            <span className="ml-1 text-xs font-normal text-content-tertiary">({apps.length})</span>
          </span>
          <button
            className="p-1 text-content-tertiary hover:text-content-secondary transition-colors flex-shrink-0"
            onClick={onClose}
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {apps.length > 0 ? (
          <SortableContext items={apps.map((app) => toAppKey(app.id))} strategy={rectSortingStrategy}>
            <div className={`grid ${gridClass}`}>
              {apps.map((app) => (
                <DesktopAppTile
                  key={app.id}
                  app={app}
                  iconSize={iconSize}
                  showText={showText}
                  singleClick={singleClick}
                  didDragRef={didDragRef}
                  onLaunch={onLaunch}
                  onContextMenu={(e) => onAppContextMenu(e, app.id)}
                />
              ))}
              <button
                className={`flex flex-col items-center justify-center rounded-md border border-dashed border-content text-content-tertiary hover:text-content-secondary hover:bg-menu-hover transition-colors w-full ${
                  iconSize === 'small' ? 'h-quick-launch-sm' : 'h-quick-launch-lg'
                }`}
                onClick={onAddApp}
                title="添加应用到该文件夹"
              >
                <Plus size={iconSize === 'small' ? 16 : 20} />
              </button>
            </div>
          </SortableContext>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-content-tertiary">
            <p className="text-sm mb-2">文件夹为空</p>
            <button
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-menu-hover text-content-primary hover:opacity-80 transition-opacity"
              onClick={onAddApp}
            >
              <Plus size={14} />
              添加应用
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FolderPopup;
