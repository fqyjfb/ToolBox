export interface SettingItem {
  name: string;
  value: string | number | boolean;
}

export interface ShortcutItem {
  id: number;
  tag: string;
  cmd: string;
  isOpen: number;
  isGlobal: number;
  /** 主进程侧的功能映射名（如 translateSelection），渲染层用于定位特定快捷键 */
  name?: string;
}

type FloatConfigType = 'nav' | 'tool' | 'app' | 'system' | 'ai' | 'plugin';

export interface FloatConfigItem {
  id: number;
  type: FloatConfigType;
  action: string;
  name: string;
  icon: string;
  color: string;
  path?: string;
}

export type SettingsTab = 'theme' | 'general' | 'appLock' | 'ai' | 'translate' | 'storage' | 'sync' | 'shortcuts' | 'floatWindow' | 'logMonitor' | 'network';

export interface NotificationSettings {
  errors: boolean;
}

export interface WindowSize {
  width: number;
  height: number;
}
