/// <reference types="vite/client" />

declare module '*.svg'

interface DesktopAppInfo {
  name: string;
  path: string;
}

interface SettingItem {
  name: string;
  value: string | number | boolean;
}

interface ShortcutItem {
  id: number;
  tag: string;
  cmd: string;
  isOpen: number;
  isGlobal: number;
}

interface AppVersionInfo {
  version: string;
  electron: string;
  chrome: string;
  newVersion: string;
  github: string;
  download: string;
}

interface UpdateResult {
  code: number;
  msg: string;
  data?: Record<string, unknown>;
}

interface FloatConfigItem {
  id: number;
  type: 'nav' | 'tool' | 'app' | 'system';
  action: string;
  name: string;
  icon: string;
  color: string;
  path?: string;
}

interface DownloadResult {
  code: number;
  msg: string;
  path?: string;
}

interface FileData {
  name: string;
  type: string;
  size: number;
  path?: string;
}

interface NotesFileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
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

interface OcrBlock {
  text: string;
  confidence: number;
  box: number[][];
}

interface OcrResult {
  success: boolean;
  text: string;
  blocks: OcrBlock[];
  error?: string;
}

interface PythonServiceStatus {
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  pid: number | null;
  port: number | null;
  httpPort: number | null;
  startedAt: number | null;
  uptime: number | null;
  restartCount: number;
  lastError: string | null;
}

interface OcrStatus {
  available: boolean;
  message: string;
  status?: string;
  lastError?: string | null;
  canManualStart?: boolean;
  pid?: number;
  uptime?: number;
}

declare interface Window {
  electron?: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    openExternal: (url: string) => void;
    openInternal: (url: string) => void;
    openFile: (path: string) => void;
    selectFile: () => Promise<string | null>;
    selectFolder: () => Promise<string | null>;
    getFileIcon: (path: string) => Promise<string | null>;
    scanDesktopApps: () => Promise<DesktopAppInfo[]>;
    getDroppedFiles: (filePaths: string[]) => Promise<string[]>;
    getFileOrFolderPath: (item: File) => Promise<string | undefined>;
    getAutostartStatus: () => Promise<boolean>;
    setAutostartStatus: (enable: boolean) => Promise<boolean>;
    getSettings: () => Promise<SettingItem[]>;
    updateSetting: (setting: { name: string; value: string | number | boolean }) => Promise<UpdateResult>;
    clearCache: () => Promise<UpdateResult>;
    getUserDataPath: () => Promise<string>;
    openUserDataFolder: () => Promise<{ success: boolean }>;
    getShortcuts: () => Promise<ShortcutItem[]>;
    updateShortcut: (shortcut: ShortcutItem & { flag?: boolean }) => Promise<UpdateResult>;
    resetShortcuts: () => Promise<UpdateResult>;
    getVersion: () => Promise<AppVersionInfo>;
    downloadUpdate: (url: string) => Promise<DownloadResult>;
    installUpdate: (filePath: string) => Promise<UpdateResult>;
    toggleFloatWindow: () => Promise<number>;
    getFloatConfig: () => Promise<FloatConfigItem[]>;
    updateFloatConfig: (config: FloatConfigItem[]) => Promise<UpdateResult>;
    resetFloatConfig: () => Promise<UpdateResult>;
    ocr: {
      recognize: (imageBase64: string) => Promise<OcrResult>;
      recognizeFile: (filePath: string) => Promise<OcrResult>;
      status: () => Promise<OcrStatus>;
      start: () => Promise<{ success: boolean; message: string; pid?: number; error?: string }>;
      stop: () => Promise<{ success: boolean; message: string; error?: string }>;
      serviceInfo: () => Promise<PythonServiceStatus>;
      diagnose: () => Promise<{ success: boolean; output: string; error?: string; exitCode?: number }>;
      installDeps: () => Promise<{ success: boolean; output: string; error?: string; exitCode?: number }>;
      checkPort: (port: number) => Promise<{ success: boolean; inUse: boolean; port: number; error?: string }>;
      selectPythonPath: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>;
    };
    fileManager: {
      getSystemPaths: () => Promise<Array<{
        name: string;
        path: string;
        icon: string;
        isSystem: boolean;
      }>>;
      getPath: (pathType: string) => Promise<string | null>;
      listFiles: (dirPath: string) => Promise<Array<{
        name: string;
        path: string;
        isDirectory: boolean;
        size?: number;
        modifiedTime?: Date;
      }>>;
      getParentPath: (currentPath: string) => Promise<string | null>;
      openFile: (filePath: string) => Promise<boolean>;
      getFavorites: () => Promise<Array<{
        name: string;
        path: string;
        icon: string;
        isSystem: boolean;
      }>>;
      addFavorite: (path: string, name?: string) => Promise<boolean>;
      removeFavorite: (path: string) => Promise<boolean>;
      getTargetPaths: () => Promise<Array<{
        id: string;
        name: string;
        path: string;
        createdAt: Date;
      }>>;
      addTargetPath: (path: string, name?: string) => Promise<boolean>;
      removeTargetPath: (id: string) => Promise<boolean>;
      copyFiles: (sourcePaths: string[], destPath: string) => Promise<number>;
      deleteItem: (itemPath: string) => Promise<boolean>;
    };
    python: {
      start: () => Promise<{ success: boolean; pid?: number; port?: number; httpPort?: number; error?: string }>;
      stop: () => Promise<{ success: boolean; error?: string }>;
      status: () => Promise<PythonServiceStatus>;
    };
    notes: {
      hasRootPath: () => Promise<boolean>;
      getRootPath: () => Promise<string | null>;
      setRootPath: (rootPath: string) => Promise<boolean>;
      selectFolder: () => Promise<NotesSelectFolderResult>;
      validateFolder: (folderPath: string) => Promise<NotesValidateResult>;
      scanFolder: (rootPath: string) => Promise<NotesScanResult>;
      getFileTree: () => Promise<NotesFileTreeNode[]>;
      createFolder: (parentPath: string | null, name: string) => Promise<NotesCreateResult>;
      createFolderForce: (parentPath: string | null, name: string, mode: 'overwrite' | 'copy') => Promise<NotesCreateResult>;
      createNote: (parentPath: string | null, name: string, content?: string) => Promise<NotesCreateResult>;
      createNoteForce: (parentPath: string | null, name: string, mode: 'overwrite' | 'copy', content?: string) => Promise<NotesCreateResult>;
      readFile: (filePath: string) => Promise<NotesReadResult>;
      saveFile: (filePath: string, content: string) => Promise<NotesSaveResult>;
      renameItem: (oldPath: string, newName: string) => Promise<NotesRenameResult>;
      deleteItem: (itemPath: string) => Promise<NotesDeleteResult>;
      indexAll: (rootPath: string) => Promise<{ success: boolean; error?: string }>;
      openFileInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    };
    log: {
      open: () => void;
      addLog: (level: 'error' | 'warn' | 'info' | 'debug', message: string, context?: string, stack?: string) => Promise<boolean>;
      getLogs: () => Promise<Array<{
        id: string;
        timestamp: number;
        level: 'error' | 'warn' | 'info' | 'debug';
        message: string;
        context?: string;
        stack?: string;
      }>>;
      getSettings: () => Promise<{
        enabled: boolean;
        maxEntries: number;
        levels: {
          error: boolean;
          warn: boolean;
          info: boolean;
          debug: boolean;
        };
        showTimestamp: boolean;
        autoClean: boolean;
      }>;
      updateSettings: (newSettings: Partial<{
        enabled: boolean;
        maxEntries: number;
        levels: {
          error: boolean;
          warn: boolean;
          info: boolean;
          debug: boolean;
        };
        showTimestamp: boolean;
        autoClean: boolean;
      }>) => Promise<{
        enabled: boolean;
        maxEntries: number;
        levels: {
          error: boolean;
          warn: boolean;
          info: boolean;
          debug: boolean;
        };
        showTimestamp: boolean;
        autoClean: boolean;
      }>;
      clearLogs: () => Promise<boolean>;
      exportLogs: () => Promise<string>;
      importLogs: (jsonString: string) => Promise<boolean>;
      getStats: () => Promise<{ total: number; error: number; warn: number; info: number; debug: number }>;
    };
    onDownloadProgress: (callback: (progress: number) => void) => void;
    onNavigate: (callback: (path: string) => void) => void;
    onSettingChanged: (callback: (setting: { name: string; value: string | number | boolean }) => void) => void;
    onOpenAddTodo: (callback: () => void) => void;
    ipcRenderer: {
      send: <T extends unknown[]>(channel: string, ...args: T) => void;
      on: <T extends unknown[]>(channel: string, listener: (event: unknown, ...args: T) => void) => void;
      off: <T extends unknown[]>(channel: string, listener: (event: unknown, ...args: T) => void) => void;
    };
    ipInfo: {
      query: (ip?: string) => Promise<{
        ip: string;
        version: string;
        city: string;
        region: string;
        country_name: string;
        country_code: string;
        timezone: string;
        currency: string;
        currency_name: string;
        postal: string;
        latitude: number;
        longitude: number;
        org: string;
        asn: string;
        languages: string;
        error?: boolean;
        reason?: string;
      }>;
    };
  };
}