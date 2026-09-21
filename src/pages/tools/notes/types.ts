// 记事本模块共享类型（真相源）；src/hooks/useNotes.ts 继续从这里 export type 转发。

export type NotesFileType =
  | 'md' | 'txt' | 'html' | 'json' | 'docx' | 'xlsx' | 'image' | 'pdf' | 'video';

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  fileType?: NotesFileType;
  children?: FileTreeNode[];
  expanded?: boolean;
  active?: boolean;
}

export interface FileMetadata {
  filePath: string;
  fileType: NotesFileType;
  mimeType?: string;
}

export interface PinnedFolder {
  path: string;
  name: string;
}

export type NotesSearchField = 'title' | 'body';

export interface NotesSearchMatch {
  field: NotesSearchField;
  line: number;
  snippet: string;
}

export interface NotesSearchResultItem {
  path: string;
  name: string;
  fileType: NotesFileType;
  score: number;
  matches: NotesSearchMatch[];
  mtime: number;
  size: number;
  titleHits?: number;
  tagHits?: number;
  bodyHits?: number;
}

export interface NotesSearchResult {
  success: boolean;
  results: NotesSearchResultItem[];
  scanned: number;
  truncated: boolean;
  elapsedMs: number;
  error?: string;
}

export interface NotesSearchOptions {
  query: string;
  fileTypes?: NotesFileType[];
  maxResults?: number;
  caseSensitive?: boolean;
}

export interface NotesRecentItem {
  path: string;
  name: string;
  mtime: number;
  openedAt: number;
}

export type NotesFavoritePath = string;

export interface NotesOutlineItem {
  level: number;
  text: string;
  line: number;
}

export interface NotesStats {
  wordCount: number;
  readingMinutes: number;
  outline: NotesOutlineItem[];
}

// 标签页持久化快照；脏态（dirtyMap）是运行时概念，不落盘。
export interface NotesTabsSnapshot {
  tabs: string[];
  activePath: string | null;
}

// 模板来源：内置见 constants/templates.ts；用户自定义为 <userData>/notes/templates/*.md。
export interface NotesTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  content: string;
}

// 文件列表右键「发送」目标：desktop=复制一份到系统桌面；qq/wechat=写入系统剪贴板并唤起应用。
export type NotesSendTarget = 'desktop' | 'qq' | 'wechat';

// Node fs.watch 事件名白名单（非 chokidar 词汇，本项目不引入 chokidar）。
export type NotesFsChangeType = 'change' | 'rename';

// 主进程 `notes-fs-changed` 推送载荷，已在主进程清洗（防抖 + 去重），渲染层直接幂等刷新。
export interface NotesFsChangeEvent {
  type: NotesFsChangeType;
  path: string;
  rootPath: string;
  timestamp: number;
}
