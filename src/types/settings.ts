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
  name?: string;
}

export type FloatConfigType = 'nav' | 'tool' | 'app' | 'system' | 'plugin';

export interface FloatConfigItem {
  id: number;
  type: FloatConfigType;
  action: string;
  name: string;
  icon: string;
  color: string;
  path?: string;
}

export type SettingsTab = 'general' | 'storage' | 'sync' | 'quickLaunch' | 'notifications' | 'shortcuts' | 'floatWindow' | 'quickPanel' | 'logMonitor' | 'network';

export interface NotificationSettings {
  errors: boolean;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface QuickPanelItem {
  id: string;
  type: 'app' | 'url' | 'folder';
  name: string;
  icon: string;
  action: string;
  color: string;
  order: number;
}

export interface QuickPanelPosition {
  edge: 'left' | 'right' | 'top';
  x: number;
  y: number;
}

export interface QuickPanelConfig {
  isEnabled: number;
  position: QuickPanelPosition;
  items: QuickPanelItem[];
}
