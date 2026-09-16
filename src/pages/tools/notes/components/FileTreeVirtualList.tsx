// FileTreeVirtualList —— 文件树虚拟化：把嵌套树按 expanded 扁平化为行，再交给 react-window FixedSizeList。
// 节点 > VIRTUALIZE_THRESHOLD 时由 NotesSidebar 启用，行交互与 FileTreeItem 复用同一回调签名。

import React, { useMemo } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { FileTreeItem } from './FileTreeItem';
import type { FileTreeNode } from '../types';

const DEFAULT_HEIGHT = 480;
const ROW_HEIGHT = 24; // 与 FileTreeItem 的 py-1 + text-xs（16+8）对齐

interface FlatRow {
  node: FileTreeNode;
  depth: number;
}

interface FileTreeVirtualListProps {
  items: FileTreeNode[];
  selectedFile: FileTreeNode | null;
  listSelection: string | null;
  height?: number;
  width?: number | string;
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

// 扁平化递归：按 folder 节点的 expanded 决定是否进入子节点（expanded 由 useNotesTree.expandTree 负责）。
function flattenTree(items: FileTreeNode[], depth: number = 0, acc: FlatRow[] = []): FlatRow[] {
  for (const node of items) {
    acc.push({ node, depth });
    if (
      node.type === 'folder' &&
      node.expanded &&
      node.children &&
      node.children.length > 0
    ) {
      flattenTree(node.children, depth + 1, acc);
    }
  }
  return acc;
}

export const FileTreeVirtualList: React.FC<FileTreeVirtualListProps> = ({
  items,
  selectedFile,
  listSelection,
  height = DEFAULT_HEIGHT,
  width = '100%',
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
  const rows = useMemo(() => flattenTree(items), [items]);

  const Row = ({ index, style }: ListChildComponentProps) => {
    const { node, depth } = rows[index];
    // 必须把 react-window 的 style（top/height/position:absolute）透传给最外层 div，与 paddingLeft 缩进不冲突。
    return (
      <div style={style}>
        <FileTreeItem
          node={node}
          depth={depth}
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
      </div>
    );
  };

  return (
    <FixedSizeList
      height={height}
      width={width}
      itemCount={rows.length}
      itemSize={ROW_HEIGHT}
      overscanCount={8}
    >
      {Row}
    </FixedSizeList>
  );
};

export default FileTreeVirtualList;