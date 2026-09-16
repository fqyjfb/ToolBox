import React, { useEffect, useState, useCallback } from 'react';
import { Upload } from 'lucide-react';

interface DragOverlayProps {
  onFileDrop: (file: File) => void;
}

const DragOverlay: React.FC<DragOverlayProps> = ({ onFileDrop }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const dataTransfer = e.dataTransfer;
    if (!dataTransfer) return;

    const files = dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.zip') || file.name.endsWith('.plugin')) {
        onFileDrop(file);
      }
    }
  }, [onFileDrop]);

  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
      }
    };

    document.addEventListener('dragover', handleGlobalDragOver);
    return () => {
      document.removeEventListener('dragover', handleGlobalDragOver);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 pointer-events-none ${
        isDragOver ? 'pointer-events-auto' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      )}
      
      <div
        className={`
          relative flex flex-col items-center justify-center gap-4
          w-80 h-64 rounded-xl border-2 border-dashed
          transition-all duration-200
          ${isDragOver
            ? 'bg-white/95 dark:bg-gray-800/95 border-primary shadow-xl scale-105'
            : 'bg-white/50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 opacity-0 hover:opacity-100'
          }
        `}
      >
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
            isDragOver ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-700'
          }`}
        >
          <Upload
            className={`w-8 h-8 transition-colors ${
              isDragOver ? 'text-primary' : 'text-gray-400'
            }`}
          />
        </div>
        
        <div className="text-center">
          <p className={`text-sm font-medium transition-colors ${
            isDragOver ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'
          }`}>
            {isDragOver ? '松开鼠标以安装插件' : '拖拽插件包到此处'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            支持 .zip 或 .plugin 文件
          </p>
        </div>
      </div>
    </div>
  );
};

export default DragOverlay;