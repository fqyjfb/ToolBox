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
}

export type FloatConfigType = 'nav' | 'tool' | 'app' | 'system';

export interface FloatConfigItem {
  id: number;
  type: FloatConfigType;
  action: string;
  name: string;
  icon: string;
  color: string;
  path?: string;
}

export type SettingsTab = 'general' | 'storage' | 'quickLaunch' | 'notifications' | 'shortcuts' | 'floatWindow' | 'ocr' | 'logMonitor';

export interface NotificationSettings {
  errors: boolean;
}

export interface WindowSize {
  width: number;
  height: number;
}
