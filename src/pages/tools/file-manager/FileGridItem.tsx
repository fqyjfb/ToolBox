import React, { memo } from 'react';
import { Folder, File } from 'lucide-react';

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedTime?: Date;
}

interface FileGridItemProps {
  item: FileItem;
  isDragging: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

const formatSize = (bytes?: number) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const FileGridItem: React.FC<FileGridItemProps> = ({
  item,
  isDragging,
  onClick,
  onDoubleClick,
  onContextMenu,
  onDragStart,
  onDragEnd,
}) => {
  return (
    <div
      className={`p-3 rounded-lg cursor-pointer border border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all group ${
        isDragging ? 'opacity-50' : ''
      }`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={item.isDirectory ? '点击打开文件夹，拖拽到目标路径可复制' : '点击打开文件'}
    >
      <div className="flex items-center justify-center mb-2">
        {item.isDirectory ? (
          <div className="w-12 h-12 flex items-center justify-center bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
            <Folder className="w-6 h-6 text-primary" />
          </div>
        ) : (
          <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
            <File className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </div>
        )}
      </div>
      <div className="text-xs text-center text-text-primary truncate mb-1">
        {item.name}
      </div>
      <div className="text-xs text-center text-text-tertiary">
        {item.isDirectory ? '文件夹' : formatSize(item.size)}
      </div>
    </div>
  );
};

export default memo(FileGridItem);