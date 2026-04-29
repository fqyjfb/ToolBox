/// <reference types="vite/client" />

declare module '*.svg'

interface DesktopAppInfo {
  name: string;
  path: string;
}

interface SettingItem {
  name: string;
  value: any;
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
  data?: any;
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

declare interface Window {
  electron?: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    openExternal: (url: string) => void;
    openInternal: (url: string) => void;
    openFile: (path: string) => void;
    selectFile: () => Promise<string | null>;
    getFileIcon: (path: string) => Promise<string | null>;
    scanDesktopApps: () => Promise<DesktopAppInfo[]>;
    getAutostartStatus: () => Promise<boolean>;
    setAutostartStatus: (enable: boolean) => Promise<boolean>;
    getSettings: () => Promise<SettingItem[]>;
    updateSetting: (setting: { name: string; value: any }) => Promise<UpdateResult>;
    clearCache: () => Promise<UpdateResult>;
    getShortcuts: () => Promise<ShortcutItem[]>;
    updateShortcut: (shortcut: ShortcutItem & { flag?: boolean }) => Promise<UpdateResult>;
    getVersion: () => Promise<AppVersionInfo>;
    downloadUpdate: (url: string) => Promise<DownloadResult>;
    installUpdate: (filePath: string) => Promise<UpdateResult>;
    toggleFloatWindow: () => Promise<number>;
    getFloatConfig: () => Promise<FloatConfigItem[]>;
    updateFloatConfig: (config: FloatConfigItem[]) => Promise<UpdateResult>;
    resetFloatConfig: () => Promise<UpdateResult>;
    onDownloadProgress: (callback: (progress: number) => void) => void;
    onNavigate: (callback: (path: string) => void) => void;
    onSettingChanged: (callback: (setting: { name: string; value: any }) => void) => void;
  };
}