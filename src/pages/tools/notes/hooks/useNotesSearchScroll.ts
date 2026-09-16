// useNotesSearchScroll —— 监听 notes:navigate-to-match 事件，跳行到目标行（Vditor 无 gotoLine API，退化为 DOM 操作 + 重试）。

import { useEffect, useRef } from 'react';
import { NOTES_NAVIGATE_EVENT } from './useNotesSearch';
import type { NavigateToMatchDetail } from './useNotesSearch';

const RETRY_INTERVAL_MS = 150;
const RETRY_WINDOW_MS = 800;

export function useNotesSearchScroll(): void {
  const pendingScrollRef = useRef<{ line: number; ts: number } | null>(null);

  useEffect(() => {
    const onNavigate = (evt: Event) => {
      const ce = evt as CustomEvent<NavigateToMatchDetail>;
      const detail = ce?.detail;
      if (!detail || typeof detail.line !== 'number') return;
      pendingScrollRef.current = { line: detail.line, ts: Date.now() };
      tryScrollToLine(detail.line, false);
    };
    window.addEventListener(NOTES_NAVIGATE_EVENT, onNavigate);
    return () => {
      window.removeEventListener(NOTES_NAVIGATE_EVENT, onNavigate);
    };
  }, []);

  // 周期重试：Vditor 渲染新内容异步，800ms 窗口内每 150ms 重试。
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const pending = pendingScrollRef.current;
      if (!pending) return;
      const elapsed = Date.now() - pending.ts;
      if (elapsed > RETRY_WINDOW_MS) {
        pendingScrollRef.current = null;
        return;
      }
      tryScrollToLine(pending.line, true);
    }, RETRY_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);
}

// 只滚最近一个真正可滚动的祖先容器（用 scrollIntoView 会连带滚动 overflow:hidden 的祖先，把头部顶出可视区）。
function scrollWithinOwnScroller(target: HTMLElement): boolean {
  let node = target.parentElement;
  while (node) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      const boxRect = node.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      node.scrollTop += targetRect.top - boxRect.top - (boxRect.height - targetRect.height) / 2;
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

// 按 IR → SV → WYSIWYG 优先级尝试定位；isRetry=true 时仅滚动不设选区（避免抖动）。
function tryScrollToLine(line: number, isRetry: boolean): boolean {
  if (typeof window === 'undefined') return false;

  const irRoot = document.querySelector<HTMLElement>('.vditor-ir');
  if (irRoot) {
    const blocks = Array.from(
      irRoot.querySelectorAll<HTMLElement>('.vditor-ir__node')
    );
    if (blocks.length > 0) {
      const idx = Math.max(0, Math.min(blocks.length - 1, line - 1));
      const target = blocks[idx];
      scrollWithinOwnScroller(target);
      if (!isRetry) {
        try {
          const range = document.createRange();
          range.selectNodeContents(target);
          range.collapse(true);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch {
          /* ignore */
        }
      }
      try {
        irRoot.focus();
      } catch {
        /* ignore */
      }
      return true;
    }
  }

  const svTextarea = document.querySelector<HTMLTextAreaElement>(
    '.vditor-sv__textarea'
  );
  if (svTextarea) {
    const lineCount = Math.max(1, svTextarea.value.split('\n').length);
    const lineH = svTextarea.scrollHeight / lineCount || 20;
    svTextarea.scrollTop = Math.max(0, (line - 1) * lineH);
    svTextarea.focus();
    const lines = svTextarea.value.split('\n');
    let offset = 0;
    for (let i = 0; i < Math.min(line - 1, lines.length); i++) {
      offset += lines[i].length + 1;
    }
    try {
      svTextarea.setSelectionRange(offset, offset);
    } catch {
      /* ignore */
    }
    return true;
  }

  const fallback = document.querySelector<HTMLElement>('.vditor-content');
  if (fallback) {
    scrollWithinOwnScroller(fallback);
    try {
      fallback.focus();
    } catch {
      /* ignore */
    }
    return true;
  }

  return false;
}
