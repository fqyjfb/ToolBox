/**
 * Markdown 内核统一出口。
 *
 * 这一层是纯逻辑：块投影（块级编辑的核心算法）、
 * Markdown 渲染（markdown-it + DOMPurify）、文档事务与命令中枢。
 * 不含任何 React / UI / Electron 依赖，可独立测试。
 *
 * 调用方一律从这里导入，不要深路径引用内部文件，便于后续替换实现。
 */

// ---- 渲染 ----
export {
  configureMarkdownSanitizer,
  createInlineFootnoteContext,
  renderDocumentMarkdown,
  renderSafeInlineMarkdown,
} from "./render.ts";
export type {
  InlineFootnoteContext,
  MarkdownRenderOptions,
} from "./render.ts";
export { renderSafeMarkdown } from "./safe-markdown.ts";
export { buildExportHtml, wrapHtml } from "./export.ts";
export type { BuildExportHtmlOptions } from "./export.ts";

// ---- 块投影（块级编辑的算法核心）----
export {
  createBlockReplacementPatch,
  createConstructPatch,
  createSplitInlineBlockPatch,
  projectMarkdown,
  projectTableRows,
  resolveReadEditTarget,
  transitionProjection,
} from "./block-projection.ts";
export type {
  BlockProjection,
  ConstructTarget,
  ProjectionEvent,
  ProjectionStatus,
  ReadEditFallbackReason,
  ReadEditSelectionCandidate,
  ReadEditTarget,
  ResolvedReadEditTarget,
  SourceBlock,
  SourceBlockKind,
} from "./block-projection.ts";

// ---- 文档状态与事务 ----
export { DocumentStore } from "./store.ts";
export type {
  DocumentMutation,
  DocumentMutationBlockKind,
  DocumentSnapshot,
  ProjectionScheduler,
} from "./store.ts";
export {
  applyDocumentTransaction,
  createAssetDelta,
  createDocumentReplacement,
} from "./transactions.ts";
export type {
  DocumentTransaction,
  DocumentTransactionFailureCode,
  DocumentTransactionResult,
  DocumentTransactionState,
} from "./transactions.ts";

// ---- 源码补丁 ----
export {
  applySourcePatch,
  createSourcePatch,
  sourceDiffRange,
  sourceHash,
} from "./source-ranges.ts";
export type {
  SourceBinding,
  SourcePatch,
  SourcePatchFailureCode,
  SourcePatchResult,
  SourceRange,
} from "./source-ranges.ts";

// ---- 命令中枢 ----
export {
  commandsForSurface,
  executeAppendCommand,
  executeBlockCommand,
  executeBlockSelectionCommand,
  executeInsertAfterCommand,
  executeSlashCommand,
  getCommand,
  matchesCommandShortcut,
  resolveCommand,
  COMMAND_CATALOG,
} from "./command-registry.ts";
export type {
  CommandContext,
  CommandDefinition,
  CommandId,
  CommandMode,
  CommandScope,
  CommandShortcut,
  CommandSurface,
  ResolvedCommand,
} from "./command-registry.ts";

// ---- 命令标签（插入内容的中文占位文本）----
export { DEFAULT_COMMAND_LABELS } from "./labels.ts";
export type { CommandLabels } from "./labels.ts";

// ---- 大纲 ----
export {
  deriveOutline,
  filterOutlineTree,
  headingAnchor,
  nestOutline,
} from "./outline.ts";
export type { OutlineItem, OutlineNode } from "./outline.ts";

// ---- 表格 ----
export {
  createTableMarkdown,
  createTableStructurePatch,
  normalizeTableMarkdown,
  parseTableMarkdown,
  serializeTable,
} from "./table-commands.ts";
export type {
  TableCellPosition,
  TableDimensions,
  TableStructureCommand,
  TableStructureKind,
} from "./table-commands.ts";

// ---- 脚注 ----
export {
  createFootnoteBodyPatch,
  footnoteMeta,
  indexFootnotes,
  installFootnotes,
} from "./footnotes.ts";
export type { FootnoteDefinition, FootnoteMeta } from "./footnotes.ts";

// ---- 行内编辑辅助（contenteditable ↔ Markdown 互转）----
export {
  escapeMarkdownText,
  insertPlainTextAtSelection,
  mergeInlineTextEdit,
  plainTextFromInlineDom,
  safeLinkTarget,
  serializeInlineDom,
  splitInlineDomAtSelection,
} from "./commands.ts";

// ---- 其它 ----
export { setextHeadingLevel } from "./markdown-lines.ts";
export type { SetextHeadingLevel } from "./markdown-lines.ts";
export { markdownBodyStart } from "./frontmatter.ts";
