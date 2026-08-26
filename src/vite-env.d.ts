/// <reference types="vite/client" />

declare module '*.svg'

interface QuickLoginField {
  label: string;
  value: string;
}

interface QuickLoginPayload {
  title: string;
  url: string;
  isDark: boolean;
  fields: QuickLoginField[];
}

interface DesktopAppInfo {
  name: string;
  path: string;
}

interface SettingItem {
  name: string;
  value: string | number | boolean | object;
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

interface PluginInfo {
  id: string;
  name: string;
  description: string;
  iconName: string;
  iconUrl?: string;
  image?: string;
  color: string;
  textColor: string;
  version: string;
  author: string;
  categories: string[];
  path: string;
  tags?: string[];
  githubRepo?: string;
  releaseUrl?: string;
  entry?: string;
  isBeta?: boolean;
}

interface InstalledPlugin extends PluginInfo {
  enabled: boolean;
  installedVersion: string;
  installDate: number;
  isPinned: boolean;
}

interface OfflineToolFile {
  name: string;
  fileName: string;
  path: string;
  size: number;
  mtimeMs: number;
}

interface SystemInfo {
  os_name: string;
  os_version: string;
  os_arch: string;
  computer_name: string;
  user_name: string;
  cpu_info: string;
  cpu_cores: number;
  total_memory: number;
  available_memory: number;
  uptime_seconds: number;
}

interface UpdateResult {
  code: number;
  msg: string;
  data?: Record<string, unknown>;
}

interface FloatConfigItem {
  id: number;
  type: 'nav' | 'tool' | 'app' | 'system' | 'plugin';
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
    restart: () => Promise<{ code: number; msg: string }>;
    openExternal: (url: string) => void;
    openInternal: (url: string) => void;
    openQuickLogin: (payload: QuickLoginPayload) => Promise<{ success: boolean }>;
    openFile: (path: string) => void;
    selectFile: () => Promise<string | null>;
    selectFolder: () => Promise<string | null>;
    getFileIcon: (path: string) => Promise<string | null>;
    fileExists: (path: string) => Promise<boolean>;
    scanDesktopApps: () => Promise<DesktopAppInfo[]>;
    getDroppedFiles: (filePaths: string[]) => Promise<string[]>;
    getFileOrFolderPath: (item: File) => Promise<string | undefined>;
    getAutostartStatus: () => Promise<boolean>;
    setAutostartStatus: (enable: boolean) => Promise<boolean>;
    getSettings: () => Promise<SettingItem[]>;
    updateSetting: (setting: { name: string; value: string | number | boolean | object }) => Promise<UpdateResult>;
    clearCache: () => Promise<UpdateResult>;
    clearIconCache: (type: 'all' | 'expired') => Promise<{ code: number; msg: string }>;
    networkTest: (payload: { url: string; timeout?: number }) => Promise<{ ok: boolean; statusCode: number; latencyMs: number; error: string | null }>;
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
      readFileAsBuffer: (filePath: string) => Promise<{ success: boolean; base64?: string; mimeType?: string; error?: string }>;
      saveFile: (filePath: string, content: string) => Promise<NotesSaveResult>;
      renameItem: (oldPath: string, newName: string) => Promise<NotesRenameResult>;
      deleteItem: (itemPath: string) => Promise<NotesDeleteResult>;
      indexAll: (rootPath: string) => Promise<{ success: boolean; error?: string }>;
      openFileInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      moveItem: (itemPath: string, targetFolderPath: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
      copyItem: (sourcePath: string) => Promise<{ success: boolean; error?: string }>;
      importDroppedFiles: (rootPath: string, filePaths: string[]) => Promise<{ success: boolean; imported?: string[]; errors?: string[]; error?: string }>;
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
    onSettingChanged: (callback: (setting: { name: string; value: string | number | boolean | object }) => void) => void;
    onOpenAddTodo: (callback: () => void) => void;
    onOpenAddMemo: (callback: () => void) => void;
    onLaunchPlugin: (callback: (pluginId: string) => void) => void;
    ipcRenderer: {
      send: <T extends unknown[]>(channel: string, ...args: T) => void;
      invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>;
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
    systemInfo: {
      get: () => Promise<SystemInfo>;
    };
    plugin: {
      getAvailable: () => Promise<PluginInfo[]>;
      getInstalled: () => Promise<InstalledPlugin[]>;
      install: (pluginId: string, repo?: string, releaseUrl?: string) => Promise<{ success: boolean; reason?: string; message?: string }>;
      uninstall: (pluginId: string) => Promise<{ success: boolean; message?: string }>;
      toggleEnabled: (pluginId: string, enabled: boolean) => Promise<{ success: boolean }>;
      installFromFile: () => Promise<{ success: boolean; reason?: string; message?: string; canceled?: boolean }>;
      installFromPath: (filePath: string) => Promise<{ success: boolean; reason?: string; message?: string }>;
      installFromGithub: (id: string, repo: string) => Promise<{ success: boolean; reason?: string; message?: string }>;
      openWindow: (pluginId: string, userId?: string | null) => Promise<{ success: boolean; error?: string }>;
      openExtensionsDir: () => Promise<{ success: boolean; error?: string }>;
      storage: {
        get: <T>(pluginId: string, userId: string, key?: string) => Promise<T | null>;
        set: (pluginId: string, userId: string, key: string, value: unknown) => Promise<void>;
        delete: (pluginId: string, userId: string, key?: string) => Promise<void>;
      };
    };
    offlineTools: {
      getDir: () => Promise<string | null>;
      setDir: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
      list: (dirPath: string) => Promise<{ success: boolean; files: OfflineToolFile[]; error?: string }>;
      open: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    };
  };
}