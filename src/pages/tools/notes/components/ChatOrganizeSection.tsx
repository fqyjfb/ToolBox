// 对话模式切换 + 对话整理树

import React from 'react';
import { Folder as FolderIcon, ChevronDown, ChevronRight, MessageCircle } from 'lucide-react';
import { FileTreeItem } from './FileTreeItem';
import type { FileTreeNode } from '../types';

export interface ChatOrganizeSectionProps {
  isChatMode: boolean;
  onToggleChatMode: () => void;
  chatOrganizePath: string | null | undefined;
  chatOrganizeTree: FileTreeNode[];
  isOrganizeExpanded: boolean;
  onToggleOrganize: () => void;
  onSelectOrganizeFolder?: () => void;
  selectedFile: FileTreeNode | null;
  listSelection: string | null;
  setListSelection: React.Dispatch<React.SetStateAction<string | null>>;
  onSelectFile: (file: FileTreeNode) => void;
  onToggleFolder: (folderPath: string) => void;
  onContextMenu: (e: React.MouseEvent, node?: FileTreeNode) => void;
  onItemDragStart: (e: React.DragEvent, node: FileTreeNode) => void;
  onItemDragOver: (e: React.DragEvent, node: FileTreeNode) => void;
  onItemDrop: (e: React.DragEvent, node: FileTreeNode) => Promise<void>;
  onItemDragEnd: () => void;
  dragOverPath: string | null;
  dragSourcePath: string | null;
}

export const ChatOrganizeSection: React.FC<ChatOrganizeSectionProps> = ({
  isChatMode,
  onToggleChatMode,
  chatOrganizePath,
  chatOrganizeTree,
  isOrganizeExpanded,
  onToggleOrganize,
  onSelectOrganizeFolder,
  selectedFile,
  listSelection,
  setListSelection,
  onSelectFile,
  onToggleFolder,
  onContextMenu,
  onItemDragStart,
  onItemDragOver,
  onItemDrop,
  onItemDragEnd,
  dragOverPath,
  dragSourcePath,
}) => {
  return (
    <div className="flex-shrink-0 px-2 py-2 space-y-0.5">
      <div
        className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
          isChatMode
            ? 'bg-menu-hover dark:bg-menu-hover text-primary font-medium'
            : 'text-content-primary hover:bg-menu-hover dark:hover:bg-menu-hover'
        }`}
        onClick={onToggleChatMode}
      >
        <MessageCircle className="h-3 w-3 flex-shrink-0" />
        <span className="flex-1 truncate">对话</span>
      </div>

      {chatOrganizePath && chatOrganizeTree.length > 0 && (() => {
        const organizeNode = chatOrganizeTree[0];
        const organizeChildren = organizeNode?.children || [];
        return (
          <div>
            <button
              className="flex w-full items-center justify-between text-xs font-medium text-content-secondary px-1 py-1 hover:text-primary transition-colors"
              onClick={() => {
                onToggleOrganize();
                if (!isOrganizeExpanded) onSelectOrganizeFolder?.();
              }}
              title={chatOrganizePath}
            >
              <span className="flex items-center gap-1">
                {isOrganizeExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <FolderIcon className="h-3 w-3" />
                对话整理
              </span>
            </button>
            {isOrganizeExpanded && organizeChildren.length > 0 && (
              <div className="mt-1 max-h-48 overflow-y-auto scrollbar-hide space-y-0.5">
                {organizeChildren.map((child) => (
                  <FileTreeItem
                    key={child.id}
                    node={child}
                    depth={1}
                    selectedFile={selectedFile}
                    listSelection={listSelection}
                    onSelectFile={onSelectFile}
                    onSelectItem={setListSelection}
                    onToggleFolder={onToggleFolder}
                    onContextMenu={onContextMenu}
                    onItemDragStart={onItemDragStart}
                    onItemDragOver={onItemDragOver}
                    onItemDrop={onItemDrop}
                    onItemDragEnd={onItemDragEnd}
                    dragOverPath={dragOverPath}
                    dragSourcePath={dragSourcePath}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default ChatOrganizeSection;