import { ShortcutItem } from '../types/settings';

export const AVAILABLE_ICONS = [
  { name: 'Date', label: '日期' },
  { name: 'Delete', label: '删除' },
  { name: 'Remind', label: '提醒' },
  { name: 'Download', label: '下载' },
  { name: 'Tool', label: '工具' },
  { name: 'Member', label: '成员' },
  { name: 'Info', label: '信息' },
  { name: 'Edit', label: '编辑' },
  { name: 'View', label: '查看' },
  { name: 'Todo', label: '待办' },
  { name: 'Upload', label: '上传' },
  { name: 'Coin', label: '钱币' },
  { name: 'Image', label: '图片' },
  { name: 'List', label: '列表' },
  { name: 'Chart', label: '图表' },
  { name: 'Star', label: '收藏' },
  { name: 'File', label: '文件' },
  { name: 'Task', label: '任务' },
  { name: 'Report', label: '报表' },
  { name: 'Home', label: '主页' },
  { name: 'User', label: '用户' },
  { name: 'Client', label: '客户' },
  { name: 'Location', label: '位置' },
  { name: 'Architecture', label: '架构' },
  { name: 'Check', label: '勾选' },
  { name: 'Zap', label: '闪电' },
  { name: 'Flame', label: '火焰' },
  { name: 'Scan', label: '扫描' },
  { name: 'Print', label: '打印' },
  { name: 'Heart', label: '爱心' },
  { name: 'Search', label: '搜索' },
  { name: 'Clock', label: '时钟' },
  { name: 'Mail', label: '邮件' },
  { name: 'Phone', label: '电话' },
  { name: 'Computer', label: '电脑' },
];

export const AVAILABLE_COLORS = [
  '#03a9f4', '#0462df', '#1db954', '#8c9eff', '#bd081c', '#ea4c89', '#333', '#ff4500',
  '#f5a623', '#bc8acf', '#00bcd4', '#e91e63', '#2196f3', '#9c27b0', '#009688', '#ff9800',
  '#795548', '#607d8b', '#e74c3c', '#9b59b6', '#3498db', '#1abc9c', '#2ecc71', '#f39c12',
];

export const NAV_ACTIONS = [
  { action: 'home', label: '主页' },
  { action: 'tools', label: '工具中心' },
  { action: 'quick', label: '快捷启动' },
  { action: 'bookmark', label: '收藏' },
  { action: 'todo', label: '待办' },
  { action: 'news', label: '热点' },
  { action: 'settings', label: '设置' },
];

export const SYSTEM_ACTIONS = [
  { action: 'clear-recycle-bin', label: '清空回收站' },
  { action: 'open-my-computer', label: '打开我的电脑' },
  { action: 'shutdown', label: '关机' },
  { action: 'restart', label: '重启' },
  { action: 'restart-app', label: '重启程序' },
];

export const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  { id: 1, tag: '退出软件', cmd: 'CommandOrControl+Q', isOpen: 1, isGlobal: 1 },
  { id: 2, tag: '隐藏/显示 软件窗口', cmd: 'CommandOrControl+H', isOpen: 1, isGlobal: 1 },
  { id: 3, tag: '隐藏/显示 侧边导航', cmd: 'CommandOrControl+B', isOpen: 1, isGlobal: 0 },
  { id: 4, tag: '打开设置', cmd: 'CommandOrControl+S', isOpen: 1, isGlobal: 0 },
  { id: 5, tag: '取消/设置 窗口置顶', cmd: 'CommandOrControl+T', isOpen: 1, isGlobal: 0 },
  { id: 6, tag: '恢复默认窗口', cmd: 'CommandOrControl+O', isOpen: 1, isGlobal: 0 },
  { id: 7, tag: '刷新当前页面', cmd: 'CommandOrControl+R', isOpen: 1, isGlobal: 0 },
  { id: 8, tag: '最小化窗口', cmd: 'CommandOrControl+[', isOpen: 1, isGlobal: 0 },
  { id: 9, tag: '最大化窗口', cmd: 'CommandOrControl+]', isOpen: 1, isGlobal: 0 },
];

export const FLOAT_TYPE_OPTIONS = [
  { type: 'nav' as const, label: '导航' },
  { type: 'tool' as const, label: '工具' },
  { type: 'app' as const, label: '应用' },
  { type: 'system' as const, label: '系统' },
];

export const DEFAULT_WINDOW_SIZE = { width: 1024, height: 800 };