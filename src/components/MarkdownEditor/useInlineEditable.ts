import { useCallback, useEffect, useRef } from 'react';
import {
  mergeInlineTextEdit,
  plainTextFromInlineDom,
  renderSafeInlineMarkdown,
  serializeInlineDom,
  splitInlineDomAtSelection,
  type SourceBlock,
} from '@/lib/markdown';

/** 空块里粘贴「整块就是一条图片语法」的 Markdown：原样写入，不做文本转义 */
const IMAGE_TOKEN_ONLY = /^!\[[^\]]*\]\([^()\s]*(?:\s+"[^"]*")?\)$/u;
const LINKED_IMAGE_ONLY = /^\[!\[[^\]]*\]\([^()\s]*\)\]\([^()\s]*\)$/u;

/** 捕获选区相对 root 的纯文本偏移（与渲染 DOM 的文本节点顺序一致，格式符变化不影响） */
function captureSelectionOffsets(
  root: HTMLElement,
): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  ) {
    return null;
  }
  const probe = range.cloneRange();
  probe.selectNodeContents(root);
  probe.setEnd(range.startContainer, range.startOffset);
  const start = probe.toString().length;
  return { start, end: start + range.toString().length };
}

/** 按纯文本偏移把选区映射回重渲染后的 DOM（越界时钳制到可用文本末尾） */
function restoreSelectionOffsets(
  root: HTMLElement,
  offsets: { start: number; end: number } | null,
): void {
  if (!offsets) return;
  const selection = window.getSelection();
  if (!selection) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let position = 0;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;
  let node = walker.nextNode();
  let lastNode: Node | null = null;
  while (node) {
    const length = (node.textContent ?? '').length;
    if (startNode === null && offsets.start <= position + length) {
      startNode = node;
      startOffset = offsets.start - position;
    }
    if (endNode === null && offsets.end <= position + length) {
      endNode = node;
      endOffset = offsets.end - position;
      break;
    }
    position += length;
    lastNode = node;
    node = walker.nextNode();
  }
  // 偏移超出新文本长度：钳制到最后一个文本节点末尾
  if (startNode === null) {
    startNode = lastNode;
    startOffset = lastNode?.textContent?.length ?? 0;
  }
  if (endNode === null) {
    endNode = startNode;
    endOffset = startOffset;
  }
  const anchorNode = startNode;
  const focusNode = endNode;
  if (anchorNode === null || focusNode === null) return;
  try {
    selection.setBaseAndExtent(anchorNode, startOffset, focusNode, endOffset);
  } catch {
    // 选区恢复失败不阻断渲染
  }
}

export interface UseInlineEditableOptions {
  block: SourceBlock;
  /** 剥离块前缀后的正文（渲染与 diff 都基于它） */
  body: string;
  /** 写回时拼回的前缀（`# ` / `> ` / `- [x] ` …） */
  prefix: string;
  onEdit: (block: SourceBlock, text: string) => void;
  onSplitBlock: (block: SourceBlock, before: string, after: string) => void;
  resolveImage?: (src: string) => string | null;
}

/**
 * 行内可编辑块的共用逻辑：渲染 → 输入 → 增量 diff → 写回源。
 *
 * `EditableBlock` 与 `TaskBlock` 共用，避免同一套提交逻辑出现两份实现（G15）。
 *
 * 提交链路有两层防护：
 * 1. IME composition 期间跳过 commit（compositionstart/end 守卫）
 * 2. mergeInlineTextEdit 返回 null 时，serializeInlineDom 全量序列化兜底
 *    —— 永远不静默放弃写回，确保 DOM 和 Markdown 源始终一致
 */
export function useInlineEditable({
  block,
  body,
  prefix,
  onEdit,
  onSplitBlock,
  resolveImage,
}: UseInlineEditableOptions) {
  const ref = useRef<HTMLDivElement | null>(null);
  // 上次提交时的纯文本，用于增量 diff
  const plainRef = useRef<string>('');
  // IME 组合期守卫：compositionstart 时 true，end 时 false
  // 期间浏览器会插入临时字符（如拼音候选），不能据此做 diff 写回
  const composingRef = useRef(false);
  // 自我编辑标记：commit 触发的 body 回流不需要重置 DOM（避免输入时光标跳动）；
  // 而撤销/重做/行内格式等「非自我」变更即使聚焦中也必须重渲染，否则 DOM 与源脱节
  const selfEditRef = useRef(false);

  // DOM 重置策略：自我输入跳过（防光标跳动）；非自我变更聚焦中也重渲染并保留选区
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = renderSafeInlineMarkdown(
      body,
      resolveImage ? { resolveImage } : {},
    );
    if (document.activeElement === el) {
      if (selfEditRef.current) {
        selfEditRef.current = false;
        return;
      }
      if (el.innerHTML === html) return;
      const offsets = captureSelectionOffsets(el);
      el.innerHTML = html;
      restoreSelectionOffsets(el, offsets);
      plainRef.current = plainTextFromInlineDom(el);
      return;
    }
    selfEditRef.current = false;
    if (el.innerHTML !== html) el.innerHTML = html;
    plainRef.current = plainTextFromInlineDom(el);
  }, [body, block.id, resolveImage]);

  const commit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // IME 组合期守卫：等 compositionend 再触发一次 commit
    if (composingRef.current) return;
    const after = plainTextFromInlineDom(el);
    const before = plainRef.current;
    if (after === before) return;

    // 空块整块粘贴图片语法：内容本身就是 Markdown 源码，原样写入（否则方括号会被转义成字面量）
    if (before === '' && (IMAGE_TOKEN_ONLY.test(after) || LINKED_IMAGE_ONLY.test(after))) {
      plainRef.current = after;
      selfEditRef.current = true;
      onEdit(block, `${prefix}${after}`);
      return;
    }

    let next = mergeInlineTextEdit(body, before, after);

    // mergeInlineTextEdit 返回 null 说明 diff 无法精确定位（removed 被 Markdown 格式吞掉、
    // 或 Markdown 源码与纯文本差异太大）——兜底：全量序列化 after DOM
    if (next === null) {
      next = serializeInlineDom(el);
    }

    plainRef.current = after;
    selfEditRef.current = true;
    onEdit(block, `${prefix}${next}`);
  }, [block, body, prefix, onEdit]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // IME composition 中 Enter 是候选上屏，不拦截也不处理
      if (composingRef.current) return;

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const el = ref.current;
        if (!el) {
          onSplitBlock(block, block.expectedText, '');
          return;
        }
        const parts = splitInlineDomAtSelection(el);
        if (parts) {
          // 手动截断当前块 DOM 到 before 部分，避免 projection 重建后残留 after
          // 这里 parts.before 是 Markdown 序列化后的内容，用 renderSafeInlineMarkdown 正确反渲染
          // 聚焦保护（useEffect 里的 `if (document.activeElement === el) return`）会阻止 React 重置，
          // 所以我们必须在触发 onSplitBlock 前手动改 DOM
          const renderedBefore = renderSafeInlineMarkdown(
            parts.before,
            resolveImage ? { resolveImage } : {},
          );
          if (el.innerHTML !== renderedBefore) {
            el.innerHTML = renderedBefore;
            plainRef.current = plainTextFromInlineDom(el);
          }
          onSplitBlock(block, `${prefix}${parts.before}`, parts.after);
        } else {
          onSplitBlock(block, block.expectedText, '');
        }
        return;
      }

      // Shift+Enter：块内换行（不拆块）。显式在 Selection 处插入 <br>，
      // 绕开浏览器对 contentEditable 默认换行行为的差异（Chrome 可能拆成新 <div>）。
      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const br = document.createElement('br');
        range.insertNode(br);
        // 把光标移到 <br> 后，Chrome 要求在 <br> 后补一个零宽空格才能稳定聚焦
        const after = document.createTextNode('\u200b');
        br.parentNode?.insertBefore(after, br.nextSibling);
        range.setStartAfter(after);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        // DOM 已变 → 让 React 感知并写回 Markdown 源（\n 会在 commit 里 serialize 成换行）
        commit();
        return;
      }

      if (event.key === 'Escape') {
        (event.target as HTMLElement).blur();
      }
    },
    [block, prefix, onSplitBlock, resolveImage, commit],
  );

  // IME composition 守卫：compositionstart → true，end → false 并触发一次 commit
  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);
  const handleCompositionEnd = useCallback(() => {
    composingRef.current = false;
    // compositionend 后必须立即 flush，否则拼音候选字符会留在 DOM 但不写回源
    commit();
  }, [commit]);

  return { ref, commit, handleKeyDown, handleCompositionStart, handleCompositionEnd };
}
