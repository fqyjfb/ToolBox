// 自动拆分自 src/vite-env.d.ts（ambient 全局声明，勿加 import/export）
// 备忘录（Notes）文件操作接口

interface NotesFileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  fileType?: 'md' | 'txt' | 'html' | 'json' | 'docx' | 'xlsx' | 'image' | 'pdf';
  children?: NotesFileTreeNode[];
  expanded?: boolean;
  active?: boolean;
}

interface NotesSelectFolderResult {
  canceled: boolean;
  filePaths: string[];
}

interface NotesValidateResult {
  valid: boolean;
  error?: string;
}

interface NotesScanResult {
  success: boolean;
  fileCount: number;
  folderCount: number;
  error?: string;
}

interface NotesCreateResult {
  success: boolean;
  path?: string;
  error?: string;
  exists?: boolean;
}

interface NotesReadResult {
  success: boolean;
  content?: string;
  error?: string;
}

interface NotesSaveResult {
  success: boolean;
  error?: string;
}

interface NotesRenameResult {
  success: boolean;
  newPath?: string;
  error?: string;
}

interface NotesDeleteResult {
  success: boolean;
  error?: string;
}
