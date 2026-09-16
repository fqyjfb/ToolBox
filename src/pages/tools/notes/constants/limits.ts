// 记事本模块阈值常量。

// 文件树节点数超过该值时启用 react-window 虚拟化，否则走 FileTreeItem 递归渲染。
export const VIRTUALIZE_THRESHOLD = 200;

export const DRAFT_DEBOUNCE_MS = 1000;

// 搜索跳过单文件大小上限（字节）：超过则整包 readFile 会显著占用主进程内存/IO。
export const SEARCH_MAX_FILE_BYTES = 50 * 1024 * 1024;

export const SEARCH_DEFAULT_MAX_RESULTS = 50;

// 命中片段上下文长度，与主进程 notesSearchService.cjs 的 SNIPPET_CONTEXT 保持一致。
export const SEARCH_SNIPPET_CONTEXT = 60;

// useNotesSearch 的搜索防抖（ms）
export const SEARCH_DEBOUNCE_MS = 200;

// 搜索面板 UI 渲染上限（真正的 maxResults 由主进程控制，这里只是视觉上限）。
export const SEARCH_PALETTE_DISPLAY_LIMIT = 50;
