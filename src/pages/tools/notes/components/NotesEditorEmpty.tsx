// NotesEditorEmpty —— 未打开笔记时的空态（从 NotesEditor.tsx 提取，纯展示组件）

import React from 'react';
import { Edit3, PanelLeft, FolderPlus, FilePlus } from 'lucide-react';

interface NotesEditorEmptyProps {
  sidebarVisible: boolean;
  onToggleSidebar?: () => void;
  onCreateNote?: () => void;
  onCreateFolder?: () => void;
}

const NotesEditorEmpty: React.FC<NotesEditorEmptyProps> = ({
  sidebarVisible,
  onToggleSidebar,
  onCreateNote,
  onCreateFolder,
}) => {
  return (
    <section className="flex flex-1 flex-col min-h-0 min-w-0">
      {/* 与打开笔记后的头部保持一致：侧边栏开关常驻，列表被隐藏后仍有入口恢复 */}
      <div className="flex flex-shrink-0 items-center gap-3 bg-surface-secondary-50 px-4 py-2">
        {onToggleSidebar ? (
          <button
            className="rounded p-1 text-content-tertiary hover:bg-menu-hover dark:hover:bg-surface"
            onClick={onToggleSidebar}
            title={sidebarVisible ? '隐藏列表' : '显示列表'}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-secondary">
          <Edit3 className="h-10 w-10 text-content-tertiary" />
        </div>
        <h3 className="mt-4 text-lg font-medium text-content-secondary">
          还没有打开笔记
        </h3>
        <p className="mt-1 max-w-sm text-center text-sm text-content-tertiary">
          {sidebarVisible
            ? '从左侧文件树选择一篇笔记开始编辑，也可以现在新建'
            : '列表已隐藏，点击左上角图标显示文件树，或直接新建一篇'}
        </p>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onCreateNote}
            disabled={!onCreateNote}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-button-text transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FilePlus className="h-4 w-4" />
            新建笔记
          </button>
          <button
            onClick={onCreateFolder}
            disabled={!onCreateFolder}
            className="flex items-center gap-2 rounded-lg bg-white/60 px-4 py-2 text-sm text-content-primary transition-colors hover:bg-surface-secondary-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FolderPlus className="h-4 w-4" />
            新建文件夹
          </button>
        </div>

        <p className="mt-8 text-xs text-content-tertiary">
          Ctrl + Shift + F 全文搜索 · 拖入文件到左侧列表即可导入
        </p>
      </div>
    </section>
  );
};

export default NotesEditorEmpty;
