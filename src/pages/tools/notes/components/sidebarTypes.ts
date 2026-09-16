// Sidebar 共享类型（抽出来让 NotesSidebar.tsx 只保留编排代码）

import type { PinnedFolder, FileTreeNode, NotesRecentItem, NotesFavoritePath } from '../types';

export interface NotesSidebarProps {
  fileTree: FileTreeNode[];
  rootPath: string | null;
  selectedFile: FileTreeNode | null;
  onSelectFile: (file: FileTreeNode) => void;
  onToggleFolder: (folderPath: string) => void;
  onCreateFolder: (parentPath: string | null, name: string) => Promise<{ success: boolean; exists?: boolean }>;
  onCreateFolderForce: (parentPath: string | null, name: string, mode: 'overwrite' | 'copy') => Promise<boolean>;
  // content? 必须保留：签名写窄 tsc 不报错，但 2 参包装会让模板内容静默丢失
  onCreateNote: (parentPath: string | null, name: string, content?: string) => Promise<{ success: boolean; exists?: boolean }>;
  onCreateNoteForce: (parentPath: string | null, name: string, mode: 'overwrite' | 'copy', content?: string) => Promise<boolean>;
  onRenameItem: (oldPath: string, newName: string) => Promise<boolean>;
  onDeleteItem: (itemPath: string) => Promise<boolean>;
  onMoveItem: (itemPath: string, targetFolderPath: string) => Promise<boolean>;
  onRefresh: () => void;
  onRebuildIndex?: () => Promise<void>;
  loading: boolean;
  isChatMode: boolean;
  onToggleChatMode: () => void;
  chatOrganizePath?: string | null;
  onSelectOrganizeFolder?: () => void;
  onCopyItem: (sourcePath: string) => Promise<boolean>;
  onImportDroppedFiles: (filePaths: string[], targetFolderPath?: string) => Promise<{ success: boolean; imported?: string[]; errors?: string[] }>;
  pinnedFolders: PinnedFolder[];
  currentViewPath: string | null;
  onAddPinnedFolder: () => Promise<boolean>;
  onRemovePinnedFolder: (folderPath: string) => void;
  onReorderPinnedFolder: (fromIndex: number, toIndex: number) => void;
  onSwitchToFolder: (folderPath: string) => Promise<void>;
  onSetChatPath: () => Promise<boolean>;
  chatPath: string | null;
  chatOrganizeTree: FileTreeNode[];
  // 最近 + 收藏：必须由 index.tsx 显式传入，不可用 spread + 类型断言（断言绕过 tsc，prop 写错会静默失效）
  recents: NotesRecentItem[];
  favorites: NotesFavoritePath[];
  onToggleFavorite: (absolutePath: NotesFavoritePath) => void;
  onRemoveRecent: (absolutePath: NotesFavoritePath) => void;
  onClearRecents: () => void;
}