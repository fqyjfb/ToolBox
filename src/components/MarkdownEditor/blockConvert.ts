/**
 * 块类型转换：Markdown 文本层面的前缀改写。
 *
 * 单独成文件，避免与组件同文件导出非组件内容而触发
 * `react-refresh/only-export-components`（会影响 HMR）。
 */

import type { LucideIcon } from 'lucide-react';
import {
  AlignLeft,
  CheckSquare,
  Code,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  Quote,
} from 'lucide-react';
import type { SourceBlock } from '@/lib/markdown';

export type ConvertKind =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'bullet'
  | 'ordered'
  | 'task'
  | 'quote'
  | 'code';

/** 6 列网格，顺序对齐主方案 §1.5：段落 H1..H5 / H6 无序 有序 待办 引用 代码 */
export const TYPE_ITEMS: ReadonlyArray<{ kind: ConvertKind; label: string }> = [
  { kind: 'paragraph', label: '段落' },
  { kind: 'h1', label: 'H1' },
  { kind: 'h2', label: 'H2' },
  { kind: 'h3', label: 'H3' },
  { kind: 'h4', label: 'H4' },
  { kind: 'h5', label: 'H5' },
  { kind: 'h6', label: 'H6' },
  { kind: 'bullet', label: '无序' },
  { kind: 'ordered', label: '有序' },
  { kind: 'task', label: '待办' },
  { kind: 'quote', label: '引用' },
  { kind: 'code', label: '代码' },
];

/** 块类型图标 */
const TYPE_ICON: Record<ConvertKind, LucideIcon> = {
  paragraph: FileText,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  h4: Heading4,
  h5: Heading5,
  h6: Heading6,
  bullet: List,
  ordered: ListOrdered,
  task: CheckSquare,
  quote: Quote,
  code: Code,
};

/** 返回块类型对应的 lucide 图标 */
export function typeIcon(kind: ConvertKind): LucideIcon {
  return TYPE_ICON[kind] ?? AlignLeft;
}

/**
 * 块的稳定身份：**刻意不含 range.to**。
 *
 * 块 id（`block-projection.ts`）含 `to`，输入一个字符 `to` 就变、React key 就变、
 * 组件就重建、contenteditable 就被替换 → 失焦。编辑当前块时 `range.from` 不变
 * （前面内容没动），故 `from + kind` 足以稳定标识，且不会与相邻块冲突。
 *
 * 只用于 React key；`block.id` 仍保留原语义，用于 DOM data-block-id、Map 索引等。
 */
export function blockStableKey(block: SourceBlock): string {
  return `${block.range.from}:${block.kind}`;
}

/** gutter 按钮上显示的类型 token（对齐验收 9.2 第 2 条） */
const KIND_TOKEN: Record<string, string> = {
  blank: '空',
  'code-fence': '代码',
  footnote: '脚注',
  frontmatter: '元数据',
  'list-item': '列表',
  paragraph: '段落',
  quote: '引用',
  table: '表格',
  task: '待办',
  'thematic-break': '分割线',
};

/** 当前块类型 token；标题带级别（`H1`…`H6`） */
export function blockToken(block: SourceBlock): string {
  if (block.kind === 'heading') {
    const match = /^ {0,3}(#{1,6})/u.exec(block.expectedText);
    return `H${match?.[1]?.length ?? 1}`;
  }
  return KIND_TOKEN[block.kind] ?? '段落';
}

/**
 * 当前块对应的 `ConvertKind`；表格不属于可转换类型（类型网格中无「表格」项），
 * 返回 `null` 让菜单不把表格错标成「段落」。
 */
export function currentConvertKind(block: SourceBlock): ConvertKind | null {
  if (block.kind === 'heading') {
    const match = /^ {0,3}(#{1,6})/u.exec(block.expectedText);
    return `h${match?.[1]?.length ?? 1}` as ConvertKind;
  }
  switch (block.kind) {
    case 'task':
      return 'task';
    case 'quote':
      return 'quote';
    case 'code-fence':
      return 'code';
    case 'list-item':
      return /^ {0,3}\d+[.)]/u.test(block.expectedText) ? 'ordered' : 'bullet';
    case 'table':
      return null;
    default:
      return 'paragraph';
  }
}

const FENCE_OPEN_LINE = /^[ \t]{0,3}(?:`{3,}|~{3,})/u;
const FENCE_CLOSE_LINE = /^[ \t]{0,3}(?:`{3,}|~{3,})[ \t]*$/u;

/**
 * 把块的首行前缀换成目标类型。
 * 只处理首行——多行块的续行原样保留，避免破坏列表缩进等既有结构。
 *
 * 代码围栏块先剥掉首尾围栏行再转换（否则前缀会加到 ``` 行上）；
 * 围栏块转「代码」时原样返回，避免产生双重围栏。
 */
export function convertBlockText(expectedText: string, kind: ConvertKind): string {
  let source = expectedText;
  const probe = source.split('\n');
  if (FENCE_OPEN_LINE.test(probe[0] ?? '')) {
    if (kind === 'code') return expectedText;
    const body = probe.slice(1);
    const last = body.length - 1;
    if (last >= 0 && FENCE_CLOSE_LINE.test(body[last] ?? '')) body.pop();
    source = body.join('\n');
  }
  const lines = source.split('\n');
  const first = lines[0] ?? '';
  const rest = lines.slice(1);
  const stripped = first
    .replace(/^#{1,6}\s+/u, '')
    .replace(/^>\s?/u, '')
    .replace(/^[-*+]\s+\[[ xX]\]\s+/u, '')
    .replace(/^[-*+]\s+/u, '')
    .replace(/^\d+\.\s+/u, '');

  let head: string;
  switch (kind) {
    case 'paragraph':
      head = stripped;
      break;
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      head = `${'#'.repeat(Number(kind.slice(1)))} ${stripped}`;
      break;
    case 'bullet':
      head = `- ${stripped}`;
      break;
    case 'ordered':
      head = `1. ${stripped}`;
      break;
    case 'task':
      head = `- [ ] ${stripped}`;
      break;
    case 'quote':
      head = `> ${stripped}`;
      break;
    case 'code':
      // 代码围栏会改变块边界，这里产出完整围栏文本交由上层替换
      return ['```', stripped, ...rest, '```'].join('\n');
  }
  return [head, ...rest].join('\n');
}
