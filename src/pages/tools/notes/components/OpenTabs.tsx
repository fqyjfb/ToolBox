// OpenTabs —— 顶部标签条：标签只存路径，点击 = selectFile（编辑器始终单例）。
// 快捷键 Ctrl+Tab / Ctrl+Shift+Tab 切标签、Ctrl+Alt+←/→ 兜底、Ctrl+Alt+W 关闭（不用 Ctrl+W，窗口菜单已占用）。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import { useNotesTabs } from '../hooks/useNotesTabs';

interface OpenTabsProps {
  onSelect: (path: string) => void;
}

// 待确认的关闭动作：one=单个标签，all=关闭全部且存在脏标签；两者复用同一 ConfirmDialog。
type PendingClose = { scope: 'one'; path: string } | { scope: 'all' };

function basenameOf(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

const OpenTabs: React.FC<OpenTabsProps> = ({ onSelect }) => {
  const { tabs, activePath, dirtyMap, closeTab, reorderTab } = useNotesTabs();
  const [pendingClose, setPendingClose] = useState<PendingClose | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const dragIndexRef = useRef<number | null>(null);

  // 关掉当前标签时把激活位让给相邻标签（先右后左）
  const commitClose = useCallback(
    (path: string) => {
      const index = tabs.indexOf(path);
      const neighbour = index >= 0 ? tabs[index + 1] ?? tabs[index - 1] ?? null : null;
      closeTab(path);
      if (path === activePath && neighbour) onSelect(neighbour);
    },
    [tabs, closeTab, activePath, onSelect]
  );

  // 批量关闭（「更多」菜单两项共用）：若关掉当前激活标签，切到剩下的第一个标签。
  const closeTabs = useCallback(
    (paths: string[]) => {
      setMenuOpen(false);
      const closing = new Set(paths);
      const closingActive = activePath !== null && closing.has(activePath);
      const neighbour = closingActive ? tabs.find((path) => !closing.has(path)) ?? null : null;
      paths.forEach((path) => closeTab(path));
      if (closingActive && neighbour) onSelect(neighbour);
    },
    [closeTab, activePath, tabs, onSelect]
  );

  // 点击 ⨯：脏文件先弹确认框
  const requestClose = useCallback(
    (path: string) => {
      if (dirtyMap[path]) {
        setPendingClose({ scope: 'one', path });
        return;
      }
      commitClose(path);
    },
    [dirtyMap, commitClose]
  );

  // 更多 → 关闭全部：有未保存标签时先确认（先收菜单，避免浮层压在弹窗上）
  const handleCloseAll = useCallback(() => {
    if (tabs.some((path) => !!dirtyMap[path])) {
      setMenuOpen(false);
      setPendingClose({ scope: 'all' });
      return;
    }
    closeTabs([...tabs]);
  }, [tabs, dirtyMap, closeTabs]);

  // 更多 → 关闭已保存：只关非脏标签，天然安全
  const handleCloseSaved = useCallback(() => {
    closeTabs(tabs.filter((path) => !dirtyMap[path]));
  }, [tabs, dirtyMap, closeTabs]);

  // 快捷键：Ctrl+Tab / Ctrl+Shift+Tab 切标签（Ctrl+Alt+←/→ 兜底），Ctrl+Alt+W 关闭当前标签。
  useEffect(() => {
    if (tabs.length === 0) return undefined;
    // 按 delta 循环取目标标签（+1 下一个，-1 上一个）
    const step = (index: number, delta: number): string | undefined =>
      tabs[(index + delta + tabs.length) % tabs.length];
    const onKeyDown = (e: KeyboardEvent) => {
      const index = activePath ? tabs.indexOf(activePath) : -1;
      if (e.ctrlKey && !e.altKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        const prev = step(index, -1);
        if (prev) onSelect(prev);
        return;
      }
      if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        const next = step(index, 1);
        if (next) onSelect(next);
        return;
      }
      if (e.ctrlKey && e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        const target = step(index, e.key === 'ArrowRight' ? 1 : -1);
        if (target) onSelect(target);
        return;
      }
      if (e.ctrlKey && e.altKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        if (activePath) requestClose(activePath);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [tabs, activePath, onSelect, requestClose]);

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (index: number) => {
      const from = dragIndexRef.current;
      dragIndexRef.current = null;
      if (from !== null && from !== index) reorderTab(from, index);
    },
    [reorderTab]
  );

  if (tabs.length === 0) return null;

  // 内层负责裁剪（min-w-0 让 truncate 生效）；外层不设 overflow-hidden，否则「更多」面板会被裁掉。
  return (
    <div className="flex flex-shrink-0 items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {tabs.map((path, index) => {
          const isActive = path === activePath;
          const dirty = !!dirtyMap[path];
          return (
            <div
              key={path}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              onClick={() => {
                if (!isActive) onSelect(path);
              }}
              title={path}
              className={`group flex min-w-0 max-w-[180px] cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                isActive
                  ? 'bg-white text-primary shadow-sm dark:bg-gray-900 dark:text-primary'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <span className="truncate">{basenameOf(path)}</span>
              {dirty && (
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary"
                  title="未保存"
                />
              )}
              <button
                type="button"
                className="flex-shrink-0 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-gray-600"
                onClick={(e) => {
                  e.stopPropagation();
                  requestClose(path);
                }}
                title="关闭标签"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* 更多菜单：固定在标签条最右侧，不影响标签宽度自适应 */}
      <div className="relative ml-auto flex-shrink-0">
        <button
          type="button"
          className="flex items-center rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-200"
          onClick={() => setMenuOpen((v) => !v)}
          title="更多操作"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <>
            {/* 点击遮罩关闭（不拦截面板内点击） */}
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-1 w-32 rounded-md border border-border bg-bg-primary py-1 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-secondary"
                onClick={handleCloseAll}
              >
                关闭全部
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-secondary"
                onClick={handleCloseSaved}
              >
                关闭已保存
              </button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={pendingClose !== null}
        onClose={() => setPendingClose(null)}
        onConfirm={() => {
          if (!pendingClose) return;
          if (pendingClose.scope === 'all') closeTabs([...tabs]);
          else commitClose(pendingClose.path);
        }}
        title={pendingClose?.scope === 'all' ? '关闭全部标签' : '关闭标签'}
        message={
          pendingClose?.scope === 'all'
            ? '有标签存在未保存的修改，关闭后未保存内容将丢失。确定要关闭吗？'
            : '该文件有未保存的修改，关闭后未保存内容将丢失。确定要关闭吗？'
        }
        confirmText="关闭"
        cancelText="取消"
        deleteItemName={pendingClose?.scope === 'one' ? pendingClose.path : undefined}
      />
    </div>
  );
};

export default OpenTabs;
