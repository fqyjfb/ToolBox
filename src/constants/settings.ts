import type { LucideIcon } from 'lucide-react';
import {
  Home, Grid3X3, Zap, Star, CheckSquare, Newspaper, Settings,
  Trash2, Monitor, Power, RotateCcw, RotateCw,
  Sparkles, Languages,
} from 'lucide-react';
import { ShortcutItem } from '../types/settings';

export interface FloatActionOption {
  action: string;
  label: string;
  /** 该功能在应用内的原有图标，悬浮窗配置直接复用 */
  icon: LucideIcon;
}

export const NAV_ACTIONS: FloatActionOption[] = [
  { action: 'home', label: '主页', icon: Home },
  { action: 'tools', label: '工具中心', icon: Grid3X3 },
  { action: 'quick', label: '快捷启动', icon: Zap },
  { action: 'bookmark', label: '收藏', icon: Star },
  { action: 'todo', label: '待办', icon: CheckSquare },
  { action: 'news', label: '热点', icon: Newspaper },
  { action: 'settings', label: '设置', icon: Settings },
];

// 悬浮球 AI 动作：action 存短名，渲染层发送时统一拼成 ai:xxx
export const AI_ACTIONS: FloatActionOption[] = [
  { action: 'chat', label: 'AI 对话', icon: Sparkles },
  { action: 'selection', label: '划词提问', icon: Languages },
];

export const SYSTEM_ACTIONS: FloatActionOption[] = [
  { action: 'clear-recycle-bin', label: '清空回收站', icon: Trash2 },
  { action: 'open-my-computer', label: '打开我的电脑', icon: Monitor },
  { action: 'shutdown', label: '关机', icon: Power },
  { action: 'restart', label: '重启', icon: RotateCcw },
  { action: 'restart-app', label: '重启程序', icon: RotateCw },
];

export const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  { id: 1, tag: '退出软件', cmd: 'CommandOrControl+Q', isOpen: 1, isGlobal: 1 },
  { id: 2, tag: '软件窗口', cmd: 'CommandOrControl+H', isOpen: 1, isGlobal: 1 },
  { id: 3, tag: '侧边导航', cmd: 'CommandOrControl+B', isOpen: 1, isGlobal: 0 },
  { id: 4, tag: '打开设置', cmd: 'CommandOrControl+S', isOpen: 1, isGlobal: 0 },
  { id: 5, tag: '窗口置顶', cmd: 'CommandOrControl+T', isOpen: 1, isGlobal: 0 },
  { id: 6, tag: '恢复默认', cmd: 'CommandOrControl+O', isOpen: 1, isGlobal: 0 },
  { id: 7, tag: '刷新页面', cmd: 'CommandOrControl+R', isOpen: 1, isGlobal: 0 },
  { id: 8, tag: '最小化', cmd: 'CommandOrControl+[', isOpen: 1, isGlobal: 0 },
  { id: 9, tag: '最大化', cmd: 'CommandOrControl+]', isOpen: 1, isGlobal: 0 },
  { id: 10, tag: '锁定/解锁', cmd: 'CommandOrControl+L', isOpen: 1, isGlobal: 1 },
  { id: 11, tag: '划词翻译', cmd: 'Alt+E', isOpen: 1, isGlobal: 1, name: 'translateSelection' },
  { id: 12, tag: '截图翻译', cmd: 'Alt+W', isOpen: 1, isGlobal: 1, name: 'translateScreenshot' },
  { id: 14, tag: '悬浮球划词提问', cmd: 'Alt+D', isOpen: 1, isGlobal: 1, name: 'floatSelectionAI' },
  { id: 15, tag: '悬浮球快速捕捉', cmd: 'Alt+Shift+C', isOpen: 1, isGlobal: 1, name: 'floatQuickCapture' },
  { id: 16, tag: '悬浮球命令面板', cmd: 'Alt+P', isOpen: 1, isGlobal: 1, name: 'floatPalette' },
  { id: 17, tag: '悬浮球截图问答', cmd: 'Alt+Shift+A', isOpen: 1, isGlobal: 1, name: 'floatScreenshotQA' },
];

export const FLOAT_TYPE_OPTIONS = [
  { type: 'nav' as const, label: '导航' },
  { type: 'tool' as const, label: '工具' },
  { type: 'app' as const, label: '应用' },
  { type: 'system' as const, label: '系统' },
  { type: 'ai' as const, label: 'AI' },
  { type: 'plugin' as const, label: '插件' },
];

export const DEFAULT_WINDOW_SIZE = { width: 1160, height: 800 };
