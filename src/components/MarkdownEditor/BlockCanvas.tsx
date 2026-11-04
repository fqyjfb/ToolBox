import { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Trash2 } from 'lucide-react';
import {
  createConstructPatch,
  createTableStructurePatch,
  normalizeTableMarkdown,
  parseTableMarkdown,
  type SourceBlock,
  type TableStructureKind,
} from '@/lib/markdown';
import { CodeFenceBlock } from './CodeFenceBlock';
import { TaskBlock } from './TaskBlock';
import { SourceSafeBlock } from './SourceSafeBlock';
import { BlockMenu } from './BlockMenu';
import { MarkdownView } from '../MarkdownView';
import {
  blockStableKey,
  convertBlockText,
  type ConvertKind,
} from './blockConvert';
import { useInlineEditable } from './useInlineEditable';
import './MarkdownEditor.css';

/** 块级 Markdown 的前缀（标题 # / 引用 > / 列表 - / 有序 1. / 待办 - [ ]） */
const BLOCK_PREFIX = /^(?:#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+)/u;
const FENCE_START = /^[ \t]{0,3}(?:`{3,}|~{3,})/u;

function splitPrefix(text: string): { body: string; prefix: string } {
  const match = BLOCK_PREFIX.exec(text);
  if (!match) return { prefix: '', body: text };
  return { prefix: match[0], body: text.slice(match[0].length) };
}

/**
 * 块只有字符偏移（`range.from`），而搜索跳转给的是**行号**，
 * 这里把偏移换算成行号写进 DOM（`data-source-line`），供 `useNotesSearchScroll` 定位。
 * 单趟扫描、cursor 只前进，复杂度 O(len(source))。
 */
function computeBlockLines(
  source: string,
  blocks: readonly SourceBlock[],
): Map<string, number> {
  const lines = new Map<string, number>();
  const ordered = [...blocks].sort((a, b) => a.range.from - b.range.from);
  let line = 1;
  let cursor = 0;
  for (const block of ordered) {
    const from = Math.max(0, Math.min(block.range.from, source.length));
    while (cursor < from) {
      if (source[cursor] === '\n') line += 1;
      cursor += 1;
    }
    lines.set(block.id, line);
  }
  return lines;
}

export interface BlockCanvasProps {
  /** 完整源码，用于把字符偏移换算成行号 */
  source: string;
  blocks: readonly SourceBlock[];
  onEdit: (block: SourceBlock, text: string) => boolean;
  onDeleteBlock: (block: SourceBlock) => boolean;
  /** 回车拆分：before 留在当前块，after 成为新块 */
  onSplitBlock: (block: SourceBlock, before: string, after: string) => void;
  /** 行内图片解析（统一走 `resolveAssetUrl`，禁止第二份实现） */
  resolveImage?: (src: string) => string | null;
  /** 右键打开块菜单，默认 true */
  enableContextMenu?: boolean;
  /** 创建块副本 */
  onDuplicateBlock?: (block: SourceBlock) => boolean;
  /** 插入新块；`below=false` 表示替换当前空块。返回值 = patch 是否生效 */
  onInsertBlock?: (block: SourceBlock, kind: ConvertKind, below: boolean) => boolean;
  /** 插入表格；`below=false` 表示替换当前空块。返回值 = patch 是否生效 */
  onInsertTable?: (
    block: SourceBlock,
    rows: number,
    cols: number,
    below: boolean,
  ) => boolean;
  /** 插入分割线；`below=false` 表示替换当前空块。返回值 = patch 是否生效 */
  onInsertDivider?: (block: SourceBlock, below: boolean) => boolean;
  /** 插入会议记录模板；`below=false` 表示替换当前空块。返回值 = patch 是否生效 */
  onInsertMeetingNotes?: (block: SourceBlock, below: boolean) => boolean;
  /** 选区工具条可见时为 true；canvas 通过 data 属性隐藏 gutter */
  selectionActive?: boolean;
}

/**
 * 表格块交互：
 *   - 表格始终处于可编辑态：每个单元格是 `<textarea>`（表头行是 `<th>`）
 *   - 单击单元格即可直接输入编辑（`defaultValue` + 失焦才写回，避免打断输入）
 *   - 单元格获得焦点 → 表格右上角浮出行列结构工具条
 *   - 结构命令复用 `createTableStructurePatch`，单元格编辑复用 `createConstructPatch`
 *     （只改目标单元格的源区间，保留其余列宽/分隔符原样）
 */
const TABLE_STRUCTURE_ACTIONS: ReadonlyArray<{
  destructive?: boolean;
  kind: TableStructureKind;
  label: string;
}> = [
  { kind: 'insert-row-above', label: '上方插入行' },
  { kind: 'insert-row-below', label: '下方插入行' },
  { kind: 'insert-column-left', label: '左侧插入列' },
  { kind: 'insert-column-right', label: '右侧插入列' },
  { kind: 'delete-row', label: '删除行', destructive: true },
  { kind: 'delete-column', label: '删除列', destructive: true },
];

function TableStructureIcon({ kind }: { kind: TableStructureKind }) {
  if (kind === 'insert-row-above') return <ArrowUp size={16} aria-hidden />;
  if (kind === 'insert-row-below') return <ArrowDown size={16} aria-hidden />;
  if (kind === 'insert-column-left') return <ArrowLeft size={16} aria-hidden />;
  if (kind === 'insert-column-right') return <ArrowRight size={16} aria-hidden />;
  return <Trash2 size={16} aria-hidden />;
}

/** 定位表格单元格 textarea（行列索引与解析结果一致，表头为第 0 行） */
function tableCellSelector(row: number, column: number): string {
  return `[data-table-row="${row}"][data-table-column="${column}"]`;
}

function TableBlock({
  block,
  line,
  onEdit,
  onDeleteBlock,
  resolveImage,
  enableContextMenu,
  onDuplicateBlock,
  onInsertBlock,
  onInsertTable,
  onInsertDivider,
  onInsertMeetingNotes,
  selectionActive,
}: {
  block: SourceBlock;
  line: number;
  onEdit: BlockCanvasProps['onEdit'];
  onDeleteBlock: BlockCanvasProps['onDeleteBlock'];
  resolveImage?: BlockCanvasProps['resolveImage'];
  enableContextMenu?: boolean;
  onDuplicateBlock?: BlockCanvasProps['onDuplicateBlock'];
  onInsertBlock?: BlockCanvasProps['onInsertBlock'];
  onInsertTable?: BlockCanvasProps['onInsertTable'];
  onInsertDivider?: BlockCanvasProps['onInsertDivider'];
  onInsertMeetingNotes?: BlockCanvasProps['onInsertMeetingNotes'];
  selectionActive?: boolean;
}) {
  const blockRef = useRef<HTMLDivElement | null>(null);
  // 当前聚焦的单元格；非空时显示行列结构工具条
  const [activeCell, setActiveCell] = useState<{
    row: number;
    column: number;
  } | null>(null);
  // 先 normalize 再解析：脏格式（缺首尾管道/列数不齐）也能渲染出对齐的表格
  const parsed = useMemo(
    () => parseTableMarkdown(normalizeTableMarkdown(block.expectedText)),
    [block.expectedText],
  );

  const handleConvert = useCallback(
    (kind: ConvertKind) => onEdit(block, convertBlockText(block.expectedText, kind)),
    [block, onEdit],
  );

  /** textarea 高度跟随内容，长单元格自然换行，不出现纵向滚动条 */
  const autoSize = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  const focusCell = useCallback((row: number, column: number) => {
    // 双 rAF：结构命令会让整块 id 变化、<tr> 重挂载，等 React 提交后再聚焦
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        blockRef.current
          ?.querySelector<HTMLTextAreaElement>(tableCellSelector(row, column))
          ?.focus();
      });
    });
  }, []);

  /** 单元格失焦：只替换该单元格的源区间，表格其余列宽/分隔符保持原样 */
  const commitCell = useCallback(
    (row: number, column: number, value: string) => {
      try {
        const patch = createConstructPatch(
          block,
          { kind: 'table-cell', row, column },
          value,
        );
        const from = patch.range.from - block.range.from;
        const to = patch.range.to - block.range.from;
        const next =
          block.expectedText.slice(0, from) +
          patch.insert +
          block.expectedText.slice(to);
        if (next !== block.expectedText) onEdit(block, next);
      } catch {
        // 极端脏格式定位不到单元格区间：静默跳过，绝不覆盖整块内容
      }
    },
    [block, onEdit],
  );

  /** 行列结构命令：复用 createTableStructurePatch，并把当前单元格未提交的输入一并带入 */
  const runStructureCommand = useCallback(
    (kind: TableStructureKind) => {
      if (!activeCell) return;
      const textarea = blockRef.current?.querySelector<HTMLTextAreaElement>(
        tableCellSelector(activeCell.row, activeCell.column),
      );
      try {
        const patch = createTableStructurePatch(block, {
          activeCell: textarea
            ? { ...activeCell, value: textarea.value }
            : activeCell,
          kind,
        });
        if (!patch) return;
        onEdit(block, patch.insert);
      } catch {
        return;
      }
      // 结构变换后焦点落到对应的新单元格，工具条保持可见
      const rowCount = parsed?.rows.length ?? 1;
      const columnCount = parsed?.rows[0]?.length ?? 1;
      const next = { ...activeCell };
      if (kind === 'insert-row-below') next.row += 1;
      if (kind === 'insert-column-right') next.column += 1;
      if (kind === 'delete-row') {
        next.row = Math.max(0, Math.min(next.row, rowCount - 2));
      }
      if (kind === 'delete-column') {
        next.column = Math.max(0, Math.min(next.column, columnCount - 2));
      }
      setActiveCell(next);
      focusCell(next.row, next.column);
    },
    [activeCell, block, onEdit, parsed, focusCell],
  );

  return (
    <div
      ref={blockRef}
      className="mde-block mde-block-table"
      data-source-from={block.range.from}
      data-source-to={block.range.to}
      data-source-kind={block.kind}
      data-source-line={line}
      onBlurCapture={(event) => {
        // 焦点离开整个表格才收起工具条（点工具条按钮已 preventDefault，不会触发这里）
        const next = event.relatedTarget as Node | null;
        if (!next || !event.currentTarget.contains(next)) setActiveCell(null);
      }}
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
      {activeCell && parsed ? (
        <div className="mde-table-structure-toolbar" role="toolbar">
          {TABLE_STRUCTURE_ACTIONS.map(({ kind, label, destructive }) => {
            const lastRow = kind === 'delete-row' && parsed.rows.length <= 1;
            const lastColumn =
              kind === 'delete-column' && (parsed.rows[0]?.length ?? 0) <= 1;
            return (
              <button
                key={kind}
                type="button"
                className={
                  destructive
                    ? 'mde-table-structure-btn is-destructive'
                    : 'mde-table-structure-btn'
                }
                title={label}
                aria-label={label}
                disabled={lastRow || lastColumn}
                // 阻止按钮抢走单元格焦点：失焦会提前写回并收起工具条
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runStructureCommand(kind)}
              >
                <TableStructureIcon kind={kind} />
                {destructive ? (
                  <span className="mde-table-structure-hint">
                    {kind === 'delete-row' ? '行' : '列'}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {parsed ? (
        <div className="mde-table-shell">
          <table>
            <tbody>
              {parsed.rows.map((row, rowIndex) => (
                <tr key={`${block.id}:${rowIndex}`}>
                  {row.map((cell, columnIndex) => {
                    const textarea = (
                      <textarea
                        rows={1}
                        defaultValue={cell}
                        data-table-row={rowIndex}
                        data-table-column={columnIndex}
                        ref={autoSize}
                        onInput={(event) => autoSize(event.currentTarget)}
                        onFocus={() =>
                          setActiveCell({ row: rowIndex, column: columnIndex })
                        }
                        onBlur={(event) => {
                          if (event.currentTarget.value !== cell) {
                            commitCell(
                              rowIndex,
                              columnIndex,
                              event.currentTarget.value,
                            );
                          }
                        }}
                      />
                    );
                    const key = `${block.id}:${rowIndex}:${columnIndex}`;
                    return rowIndex === 0 ? (
                      <th key={key}>{textarea}</th>
                    ) : (
                      <td key={key}>{textarea}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // 无法解析成表格的极端脏格式：降级只读渲染，保证内容不丢失
        <div className="mde-block-table-preview">
          <MarkdownView source={block.expectedText} resolveImage={resolveImage} />
        </div>
      )}
    </div>
  );
}

function EditableBlock({
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
}: {
  block: SourceBlock;
  line: number;
  onEdit: BlockCanvasProps['onEdit'];
  onDeleteBlock: BlockCanvasProps['onDeleteBlock'];
  onSplitBlock: BlockCanvasProps['onSplitBlock'];
  resolveImage?: BlockCanvasProps['resolveImage'];
  enableContextMenu?: boolean;
  onDuplicateBlock?: BlockCanvasProps['onDuplicateBlock'];
  onInsertBlock?: BlockCanvasProps['onInsertBlock'];
  onInsertTable?: BlockCanvasProps['onInsertTable'];
  onInsertDivider?: BlockCanvasProps['onInsertDivider'];
  onInsertMeetingNotes?: BlockCanvasProps['onInsertMeetingNotes'];
  selectionActive?: boolean;
}) {
  // 块根元素 ref：用于 gutter portal 定位 + 右键监听
  const blockRef = useRef<HTMLDivElement | null>(null);
  const { prefix, body } = splitPrefix(block.expectedText);
  const { ref, commit, handleKeyDown, handleCompositionStart, handleCompositionEnd } = useInlineEditable({
    block,
    body,
    prefix,
    onEdit,
    onSplitBlock,
    resolveImage,
  });

  const handleConvert = useCallback(
    (kind: ConvertKind) => onEdit(block, convertBlockText(block.expectedText, kind)),
    [block, onEdit],
  );

  return (
    <div
      ref={blockRef}
      className={`mde-block mde-block-${block.kind}`}
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
      {block.kind === 'thematic-break' ? (
        // 分割线：编辑态直接显示横线。
        // 源码仍是 `---`，只是不把源码字符渲染成可编辑文本 —— 否则编辑态是一行破折号，
        // 与阅读模式的横线割裂，还容易误删误改。删除 / 移动走块菜单（gutter）。
        <hr className="mde-block-divider" aria-label="分割线" />
      ) : (
        <div
          ref={ref}
          className="mde-block-content"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={`${block.kind} 块`}
          data-block-id={block.id}
          onInput={commit}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
        />
      )}
    </div>
  );
}

/**
 * 块画布：把 `BlockProjection.blocks` 渲染成可编辑的块序列。
 *
 * - `code-fence` / 围栏文本 → `CodeFenceBlock`（只读 + 语言标签 + 复制）
 * - `task` → `TaskBlock`（勾选回写 `- [x]`）
 * - 不可编辑块 → `SourceSafeBlock`（源码安全降级；mermaid / math 也走这里）
 * - 其余 → `EditableBlock`（行内可编辑）
 *
 * 每块都写出 `data-source-from/to/kind`（硬约束 C2），阶段 4 的搜索定位依赖它们。
 */
export function BlockCanvas({
  source,
  blocks,
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
}: BlockCanvasProps) {
  const lines = useMemo(() => computeBlockLines(source, blocks), [source, blocks]);

  // 脏格式表格兜底：projection 可能把缺首尾管道/列数不齐的表格判成 paragraph。
  // 只在 render 阶段做一次 normalize+parse 检测，若确认是表格则强制用 TableBlock 渲染
  // （让 gutter token 显示 T），同时返回 normalized 让外部用 useEffect 写回源。
  // 已处理过的 block id 存在 ref 里，保证 normalize 写回只发生一次。
  const normalizedRef = useRef<Set<string>>(new Set());
  const normalizeOnce = useCallback(
    (block: SourceBlock): { normalized?: string; isTable: boolean } => {
      if (block.kind === 'table') return { isTable: true };
      if (block.kind !== 'paragraph') return { isTable: false };
      // 快速过滤：不含 | 或不含疑似分隔符 → 绝不是表格
      const text = block.expectedText;
      if (!text.includes('|')) return { isTable: false };
      if (!/^\s*\|?\s*-{3,}/m.test(text)) return { isTable: false };
      const normalized = normalizeTableMarkdown(text);
      const parsed = parseTableMarkdown(normalized);
      if (!parsed || parsed.rows.length < 2) return { isTable: false };
      // normalized !== original 才需要写回；已写回过的 block id 不再重复触发
      const alreadyNormalized = normalizedRef.current.has(block.id);
      if (!alreadyNormalized && normalized !== text) {
        normalizedRef.current.add(block.id);
        return { normalized, isTable: true };
      }
      return { isTable: true };
    },
    [],
  );

  return (
    <div className="mde-canvas">
      {blocks.map((block) => {
        const line = lines.get(block.id) ?? 1;
        const isFence =
          block.kind === 'code-fence' || FENCE_START.test(block.expectedText);
        // mermaid / math 虽是围栏语法，但本方案不渲染，走源码安全降级
        const isSpecialFence = block.kind === 'mermaid' || block.kind === 'math';

        const { normalized, isTable } = normalizeOnce(block);

        // 有 normalized 待写回 → 用一次 effect 触发 onEdit（幂等：normalizedRef 防重复）
        if (normalized) {
          // 同步写回（onEdit 是 setState 级操作，主进程不阻塞），让 projection 下次正确判 kind
          queueMicrotask(() => onEdit(block, normalized));
        }

        if (isTable) {
          const tableBlock: SourceBlock =
            block.kind === 'table' ? block : { ...block, kind: 'table' };
          return (
            <TableBlock
              key={blockStableKey(block)}
              block={tableBlock}
              line={line}
              onEdit={onEdit}
              onDeleteBlock={onDeleteBlock}
              resolveImage={resolveImage}
              enableContextMenu={enableContextMenu}
              onDuplicateBlock={onDuplicateBlock}
              onInsertBlock={onInsertBlock}
              onInsertTable={onInsertTable}
              onInsertDivider={onInsertDivider}
              onInsertMeetingNotes={onInsertMeetingNotes}
              selectionActive={selectionActive}
            />
          );
        }

        if (isFence && !isSpecialFence) {
          return (
            <CodeFenceBlock
              key={blockStableKey(block)}
              block={block}
              line={line}
              onEdit={onEdit}
              onDeleteBlock={onDeleteBlock}
              onDuplicateBlock={onDuplicateBlock}
              onInsertBlock={onInsertBlock}
              onInsertTable={onInsertTable}
              onInsertDivider={onInsertDivider}
              onInsertMeetingNotes={onInsertMeetingNotes}
              enableContextMenu={enableContextMenu}
              selectionActive={selectionActive}
            />
          );
        }
        if (!block.editable) {
          return (
            <SourceSafeBlock
              key={blockStableKey(block)}
              block={block}
              line={line}
            />
          );
        }
        if (block.kind === 'task') {
          return (
            <TaskBlock
              key={blockStableKey(block)}
              block={block}
              line={line}
              onEdit={onEdit}
              onDeleteBlock={onDeleteBlock}
              onSplitBlock={onSplitBlock}
              resolveImage={resolveImage}
              enableContextMenu={enableContextMenu}
              onDuplicateBlock={onDuplicateBlock}
              onInsertBlock={onInsertBlock}
              onInsertTable={onInsertTable}
              onInsertDivider={onInsertDivider}
              onInsertMeetingNotes={onInsertMeetingNotes}
              selectionActive={selectionActive}
            />
          );
        }
        return (
          <EditableBlock
            key={blockStableKey(block)}
            block={block}
            line={line}
            onEdit={onEdit}
            onDeleteBlock={onDeleteBlock}
            onSplitBlock={onSplitBlock}
            resolveImage={resolveImage}
            enableContextMenu={enableContextMenu}
            onDuplicateBlock={onDuplicateBlock}
            onInsertBlock={onInsertBlock}
            onInsertTable={onInsertTable}
            onInsertDivider={onInsertDivider}
            onInsertMeetingNotes={onInsertMeetingNotes}
            selectionActive={selectionActive}
          />
        );
      })}
    </div>
  );
}

export default BlockCanvas;
