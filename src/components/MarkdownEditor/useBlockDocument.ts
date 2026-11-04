import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  DocumentStore,
  createSourcePatch,
  type DocumentSnapshot,
  type SourceBlock,
  type SourceRange,
} from '@/lib/markdown';

export interface BlockDocument {
  store: DocumentStore;
  snapshot: DocumentSnapshot;
  /** 把块内容写回源。返回是否成功（失败通常是 revision/hash 过期，调用方应放弃本次编辑）。 */
  editBlock: (
    block: SourceBlock,
    nextText: string,
    operation: string,
    range?: SourceRange,
  ) => boolean;
  /** 在**指定块之后**插入一段 Markdown（新块） */
  insertBlockAfter: (block: SourceBlock, markdown: string) => boolean;
  /** 用**块级** Markdown（表格 / 分割线 / 模板）替换指定块，自动保证前后有空行分隔 */
  replaceBlockWithMarkdown: (block: SourceBlock, markdown: string) => boolean;
  /** 在文档末尾追加一段 Markdown */
  appendMarkdown: (markdown: string) => boolean;
  undo: () => void;
  redo: () => void;
}

/**
 * 把 `DocumentStore`（纯外部状态源）接到 React。
 *
 * - 用 `useSyncExternalStore` 订阅，避免自己维护 state 副本。
 * - store **只创建一次**；切换文档靠「外部 source 与 store 内 source 不一致」触发 `loadSource`，
 *   这样既能响应切换文件，又不会把用户当前的编辑误判成外部变更而清空撤销栈。
 */
export function useBlockDocument(source: string): BlockDocument {
  const storeRef = useRef<DocumentStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = new DocumentStore(source);
  }
  const store = storeRef.current;

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    // 用户自身编辑引起的 source 回流：与 store 内一致，跳过（否则会清掉撤销栈）
    if (source === store.getSnapshot().source) return;
    store.loadSource(source, store.getSnapshot().revision + 1);
  }, [source, store]);

  const editBlock = useCallback(
    (block: SourceBlock, nextText: string, operation: string, range?: SourceRange) => {
      try {
        const patch = createSourcePatch(
          block,
          nextText,
          operation,
          range ?? block.range,
        );
        return store.applyPatch(patch).ok;
      } catch {
        // range 越界等：放弃本次编辑，不让异常冒泡到 React
        return false;
      }
    },
    [store],
  );

  const appendMarkdown = useCallback(
    (markdown: string) => store.appendMarkdown(markdown).ok,
    [store],
  );

  /**
   * 在指定块之后插入一段 Markdown（新块）。
   *
   * 语义：
   * - 不覆盖原块内容，而是在 `block.range.to` 处做**空插入**；
   * - 原块末尾已有 `\n` → 补 1 个；否则补 2 个 `\n`（保证两个独立块之间有空行）；
   * - 新块内容强制以 `\n` 结尾，后续 projection 才能正确切分。
   */
  const insertBlockAfter = useCallback(
    (block: SourceBlock, markdown: string) => {
      try {
        const trimmed = markdown.replace(/^\n+/u, '').replace(/\n+$/u, '');
        const before = block.expectedText.endsWith('\n') ? '\n' : '\n\n';
        const after = trimmed.endsWith('\n') ? '' : '\n';
        const patch = createSourcePatch(
          block,
          `${before}${trimmed}${after}`,
          'insert-block-after',
          { from: block.range.to, to: block.range.to },
        );
        return store.applyPatch(patch).ok;
      } catch {
        return false;
      }
    },
    [store],
  );

  /**
   * 用**块级** Markdown 替换指定块（空块替换语义）。
   *
   * 空块本身只占一个换行符，直接把多行 Markdown 写进去会与相邻块黏连：
   * 表格会被当成上一段/下一段的续行、`---` 会把上一段变成 setext 标题。
   * 因此这里统一补边界空行：有前文 → 前置 1 个 `\n`；有后文 → 后置 1 个额外 `\n`。
   */
  const replaceBlockWithMarkdown = useCallback(
    (block: SourceBlock, markdown: string) => {
      try {
        const content = markdown.replace(/^\n+/u, '').replace(/\n+$/u, '');
        if (!content) return false;
        const source = store.getSnapshot().source;
        const before = block.range.from > 0 ? '\n' : '';
        const after = block.range.to < source.length ? '\n\n' : '\n';
        const patch = createSourcePatch(
          block,
          `${before}${content}${after}`,
          'replace-block-markdown',
        );
        return store.applyPatch(patch).ok;
      } catch {
        return false;
      }
    },
    [store],
  );

  const undo = useCallback(() => {
    store.undo();
  }, [store]);

  const redo = useCallback(() => {
    store.redo();
  }, [store]);

  return {
    store,
    snapshot,
    editBlock,
    insertBlockAfter,
    replaceBlockWithMarkdown,
    appendMarkdown,
    undo,
    redo,
  };
}
