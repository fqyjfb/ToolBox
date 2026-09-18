// 侧栏「最近」分组

import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight, Clock, X } from 'lucide-react';
import { useNotesSidebarSectionsStore } from '@/store/notesSidebarSectionsStore';
import type { FileTreeNode, NotesRecentItem, NotesFavoritePath } from '../types';
import { findInTree } from '../utils/treeUtils';

interface NotesSidebarRecentsProps {
  selectedFile: FileTreeNode | null;
  fileTree: FileTreeNode[];
  recents: NotesRecentItem[];
  onSelectFile: (fileNode: FileTreeNode) => void;
  onRemoveRecent: (absolutePath: NotesFavoritePath) => void;
  onClearRecents: () => void;
}

const NotesSidebarRecents: React.FC<NotesSidebarRecentsProps> = ({
  selectedFile,
  fileTree,
  recents,
  onSelectFile,
  onRemoveRecent,
  onClearRecents,
}) => {
  const open = useNotesSidebarSectionsStore((s) => s.sections.recents);
  const toggleSection = useNotesSidebarSectionsStore((s) => s.toggleSection);

  const recentItems = useMemo(() => {
    return recents.slice(0, 20).map((item) => {
      const node = findInTree(fileTree, item.path);
      return {
        ...item,
        name: node?.name || item.name,
        found: !!node,
      };
    });
  }, [recents, fileTree]);

  if (recentItems.length === 0) return null;

  return (
    <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 px-2 py-2">
      <button
        className="flex w-full items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-400 px-1 py-1 hover:text-primary transition-colors"
        onClick={() => toggleSection('recents')}
      >
        <span className="flex items-center gap-1">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Clock className="h-3 w-3" />
          最近 ({recentItems.length})
        </span>
        <span
          role="button"
          tabIndex={0}
          className="text-gray-400 hover:text-red-500 transition-colors px-1"
          onClick={(e) => {
            e.stopPropagation();
            onClearRecents();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onClearRecents();
            }
          }}
          title="清空最近列表"
        >
          清空
        </span>
      </button>
      {open && (
        <div className="mt-1 max-h-48 overflow-y-auto scrollbar-hide space-y-0.5">
          {recentItems.map((item) => {
            const isActive = selectedFile?.path === item.path;
            return (
              <div
                key={`rec-${item.path}`}
                className={`group flex items-center gap-1 rounded px-2 py-1 text-xs cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 font-medium dark:bg-blue-500/25 dark:text-blue-200'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                } ${!item.found ? 'opacity-60' : ''}`}
                onClick={() => {
                  const node = findInTree(fileTree, item.path);
                  if (node) onSelectFile(node);
                }}
                title={item.path}
              >
                <Clock className="h-3 w-3 flex-shrink-0 text-gray-400" />
                <span className="flex-1 truncate">{item.name}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRecent(item.path);
                  }}
                  title="从最近移除"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotesSidebarRecents;
