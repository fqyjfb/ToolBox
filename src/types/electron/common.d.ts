// 自动拆分自 src/vite-env.d.ts（ambient 全局声明，勿加 import/export）
// 通用接口：快速登录 / 桌面应用 / 设置 / 快捷键 / 版本 / 离线工具 / 系统信息 / 更新 / 悬浮配置 / 下载 / 文件

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
  args?: string;
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
  name?: string;
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
