// NotesSidebarTagFilter —— 侧栏标签过滤条：chip 横排裁剪不横滚，「更多」菜单常驻（过滤/重命名/删除）。
// 菜单是 absolute，本行不能 overflow-hidden，裁剪只作用在内层 chip 容器上。

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hash, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import { useNotesTags } from '../hooks/useNotesTags';

interface NotesSidebarTagFilterProps {
  className?: string;
  rootPath: string | null;
}

const NotesSidebarTagFilter: React.FC<NotesSidebarTagFilterProps> = ({
  className = '',
  rootPath,
}) => {
  const {
    knownTags,
    index,
    tagFilter,
    setTagFilter,
    loading,
    renameTag,
    deleteTag,
    loadAllTags,
  } = useNotesTags();

  // 同一个 rootPath 只兜底拉一次，避免与页面级加载重复扫描
  const attemptedRootRef = useRef<string | null>(null);

  // 兜底补拉一次：页面级加载若因时序/IPC 失败没落到 store，侧栏就会停在「暂无标签」。
  useEffect(() => {
    if (!rootPath || knownTags.length > 0) return;
    if (attemptedRootRef.current === rootPath) return;
    attemptedRootRef.current = rootPath;
    void loadAllTags(rootPath).catch(() => {
      /* 静默：页面级还有一次加载，且不影响编辑 */
    });
  }, [rootPath, knownTags.length, loadAllTags]);

  const [menuOpen, setMenuOpen] = useState(false);
  // 正在重命名的标签（菜单内该行变成输入框）
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 按 count 降序 + 名字母序升序（菜单与 chip 共用）
  const sortedTags = useMemo(() => {
    return knownTags
      .slice()
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.tag.localeCompare(b.tag);
      });
  }, [knownTags]);

  const toggleFilter = useCallback(
    (tag: string) => {
      setTagFilter(tagFilter === tag ? null : tag);
      setMenuOpen(false);
    },
    [tagFilter, setTagFilter]
  );

  const startEdit = useCallback((tag: string) => {
    setEditing(tag);
    setDraft(tag);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setDraft('');
  }, []);

  // 提交重命名：空值 / 未改动直接取消，不发 IPC
  const commitEdit = useCallback(async () => {
    if (!editing || !rootPath) return;
    const next = draft.trim();
    setEditing(null);
    if (!next || next === editing) return;
    setBusy(true);
    try {
      await renameTag(rootPath, editing, next);
    } finally {
      setBusy(false);
    }
  }, [editing, draft, rootPath, renameTag]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || !rootPath) return;
    setBusy(true);
    try {
      await deleteTag(rootPath, pendingDelete);
      setPendingDelete(null);
    } finally {
      setBusy(false);
    }
  }, [pendingDelete, rootPath, deleteTag]);

  if (sortedTags.length === 0) {
    // 无已知标签：显示禁用占位行，父组件在 rootPath 就绪后 loadAllTags 即可填充
    return (
      <div
        className={`flex items-center gap-1 border-b border-gray-100 dark:border-gray-800 px-2 py-1.5 ${className}`}
      >
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary transition-colors"
          title="尚无标签。打开任意笔记并打标签后会显示在此处。"
        >
          <Hash className="h-3 w-3" />
          标签过滤（暂无标签）
        </button>
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center gap-1 border-b border-gray-100 dark:border-gray-800 px-2 py-1.5 ${className}`}
    >
      <button
        type="button"
        onClick={() => setTagFilter(null)}
        className={`flex-shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${
          tagFilter === null
            ? 'bg-primary text-button-text'
            : 'text-text-secondary hover:bg-bg-secondary'
        }`}
        title="清除过滤"
        disabled={loading}
      >
        <Hash className="h-3 w-3" />
        全部
      </button>

      {/* 只有 chip 容器裁剪，外层不裁剪（否则"更多"的下拉会被切掉） */}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {sortedTags.map((t) => {
          const active = tagFilter === t.tag;
          return (
            <button
              key={t.tag}
              type="button"
              onClick={() => setTagFilter(active ? null : t.tag)}
              className={`flex-shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors ${
                active
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-primary hover:bg-accent/10'
              }`}
              title={`${t.tag} · ${t.count} 个文件${active ? '（再次点击取消）' : ''}`}
            >
              <span className="truncate max-w-[80px]">{t.tag}</span>
              <span className={`text-[10px] ${active ? 'text-white/80' : 'text-text-secondary'}`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 更多：全部标签 + 重命名 / 删除 */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          className="flex items-center rounded p-0.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          title="更多标签 / 管理标签"
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
              // left-0：侧栏只有 12rem，right-0 会向左顶出窗口被裁掉，从左缘向右展开才完整可见
              className="absolute left-0 top-full z-40 mt-1 w-56 rounded-md border border-border bg-bg-primary py-1 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-1 text-[10px] text-text-secondary">
                共 {sortedTags.length} 个标签（点击过滤）
              </div>
              <div className="max-h-64 overflow-y-auto">
                {sortedTags.map((t) => {
                  const active = tagFilter === t.tag;
                  return (
                    <div
                      key={t.tag}
                      className="flex items-center gap-1 px-2 py-1 hover:bg-bg-secondary"
                    >
                      {editing === t.tag ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                          onBlur={() => void commitEdit()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void commitEdit();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelEdit();
                            }
                          }}
                          maxLength={32}
                          className="min-w-0 flex-1 rounded border border-primary bg-bg-primary px-1 py-0.5 text-xs text-text-primary outline-none"
                        />
                      ) : (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => toggleFilter(t.tag)}
                            className="flex min-w-0 flex-1 items-center gap-1 text-left text-xs text-text-primary"
                            title={active ? '取消过滤' : '按此标签过滤'}
                          >
                            <Hash className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{t.tag}</span>
                            <span className="ml-auto text-[10px] text-text-secondary">
                              {t.count}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => startEdit(t.tag)}
                            className="flex-shrink-0 rounded p-0.5 text-text-secondary hover:text-text-primary hover:bg-bg-primary disabled:opacity-50"
                            title="重命名标签"
                            aria-label={`重命名标签 ${t.tag}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setPendingDelete(t.tag)}
                            className="flex-shrink-0 rounded p-0.5 text-text-secondary hover:text-error hover:bg-bg-primary disabled:opacity-50"
                            title="删除标签"
                            aria-label={`删除标签 ${t.tag}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
        title="删除标签"
        message={
          pendingDelete
            ? `将从 ${index[pendingDelete]?.length ?? 0} 个文件中移除标签「${pendingDelete}」。此操作不可撤销。`
            : ''
        }
        confirmText="删除"
        cancelText="取消"
      />
    </div>
  );
};

export default NotesSidebarTagFilter;
