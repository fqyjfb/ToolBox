// SidebarToolbar —— 侧栏顶部工具条：刷新 / 重建索引 / 固定目录 / 对话路径 / 新建文件夹 / ▾ 用模板新建笔记。

import React, { useState } from 'react';
import { RefreshCw, RotateCcw, Pin, MessageSquare, FolderPlus, ChevronDown } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';
import { CreateNoteMenu } from './CreateNoteMenu';
import { useNotesTemplates } from '../hooks/useNotesTemplates';
import type { NotesTemplate } from '../types';

export interface SidebarToolbarProps {
  loading: boolean;
  onRefresh: () => void;
  onRebuildIndex?: () => Promise<void>;
  onAddPinnedFolder: () => Promise<boolean>;
  onSetChatPath: () => Promise<boolean>;
  chatPath: string | null;
  onOpenCreateDialog: (type: 'folder' | 'note', parentPath: string | null) => void;
  currentViewPath: string | null;
  onCreateNote?: (
    parentPath: string | null,
    name: string,
    content?: string
  ) => Promise<{ success: boolean; exists?: boolean }>;
  onCreateNoteForce?: (
    parentPath: string | null,
    name: string,
    mode: 'overwrite' | 'copy',
    content?: string
  ) => Promise<boolean>;
}

// 模板笔记默认文件名后缀：20250101
function formatDateSuffix(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

export const SidebarToolbar: React.FC<SidebarToolbarProps> = ({
  loading,
  onRefresh,
  onRebuildIndex,
  onAddPinnedFolder,
  onSetChatPath,
  chatPath,
  onOpenCreateDialog,
  currentViewPath,
  onCreateNote,
  onCreateNoteForce,
}) => {
  const [isRebuilding, setIsRebuilding] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  // 必须解构出稳定引用，不能把整个 hook 返回值放进 deps
  const { builtin, user, loading: tplLoading, error: tplError, all, render, refresh } =
    useNotesTemplates();
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // 无任何模板时不展示入口
  const hasTemplates = all().length > 0;
  const showTemplateEntry = Boolean(onCreateNote) && hasTemplates;

  const handleRebuildIndex = async () => {
    if (!onRebuildIndex || isRebuilding) return;
    setIsRebuilding(true);
    try {
      await onRebuildIndex();
    } finally {
      setIsRebuilding(false);
    }
  };

  // 「模板名-日期」自动命名；同名时走 createNoteForce('copy') 追加 (1)，不弹窗
  const handleSelectTemplate = async (tpl: NotesTemplate): Promise<void> => {
    setMenuOpen(false);
    if (!onCreateNote || creating) return;
    const name = `${tpl.name}-${formatDateSuffix(new Date())}`;
    const content = render(tpl);
    setCreating(true);
    try {
      const result = await onCreateNote(currentViewPath, name, content);
      if (result && result.success) {
        addToast({ type: 'success', message: `已用「${tpl.name}」模板创建笔记` });
      } else if (result && result.exists && onCreateNoteForce) {
        const ok = await onCreateNoteForce(currentViewPath, name, 'copy', content);
        addToast({
          type: ok ? 'success' : 'error',
          message: ok ? `已用「${tpl.name}」模板创建笔记` : '创建笔记失败',
        });
      } else {
        addToast({ type: 'error', message: '创建笔记失败' });
      }
    } catch {
      addToast({ type: 'error', message: '创建笔记失败' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-3">
      <div className="flex items-center gap-1">
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
          onClick={onRefresh}
          disabled={loading}
          title="刷新"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        {onRebuildIndex && (
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={handleRebuildIndex}
            disabled={isRebuilding}
            title="重建索引"
          >
            <RotateCcw className={`w-4 h-4 ${isRebuilding ? 'animate-spin' : ''}`} />
          </button>
        )}
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
          onClick={onAddPinnedFolder}
          disabled={loading}
          title="添加固定目录"
        >
          <Pin className="w-4 h-4" />
        </button>
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
          onClick={onSetChatPath}
          disabled={loading}
          title={chatPath ? `对话路径: ${chatPath}` : '设置对话路径'}
        >
          <MessageSquare className="w-4 h-4" />
        </button>
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
          onClick={() => onOpenCreateDialog('folder', currentViewPath)}
          title="新建文件夹"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
        {showTemplateEntry && (
          <div className="relative flex items-center">
            <button
              className="rounded p-0.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              onClick={() => setMenuOpen((prev) => !prev)}
              disabled={creating}
              title="用模板新建笔记"
            >
              <ChevronDown className={`w-3 h-3 ${creating ? 'animate-pulse' : ''}`} />
            </button>
            <CreateNoteMenu
              open={menuOpen}
              builtin={builtin}
              user={user}
              loading={tplLoading}
              error={tplError}
              busy={creating}
              onSelect={handleSelectTemplate}
              onRefresh={refresh}
              onClose={() => setMenuOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SidebarToolbar;
