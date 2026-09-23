// 固定目录列表

import React, { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Folder, Pin, Plus, Trash } from 'lucide-react';
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu';
import { useToastStore } from '@/store/toastStore';
import { useNotesSidebarSectionsStore } from '@/store/notesSidebarSectionsStore';
import type { PinnedFolder } from '../types';

export interface PinnedFoldersSectionProps {
  pinnedFolders: PinnedFolder[];
  currentViewPath: string | null;
  pinnedDragIndex: number | null;
  pinnedDragOverIndex: number | null;
  pinnedContextMenu: { x: number; y: number; index: number } | null;
  setPinnedDragIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setPinnedDragOverIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setPinnedContextMenu: React.Dispatch<
    React.SetStateAction<{ x: number; y: number; index: number } | null>
  >;
  onSwitchToFolder: (folderPath: string) => Promise<void>;
  onReorderPinnedFolder: (fromIndex: number, toIndex: number) => void;
  onAddPinnedFolder: () => Promise<boolean>;
  onRemovePinnedFolder: (folderPath: string) => void;
  onDropFiles: (e: React.DragEvent) => Promise<void>;
}

const isExternalFileDrag = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

export const PinnedFoldersSection: React.FC<PinnedFoldersSectionProps> = ({
  pinnedFolders,
  currentViewPath,
  pinnedDragIndex,
  pinnedDragOverIndex,
  pinnedContextMenu,
  setPinnedDragIndex,
  setPinnedDragOverIndex,
  setPinnedContextMenu,
  onSwitchToFolder,
  onReorderPinnedFolder,
  onAddPinnedFolder,
  onRemovePinnedFolder,
  onDropFiles,
}) => {
  const addToast = useToastStore((state) => state.addToast);
  const open = useNotesSidebarSectionsStore((state) => state.sections.pinned);
  const toggleSection = useNotesSidebarSectionsStore((state) => state.toggleSection);
  const [areaActive, setAreaActive] = useState(false);

  const closePinnedContextMenu = useCallback(
    () => setPinnedContextMenu(null),
    [setPinnedContextMenu]
  );

  const pinnedContextMenuItems = useMemo<ContextMenuItem[]>(() => {
    const pinned = pinnedContextMenu ? pinnedFolders[pinnedContextMenu.index] : null;
    if (!pinned) return [];

    return [
      {
        id: 'pinned-add',
        label: '添加固定目录',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => {
          void onAddPinnedFolder();
        },
      },
      { id: 'pinned-divider', divider: true },
      {
        id: 'pinned-open-in-folder',
        label: '打开位置',
        icon: <ExternalLink className="w-4 h-4" />,
        onClick: () => {
          void window.electron?.notes.openFileInFolder(pinned.path).then((result) => {
            if (result && !result.success) {
              addToast({ type: 'error', message: result.error || '打开位置失败' });
            }
          });
        },
      },
      {
        id: 'pinned-remove',
        label: '移除',
        icon: <Trash className="w-4 h-4" />,
        className: 'text-error hover:bg-error/10 dark:hover:bg-error/20',
        onClick: () => {
          onRemovePinnedFolder(pinned.path);
          addToast({ type: 'success', message: `已移除固定目录: ${pinned.name}` });
        },
      },
    ];
  }, [pinnedContextMenu, pinnedFolders, onAddPinnedFolder, onRemovePinnedFolder, addToast]);

  return (
    <div
      className={`flex-shrink-0 px-2 py-2 transition-colors dark:border-content ${
        areaActive ? 'bg-blue-50 ring-1 ring-blue-500/50 dark:bg-blue-500/10' : ''
      }`}
      onDragOver={(e) => {
        if (!isExternalFileDrag(e)) return; // 内部排序拖拽不在此处理
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setAreaActive(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setAreaActive(false);
      }}
      onDrop={(e) => {
        setAreaActive(false);
        if (!isExternalFileDrag(e)) return;
        void onDropFiles(e); // 内部已 preventDefault / stopPropagation
      }}
    >
      <button
        className="flex w-full items-center justify-between text-xs font-medium text-content-secondary px-1 py-1 hover:text-primary transition-colors"
        onClick={() => toggleSection('pinned')}
      >
        <span className="flex items-center gap-1">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Pin className="h-3 w-3" />
          固定目录 ({pinnedFolders.length})
        </span>
      </button>
      {open && pinnedFolders.length === 0 && (
        <div className="mt-1 rounded border border-dashed border-gray-300 px-2 py-2 text-[11px] text-content-tertiary dark:border-content">
          拖入文件夹可添加为固定目录
        </div>
      )}
      {open && pinnedFolders.length > 0 && (
        <div className="mt-1 max-h-48 overflow-y-auto scrollbar-hide space-y-0.5">
          {pinnedFolders.map((pinned, index) => (
            <div
              key={pinned.path}
              draggable
              className={`group flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                currentViewPath === pinned.path
                  ? 'bg-blue-100 text-blue-700 font-medium dark:bg-blue-500/25 dark:text-blue-200'
                  : 'text-content-primary hover:bg-surface-secondary dark:hover:bg-content-primary'
              } ${pinnedDragOverIndex === index && pinnedDragIndex !== index ? 'ring-2 ring-accent' : ''} ${pinnedDragIndex === index ? 'opacity-50' : ''}`}
              onClick={() => onSwitchToFolder(pinned.path)}
              onDragStart={(e) => {
                setPinnedDragIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
              }}
              onDragOver={(e) => {
                if (isExternalFileDrag(e)) return; // 外部文件交给区域容器统一处理
                if (pinnedDragIndex === null) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                if (pinnedDragOverIndex !== index) setPinnedDragOverIndex(index);
              }}
              onDrop={(e) => {
                if (isExternalFileDrag(e)) return; // 外部文件交给区域容器统一处理
                e.preventDefault();
                e.stopPropagation();
                if (pinnedDragIndex !== null && pinnedDragIndex !== index) {
                  onReorderPinnedFolder(pinnedDragIndex, index);
                }
                setPinnedDragIndex(null);
                setPinnedDragOverIndex(null);
              }}
              onDragEnd={() => {
                setPinnedDragIndex(null);
                setPinnedDragOverIndex(null);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setPinnedContextMenu({ x: e.clientX, y: e.clientY, index });
              }}
              title={pinned.path}
            >
              <Folder className="h-3 w-3 flex-shrink-0 text-content-tertiary" />
              <span className="flex-1 truncate">{pinned.name}</span>
            </div>
          ))}
        </div>
      )}

      <ContextMenu
        isOpen={!!pinnedContextMenu}
        x={pinnedContextMenu?.x ?? 0}
        y={pinnedContextMenu?.y ?? 0}
        items={pinnedContextMenuItems}
        onClose={closePinnedContextMenu}
      />
    </div>
  );
};

export default PinnedFoldersSection;
