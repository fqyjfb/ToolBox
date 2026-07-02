import React, { memo } from 'react';
import {
  Folder,
  File,
  FileText,
  FileCode,
  FileImage,
  FileAudio,
  FileVideo,
  FileSpreadsheet,
  FileArchive,
  FileJson,
  FileX,
  Presentation,
  BookOpen,
} from 'lucide-react';

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

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const textExts = ['txt', 'md', 'markdown', 'log', 'readme', 'rst'];
  const codeExts = ['js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less', 'html', 'vue', 'svelte', 'react', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'php', 'rb', 'swift', 'kt', 'dart'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'heic'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'];
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'];
  const spreadsheetExts = ['xls', 'xlsx', 'csv', 'tsv'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'];
  const jsonExts = ['json'];
  const xmlExts = ['xml', 'html', 'svg'];
  const pdfExts = ['pdf'];
  const pptExts = ['ppt', 'pptx', 'key', 'odp'];
  const docExts = ['doc', 'docx', 'odt'];

  if (textExts.includes(ext || '')) return FileText;
  if (codeExts.includes(ext || '')) return FileCode;
  if (imageExts.includes(ext || '')) return FileImage;
  if (audioExts.includes(ext || '')) return FileAudio;
  if (videoExts.includes(ext || '')) return FileVideo;
  if (spreadsheetExts.includes(ext || '')) return FileSpreadsheet;
  if (archiveExts.includes(ext || '')) return FileArchive;
  if (jsonExts.includes(ext || '')) return FileJson;
  if (xmlExts.includes(ext || '')) return FileX;
  if (pdfExts.includes(ext || '')) return BookOpen;
  if (pptExts.includes(ext || '')) return Presentation;
  if (docExts.includes(ext || '')) return FileText;
  
  return File;
};

const getFileIconColor = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const blueExts = ['js', 'jsx', 'ts', 'tsx', 'json'];
  const greenExts = ['html', 'css', 'scss', 'less'];
  const orangeExts = ['py', 'java', 'cpp', 'c', 'cs', 'go', 'rs'];
  const redExts = ['pdf'];
  const purpleExts = ['md', 'markdown'];
  const pinkExts = ['xml', 'svg'];
  const yellowExts = ['xls', 'xlsx', 'csv'];
  const cyanExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const tealExts = ['mp3', 'wav', 'ogg'];
  const indigoExts = ['mp4', 'mov', 'avi'];
  const grayExts = ['zip', 'rar', '7z', 'tar'];
  const slateExts = ['txt', 'log', 'readme'];

  if (blueExts.includes(ext || '')) return 'text-blue-500 dark:text-blue-400';
  if (greenExts.includes(ext || '')) return 'text-green-500 dark:text-green-400';
  if (orangeExts.includes(ext || '')) return 'text-orange-500 dark:text-orange-400';
  if (redExts.includes(ext || '')) return 'text-red-500 dark:text-red-400';
  if (purpleExts.includes(ext || '')) return 'text-purple-500 dark:text-purple-400';
  if (pinkExts.includes(ext || '')) return 'text-pink-500 dark:text-pink-400';
  if (yellowExts.includes(ext || '')) return 'text-yellow-600 dark:text-yellow-500';
  if (cyanExts.includes(ext || '')) return 'text-cyan-500 dark:text-cyan-400';
  if (tealExts.includes(ext || '')) return 'text-teal-500 dark:text-teal-400';
  if (indigoExts.includes(ext || '')) return 'text-indigo-500 dark:text-indigo-400';
  if (grayExts.includes(ext || '')) return 'text-gray-500 dark:text-gray-400';
  if (slateExts.includes(ext || '')) return 'text-slate-500 dark:text-slate-400';
  
  return 'text-gray-500 dark:text-gray-400';
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
  const FileIcon = getFileIcon(item.name);
  const iconColor = getFileIconColor(item.name);
  
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
            <FileIcon className={`w-6 h-6 ${iconColor}`} />
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
