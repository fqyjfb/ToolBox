import { useCallback, useRef } from 'react';
import type { SourceBlock } from '@/lib/markdown';
import { BlockMenu } from './BlockMenu';
import { convertBlockText, type ConvertKind } from './blockConvert';
import { useInlineEditable } from './useInlineEditable';

/** `- [ ]` / `- [x]` / `1. [x]` …：拆成 前缀 / 勾选标记 / 后缀 三段 */
const TASK_PREFIX = /^([ \t]*(?:[-+*]|\d+[.)])[ \t]+\[)([ xX])(\][ \t]*)/u;

export interface TaskBlockProps {
  block: SourceBlock;
  line: number;
  onEdit: (block: SourceBlock, text: string) => boolean;
  onDeleteBlock: (block: SourceBlock) => boolean;
  onSplitBlock: (block: SourceBlock, before: string, after: string) => void;
  resolveImage?: (src: string) => string | null;
  enableContextMenu?: boolean;
  onDuplicateBlock?: (block: SourceBlock) => boolean;
  onInsertBlock?: (block: SourceBlock, kind: ConvertKind, below: boolean) => boolean;
  onInsertTable?: (
    block: SourceBlock,
    rows: number,
    cols: number,
    below: boolean,
  ) => boolean;
  /** 插入分割线；`below=false` 表示替换当前空块；返回值 = patch 是否生效 */
  onInsertDivider?: (block: SourceBlock, below: boolean) => boolean;
  /** 插入会议记录模板；`below=false` 表示替换当前空块；返回值 = patch 是否生效 */
  onInsertMeetingNotes?: (block: SourceBlock, below: boolean) => boolean;
  selectionActive?: boolean;
}

/**
 * 待办块：复选框勾选即回写源文本（`- [ ]` ↔ `- [x]`）。
 *
 * 🔴 勾选只改**标记字符**，正文原样保留 —— 若把整块重写会丢失行内格式。
 */
export function TaskBlock({
  block,
  line,
  onEdit,
  onDeleteBlock,
  onSplitBlock,
  resolveImage,
  enableContextMenu,
  onDuplicateBlock,
  onInsertBlock,
  onInsertTable,
  onInsertDivider,
  onInsertMeetingNotes,
  selectionActive,
}: TaskBlockProps) {
  const blockRef = useRef<HTMLDivElement | null>(null);
  const match = TASK_PREFIX.exec(block.expectedText);
  const head = match?.[1] ?? '- [';
  const mark = match?.[2] ?? ' ';
  const tail = match?.[3] ?? '] ';
  const body = match ? block.expectedText.slice(match[0].length) : block.expectedText;
  const checked = mark.toLowerCase() === 'x';
  const prefix = `${head}${mark}${tail}`;

  const { ref, commit, handleKeyDown, handleCompositionStart, handleCompositionEnd } = useInlineEditable({
    block,
    body,
    prefix,
    onEdit,
    onSplitBlock,
    resolveImage,
  });

  const toggle = useCallback(() => {
    onEdit(block, `${head}${checked ? ' ' : 'x'}${tail}${body}`);
  }, [block, head, checked, tail, body, onEdit]);

  const handleConvert = useCallback(
    (kind: ConvertKind) => onEdit(block, convertBlockText(block.expectedText, kind)),
    [block, onEdit],
  );

  return (
    <div
      ref={blockRef}
      className="mde-block mde-block-task"
      data-source-from={block.range.from}
      data-source-to={block.range.to}
      data-source-kind={block.kind}
      data-source-line={line}
    >
      <BlockMenu
        block={block}
        anchorRef={blockRef}
        onConvert={handleConvert}
        onDelete={() => onDeleteBlock(block)}
        onDuplicate={
          onDuplicateBlock ? () => onDuplicateBlock(block) : undefined
        }
        onInsertBelow={
          onInsertBlock
            ? (kind) => onInsertBlock(block, kind, true)
            : undefined
        }
        onInsertHere={
          onInsertBlock
            ? (kind) => onInsertBlock(block, kind, false)
            : undefined
        }
        onInsertTable={
          onInsertTable
            ? (rows, cols, below) => onInsertTable(block, rows, cols, below)
            : undefined
        }
        onInsertDivider={
          onInsertDivider ? (below) => onInsertDivider(block, below) : undefined
        }
        onInsertMeetingNotes={
          onInsertMeetingNotes
            ? (below) => onInsertMeetingNotes(block, below)
            : undefined
        }
        selectionActive={selectionActive}
        enableContextMenu={enableContextMenu}
      />
      <input
        type="checkbox"
        className={checked ? 'mde-task-check is-checked' : 'mde-task-check'}
        checked={checked}
        onChange={toggle}
        aria-label={checked ? '标记为未完成' : '标记为已完成'}
      />
      <div
        ref={ref}
        className="mde-block-content"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="待办内容"
        data-block-id={block.id}
        onInput={commit}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
      />
    </div>
  );
}
