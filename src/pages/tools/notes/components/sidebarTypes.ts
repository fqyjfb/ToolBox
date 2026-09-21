// Sidebar 共享类型（抽出来让 NotesSidebar.tsx 只保留编排代码）

import type { PinnedFolder, FileTreeNode, NotesRecentItem, NotesFavoritePath, NotesSendTarget } from '../types';

// 右键菜单的触发区域：对话整理区只保留「打开位置 / 删除」，固定目录与文件列表区保持完整菜单
export type SidebarContextMenuArea = 'chat' | 'files';

export interface NotesSidebarProps {
  fileTree: FileTreeNode[];
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
  /** 移入系统回收站（可恢复），删除的替代路径 */
  onTrashItem: (itemPath: string) => Promise<boolean>;
  onMoveItem: (itemPath: string, targetFolderPath: string) => Promise<boolean>;
  onRefresh: () => void;
  onRebuildIndex?: () => Promise<void>;
  loading: boolean;
  isChatMode: boolean;
  onToggleChatMode: () => void;
  chatOrganizePath?: string | null;
  onSelectOrganizeFolder?: () => void;
  onCopyItem: (sourcePath: string) => Promise<boolean>;
  /** 发送：desktop=复制到系统桌面；qq/wechat=写入系统剪贴板并唤起应用 */
  onSendItem: (sourcePath: string, target: NotesSendTarget) => Promise<boolean>;
  onImportDroppedFiles: (filePaths: string[], targetFolderPath?: string) => Promise<{ success: boolean; imported?: string[]; errors?: string[] }>;
  pinnedFolders: PinnedFolder[];
  currentViewPath: string | null;
  onAddPinnedFolder: () => Promise<boolean>;
  onAddPinnedFolderByPath: (folderPath: string) => boolean;
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