// 固定目录列表

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Folder, Pin, Plus, Trash } from 'lucide-react';
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

  return (
    <div
      className={`flex-shrink-0 border-b border-gray-100 px-2 py-2 transition-colors dark:border-gray-800 ${
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
        className="flex w-full items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-400 px-1 py-1 hover:text-primary transition-colors"
        onClick={() => toggleSection('pinned')}
      >
        <span className="flex items-center gap-1">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Pin className="h-3 w-3" />
          固定目录 ({pinnedFolders.length})
        </span>
      </button>
      {open && pinnedFolders.length === 0 && (
        <div className="mt-1 rounded border border-dashed border-gray-300 px-2 py-2 text-[11px] text-gray-400 dark:border-gray-700">
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
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
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
              <Folder className="h-3 w-3 flex-shrink-0 text-gray-400" />
              <span className="flex-1 truncate">{pinned.name}</span>
            </div>
          ))}
        </div>
      )}

      {pinnedContextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setPinnedContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setPinnedContextMenu(null);
            }}
          />
          <div
            className="fixed z-50 min-w-[120px] rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            style={{ left: pinnedContextMenu.x, top: pinnedContextMenu.y }}
          >
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              onClick={() => {
                setPinnedContextMenu(null);
                onAddPinnedFolder();
              }}
            >
              <Plus className="w-4 h-4" />
              <span>添加固定目录</span>
            </button>
            <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-error hover:bg-error/10"
              onClick={() => {
                const p = pinnedFolders[pinnedContextMenu.index];
                if (p) {
                  onRemovePinnedFolder(p.path);
                  addToast({ type: 'success', message: `已移除固定目录: ${p.name}` });
                }
                setPinnedContextMenu(null);
              }}
            >
              <Trash className="w-4 h-4" />
              <span>移除</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PinnedFoldersSection;
