// FileTreeItem —— 单节点渲染

import React, { useRef, useEffect } from 'react';
import { FolderOpen, Folder, FileText, ChevronRight, Table2, FileImage, Code, Play } from 'lucide-react';
import type { FileTreeNode } from '../types';

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  selectedFile: FileTreeNode | null;
  listSelection: string | null;
  onSelectFile: (file: FileTreeNode) => void;
  onSelectItem: (path: string) => void;
  onToggleFolder: (folderPath: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  onItemDragStart: (e: React.DragEvent, node: FileTreeNode) => void;
  onItemDragOver: (e: React.DragEvent, node: FileTreeNode) => void;
  onItemDrop: (e: React.DragEvent, node: FileTreeNode) => void;
  onItemDragEnd: () => void;
  dragOverPath: string | null;
  dragSourcePath: string | null;
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  depth,
  selectedFile,
  listSelection,
  onSelectFile,
  onSelectItem,
  onToggleFolder,
  onContextMenu,
  onItemDragStart,
  onItemDragOver,
  onItemDrop,
  onItemDragEnd,
  dragOverPath,
  dragSourcePath,
}) => {
  const isExpanded = node.expanded ?? false;
  const isSelected = selectedFile?.path === node.path;
  const isListSelected = listSelection === node.path;
  const itemRef = useRef<HTMLDivElement>(null);
  const wasSelectedRef = useRef<boolean | null>(null);

  useEffect(() => {
    const prev = wasSelectedRef.current;
    wasSelectedRef.current = isSelected;
    // 仅在选中态真实切换（false → true）时滚动定位。
    // 虚拟列表滚动会卸载 / 重挂载行，挂载即选中的情况若再 scrollIntoView，
    // 列表会被不断拉回选中项，导致文件多时无法正常滚动。
    if (isSelected && prev === false && itemRef.current) {
      requestAnimationFrame(() => {
        itemRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    }
  }, [isSelected]);

  const handleClick = () => {
    onSelectItem(node.path);
    if (node.type === 'folder') {
      onToggleFolder(node.path);
    } else {
      onSelectFile(node);
    }
  };

  return (
    <>
      <div
        ref={itemRef}
        className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
          isSelected || isListSelected
            ? 'bg-blue-100 text-blue-700 font-medium dark:bg-blue-500/25 dark:text-blue-200'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/40 dark:hover:bg-gray-800/30'
        } ${dragOverPath === node.path ? '!ring-2 !ring-primary' : ''} ${dragSourcePath === node.path ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${depth * 12}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        title={node.path}
        draggable
        onDragStart={(e) => onItemDragStart(e, node)}
        onDragEnd={onItemDragEnd}
        onDragOver={node.type === 'folder' ? (e) => onItemDragOver(e, node) : undefined}
        onDrop={node.type === 'folder' ? (e) => onItemDrop(e, node) : undefined}
      >
        {node.type === 'folder' && (
          <ChevronRight
            className={`h-3 w-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        )}

        {node.type === 'folder' ? (
          isExpanded ? <FolderOpen className="h-3 w-3 flex-shrink-0" /> : <Folder className="h-3 w-3 flex-shrink-0" />
        ) : (
          <>
            {node.fileType === 'docx' && <FileText className="h-3 w-3 flex-shrink-0 text-blue-600" />}
            {node.fileType === 'xlsx' && <Table2 className="h-3 w-3 flex-shrink-0 text-green-600" />}
            {node.fileType === 'image' && <FileImage className="h-3 w-3 flex-shrink-0 text-purple-600" />}
            {node.fileType === 'video' && <Play className="h-3 w-3 flex-shrink-0 text-blue-600" />}
            {node.fileType === 'txt' && <FileText className="h-3 w-3 flex-shrink-0 text-gray-500" />}
            {node.fileType === 'html' && <Code className="h-3 w-3 flex-shrink-0 text-orange-500" />}
            {node.fileType === 'json' && <Code className="h-3 w-3 flex-shrink-0 text-yellow-600" />}
            {(!node.fileType || node.fileType === 'md') && <FileText className="h-3 w-3 flex-shrink-0" />}
          </>
        )}

        <span className="flex-1 truncate">{node.name}</span>
      </div>

      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              listSelection={listSelection}
              onSelectFile={onSelectFile}
              onSelectItem={onSelectItem}
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
    </>
  );
};

export default FileTreeItem;