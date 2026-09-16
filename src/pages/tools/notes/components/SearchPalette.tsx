// SearchPalette —— Cmd/Ctrl+Shift+F 命令面板：Esc 关闭、↑↓ 导航、Enter 跳转；快捷键由父级注册。

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, FileText, Hash, Tag, CornerDownLeft } from 'lucide-react';
import type { FileTreeNode, NotesSearchResultItem, NotesSearchMatch } from '../types';
import { SEARCH_PALETTE_DISPLAY_LIMIT } from '../constants/limits';

export interface SearchPaletteProps {
  isOpen: boolean;
  query: string;
  results: NotesSearchResultItem[];
  loading: boolean;
  error: string | null;
  scanned: number;
  elapsedMs: number;
  truncated: boolean;
  onQueryChange: (q: string) => void;
  onSelectMatch: (
    item: NotesSearchResultItem | FileTreeNode,
    match: NotesSearchMatch
  ) => void;
  onClose: () => void;
}

// 高亮 query 关键字，返回若干 React 节点
function highlightSnippet(snippet: string, query: string): React.ReactNode {
  if (!query.trim()) return snippet;
  const q = query.trim();
  const lowerSnippet = snippet.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  while (cursor < snippet.length) {
    const idx = lowerSnippet.indexOf(lowerQuery, cursor);
    if (idx === -1) {
      parts.push(snippet.slice(cursor));
      break;
    }
    if (idx > cursor) parts.push(snippet.slice(cursor, idx));
    parts.push(
      <mark
        key={`${cursor}-${idx}`}
        className="bg-primary/25 text-text-primary font-medium rounded px-0.5"
      >
        {snippet.slice(idx, idx + q.length)}
      </mark>
    );
    cursor = idx + q.length;
  }
  return parts;
}

// 把结果拍平为「行级条目」便于上下键导航；同一文件多个 match 各占一行。
interface FlatRow {
  item: NotesSearchResultItem;
  match: NotesSearchMatch;
}

function flattenRows(results: NotesSearchResultItem[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const item of results) {
    for (const m of item.matches) {
      rows.push({ item, match: m });
    }
  }
  return rows;
}

function fieldIcon(field: NotesSearchMatch['field']): React.ReactNode {
  if (field === 'title') return <FileText className="h-3 w-3" />;
  if (field === 'tag') return <Tag className="h-3 w-3" />;
  return <Hash className="h-3 w-3" />;
}

function fieldLabel(field: NotesSearchMatch['field']): string {
  if (field === 'title') return '标题';
  if (field === 'tag') return '标签';
  return '正文';
}

const SearchPalette: React.FC<SearchPaletteProps> = ({
  isOpen,
  query,
  results,
  loading,
  error,
  scanned,
  elapsedMs,
  truncated,
  onQueryChange,
  onSelectMatch,
  onClose,
}) => {
  const [activeRow, setActiveRow] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const flatRows = useMemo(() => flattenRows(results), [results]);
  const visibleRows = useMemo(
    () => flatRows.slice(0, SEARCH_PALETTE_DISPLAY_LIMIT),
    [flatRows]
  );

  // 打开时 autoFocus + 选中已有 query
  useEffect(() => {
    if (isOpen) {
      setActiveRow(0);
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
        if (inputRef.current && query) {
          inputRef.current.select();
        }
      }, 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [isOpen, query]);

  // 打开时锁 body 滚动 + 绑定 Esc/↑↓/Enter；关闭后恢复。
  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveRow((idx) =>
          visibleRows.length === 0
            ? 0
            : Math.min(visibleRows.length - 1, idx + 1)
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveRow((idx) => Math.max(0, idx - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const row = visibleRows[activeRow];
        if (row) onSelectMatch(row.item, row.match);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose, activeRow, visibleRows, onSelectMatch]);

  // activeRow 变化时把对应行滚到可视区
  useEffect(() => {
    if (!isOpen) return;
    const root = listRef.current;
    if (!root) return;
    const node = root.querySelector<HTMLButtonElement>(
      `[data-row-index="${activeRow}"]`
    );
    if (node) {
      // 只滚结果列表自身：scrollIntoView 会连带滚动外层 overflow:hidden 容器，把头部顶出可视区。
      const box = root.getBoundingClientRect();
      const row = node.getBoundingClientRect();
      if (row.top < box.top) {
        root.scrollTop -= box.top - row.top;
      } else if (row.bottom > box.bottom) {
        root.scrollTop += row.bottom - box.bottom;
      }
    }
  }, [activeRow, isOpen]);

  useEffect(() => {
    setActiveRow(0);
  }, [results]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="搜索笔记"
    >
      {/* 背景遮罩，点击关闭 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 面板主体 */}
      <div
        className={`
          relative w-full max-w-2xl mx-auto
          rounded-lg shadow-2xl overflow-hidden border border-border
          bg-bg-primary text-text-primary
          animate-[paletteSlideIn_0.18s_cubic-bezier(0.175,0.885,0.32,1.275)]
        `}
      >
        {/* 顶部输入行 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-secondary">
          <Search className="h-4 w-4 text-text-secondary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索笔记（Cmd/Ctrl+Shift+F）"
            className="
              flex-1 bg-transparent outline-none border-0
              text-sm placeholder:text-text-secondary
              text-text-primary
            "
            spellCheck={false}
            autoComplete="off"
          />
          {/* 清空关键字；右侧另一个 ✕ 是「关闭面板」 */}
          {query.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onQueryChange('')}
              className="h-6 w-6 flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors shrink-0"
              aria-label="清空关键字"
              title="清空关键字"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {loading && (
            <span
              className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0"
              aria-label="搜索中"
            />
          )}
          <button
            type="button"
            onClick={onClose}
            className="
              h-7 w-7 flex items-center justify-center rounded-md
              text-text-secondary hover:text-text-primary hover:bg-bg-primary
              transition-colors shrink-0
            "
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 结果列表 / 空态 / 错误态 */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto bg-bg-primary"
        >
          {error && (
            <div className="px-4 py-6 text-sm text-error">
              搜索失败：{error}
            </div>
          )}

          {!error && query.trim() === '' && (
            <div className="px-4 py-10 text-center text-sm text-text-secondary">
              <Search className="mx-auto h-6 w-6 mb-2 opacity-50" />
              <p>输入关键字以全文搜索笔记</p>
              <p className="mt-2 text-xs text-text-secondary/70">
                命中权重：标题 &gt; 标签 &gt; 正文
              </p>
            </div>
          )}

          {!error && query.trim() !== '' && visibleRows.length === 0 && !loading && (
            <div className="px-4 py-10 text-center text-sm text-text-secondary">
              <p>未找到匹配「{query.trim()}」的笔记</p>
              {scanned > 0 && (
                <p className="mt-1 text-xs text-text-secondary/70">
                  共扫描 {scanned} 个文件
                  {elapsedMs > 0 ? `（${elapsedMs}ms）` : ''}
                </p>
              )}
            </div>
          )}

          {visibleRows.length > 0 && (
            <ul role="listbox" className="py-1">
              {visibleRows.map((row, idx) => {
                const { item, match } = row;
                const isActive = idx === activeRow;
                return (
                  <li key={`${item.path}-${match.line}-${idx}`} role="option">
                    <button
                      type="button"
                      data-row-index={idx}
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveRow(idx)}
                      onClick={() => onSelectMatch(item, match)}
                      className={`
                        w-full text-left px-4 py-2 flex flex-col gap-0.5
                        ${
                          isActive
                            ? 'bg-primary/15 text-text-primary'
                            : 'hover:bg-bg-secondary text-text-primary'
                        }
                        transition-colors
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`
                            inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium
                            ${
                              match.field === 'title'
                                ? 'bg-primary/20 text-primary'
                                : match.field === 'tag'
                                  ? 'bg-accent/15 text-accent'
                                  : 'bg-bg-secondary text-text-secondary'
                            }
                          `}
                          title={`命中类型：${fieldLabel(match.field)}`}
                        >
                          {fieldIcon(match.field)}
                          {fieldLabel(match.field)}
                        </span>
                        <span className="text-sm font-medium truncate">
                          {item.name}
                        </span>
                        <span className="ml-auto text-[11px] text-text-secondary tabular-nums shrink-0">
                          L{match.line}
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary line-clamp-2 break-all pl-1">
                        {highlightSnippet(match.snippet, query)}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 底部状态条 */}
        <div className="flex items-center justify-between px-4 py-2 text-[11px] text-text-secondary border-t border-border bg-bg-secondary">
          <div className="flex items-center gap-3">
            {scanned > 0 && (
              <span>
                扫描 {scanned} 个文件 · {elapsedMs}ms
                {truncated && ' · 结果已截断'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-bg-primary border border-border text-[10px]">
                ↑↓
              </kbd>
              <span>选择</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-bg-primary border border-border text-[10px]">
                <CornerDownLeft className="h-2.5 w-2.5 inline" />
              </kbd>
              <span>跳转</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-bg-primary border border-border text-[10px]">
                Esc
              </kbd>
              <span>关闭</span>
            </span>
          </div>
        </div>

        <style>{`
          @keyframes paletteSlideIn {
            from { opacity: 0; transform: scale(0.96) translateY(-8px); }
            to   { opacity: 1; transform: scale(1)    translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default SearchPalette;
