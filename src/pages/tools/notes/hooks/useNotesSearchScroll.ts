// useNotesSearchScroll —— 监听 notes:navigate-to-match 事件，跳到目标行所在块。
//
// 编辑器已换成自研块编辑器：块在 DOM 上带 `data-source-line`，
// 因此不再需要「IR → SV → WYSIWYG 三级猜测 + 800ms 周期重试」。
// React 渲染是同步的，事件到达时 DOM 已是最新，直接定位即可（无抖动）。

import { useEffect } from 'react';
import { NOTES_NAVIGATE_EVENT } from './useNotesSearch';
import type { NavigateToMatchDetail } from './useNotesSearch';

export function useNotesSearchScroll(): void {
  useEffect(() => {
    const onNavigate = (evt: Event) => {
      const ce = evt as CustomEvent<NavigateToMatchDetail>;
      const detail = ce?.detail;
      if (!detail || typeof detail.line !== 'number') return;
      tryScrollToLine(detail.line);
    };
    window.addEventListener(NOTES_NAVIGATE_EVENT, onNavigate);
    return () => {
      window.removeEventListener(NOTES_NAVIGATE_EVENT, onNavigate);
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

/** 行号落在哪一行区间，就定位到对应块：取最后一个起始行 ≤ line 的块。 */
function findBlockForLine(line: number): HTMLElement | null {
  const blocks = Array.from(
    document.querySelectorAll<HTMLElement>('[data-source-line]'),
  );
  if (blocks.length === 0) return null;
  let target: HTMLElement = blocks[0]!;
  for (const block of blocks) {
    const start = Number(block.getAttribute('data-source-line'));
    if (!Number.isFinite(start)) continue;
    if (start <= line) target = block;
    else break;
  }
  return target;
}

/** 源码模式（HTML / JSON / TXT）没有块，退化为 textarea 按行定位。 */
function scrollTextareaToLine(line: number): boolean {
  const area = document.querySelector<HTMLTextAreaElement>('.pte-area');
  if (!area) return false;
  const lines = area.value.split('\n');
  const lineHeight = area.scrollHeight / Math.max(1, lines.length) || 20;
  area.scrollTop = Math.max(0, (line - 1) * lineHeight);
  let offset = 0;
  for (let i = 0; i < Math.min(line - 1, lines.length); i += 1) {
    offset += lines[i]!.length + 1;
  }
  try {
    area.focus();
    area.setSelectionRange(offset, offset);
  } catch {
    /* ignore */
  }
  return true;
}

function tryScrollToLine(line: number): boolean {
  if (typeof window === 'undefined') return false;

  const block = findBlockForLine(line);
  if (block) {
    scrollWithinOwnScroller(block);
    try {
      const range = document.createRange();
      range.selectNodeContents(block);
      range.collapse(true);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch {
      /* ignore */
    }
    block.scrollIntoView({ block: 'nearest' });
    return true;
  }

  return scrollTextareaToLine(line);
}
