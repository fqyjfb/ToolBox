// 侧栏「收藏」分组

import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight, Star, X } from 'lucide-react';
import { useNotesSidebarSectionsStore } from '@/store/notesSidebarSectionsStore';
import type { FileTreeNode, NotesFavoritePath } from '../types';
import { findInTree } from '../utils/treeUtils';

interface NotesSidebarFavoritesProps {
  selectedFile: FileTreeNode | null;
  fileTree: FileTreeNode[];
  favorites: NotesFavoritePath[];
  onToggleFavorite: (absolutePath: NotesFavoritePath) => void;
  onSelectFile: (fileNode: FileTreeNode) => void;
}

const NotesSidebarFavorites: React.FC<NotesSidebarFavoritesProps> = ({
  selectedFile,
  fileTree,
  favorites,
  onToggleFavorite,
  onSelectFile,
}) => {
  const open = useNotesSidebarSectionsStore((s) => s.sections.favorites);
  const toggleSection = useNotesSidebarSectionsStore((s) => s.toggleSection);

  // 关联 fileTree 取 name，未命中则显示 basename
  const favoriteItems = useMemo(() => {
    return favorites
      .map((path) => {
        const node = findInTree(fileTree, path);
        return {
          path,
          name: node?.name || path.split(/[\\/]/).pop() || path,
          found: !!node,
        };
      })
      .slice(0, 20);
  }, [favorites, fileTree]);

  if (favoriteItems.length === 0) return null;

  return (
    <div className="flex-shrink-0 border-b border-gray-100 dark:border-gray-800 px-2 py-2">
      <button
        className="flex w-full items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-400 px-1 py-1 hover:text-primary transition-colors"
        onClick={() => toggleSection('favorites')}
      >
        <span className="flex items-center gap-1">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-500" />
          收藏 ({favoriteItems.length})
        </span>
      </button>
      {open && (
        <div className="mt-1 max-h-48 overflow-y-auto scrollbar-hide space-y-0.5">
          {favoriteItems.map((item) => {
            const isActive = selectedFile?.path === item.path;
            return (
              <div
                key={`fav-${item.path}`}
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
                <Star className="h-3 w-3 flex-shrink-0 fill-yellow-400 text-yellow-500" />
                <span className="flex-1 truncate">{item.name}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-yellow-500 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(item.path);
                  }}
                  title="取消收藏"
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

export default NotesSidebarFavorites;
