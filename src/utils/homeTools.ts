import { localStorageService, STORAGE_KEYS } from '../services/localStorageService';

export interface HomeToolItem {
  id: string;
  name: string;
  path: string;
  color: string;
  textColor: string;
  iconName: string;
}

/**
 * 天气卡与工具中心的「天气预报」是同一条数据：首页用专用天气卡渲染它，
 * 加入 / 移出首页与其它工具卡片完全一致
 */
export const WEATHER_TOOL_ID = 'weather';

/** 首页卡片支持直接新增的工具：与 HomeToolAddModal 复用的各工具页表单一一对应 */
export const ADDABLE_TOOL_IDS = ['todo', 'memo', 'reminder', 'quick-reply', 'cloud-clipboard'] as const;
export type AddableToolId = (typeof ADDABLE_TOOL_IDS)[number];

const weatherHomeTool: HomeToolItem = {
  id: WEATHER_TOOL_ID,
  name: '天气预报',
  path: '/tools/weather',
  color: '#3b82f6',
  textColor: '#fff',
  iconName: 'Cloud',
};

export const defaultHomeTools: HomeToolItem[] = [
  weatherHomeTool,
  { id: 'cloud-clipboard', name: '云剪贴板', path: '/tools/cloud-clipboard', color: '#67aaf7', textColor: '#fff', iconName: 'Clipboard' },
  { id: 'todo', name: '待办事项', path: '/tools/todo', color: '#bc8acf', textColor: '#fff', iconName: 'CheckSquare' },
  { id: 'navigation', name: '导航', path: '/nav', color: '#4caf50', textColor: '#fff', iconName: 'Navigation' },
  { id: 'account', name: '账号', path: '/tools/account', color: '#00bcd4', textColor: '#fff', iconName: 'Rocket' },
  { id: 'translate', name: '在线翻译', path: '/tools/translate', color: '#2196F3', textColor: '#fff', iconName: 'Languages' },
  { id: 'news', name: '新闻', path: '/news', color: '#e91e63', textColor: '#fff', iconName: 'MessageSquare' },
  { id: 'memo', name: '备忘录', path: '/tools/memo', color: '#7c4dff', textColor: '#fff', iconName: 'StickyNote' },
];

// 已废弃的快捷工具 ID（从首页移除）：旧版本 localStorage 中可能仍存在，加载时过滤
const DEPRECATED_TOOL_IDS = new Set(['notes']);

// 导航工具旧 id 与 ALL_TOOLS 不一致，统一成 'navigation'，
// 否则工具中心再加一次导航就会在首页出现两张同样的卡片
const LEGACY_TOOL_ID_ALIAS: Record<string, string> = { nav: 'navigation' };

const FALLBACK_COLOR = '#6366f1';

/**
 * 清洗持久化的工具列表：丢弃脏数据、已废弃工具与重复 id。
 * id 唯一是硬要求 —— 首页用 `tool-${id}` 作为卡片 key，重复会让网格渲染出多张相同卡片。
 * 返回 null 表示从未持久化过（与用户主动清空后的空数组区分）。
 */
const normalizeHomeTools = (raw: unknown): HomeToolItem[] | null => {
  if (!Array.isArray(raw)) return null;

  const seen = new Set<string>();
  const tools: HomeToolItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const tool = item as Partial<HomeToolItem>;
    if (typeof tool.id !== 'string' || !tool.id) continue;

    const id = LEGACY_TOOL_ID_ALIAS[tool.id] ?? tool.id;
    if (DEPRECATED_TOOL_IDS.has(id) || seen.has(id)) continue;

    seen.add(id);
    tools.push({
      id,
      name: typeof tool.name === 'string' && tool.name ? tool.name : tool.id,
      path: typeof tool.path === 'string' && tool.path ? tool.path : '/',
      color: typeof tool.color === 'string' && tool.color ? tool.color : FALLBACK_COLOR,
      textColor: typeof tool.textColor === 'string' && tool.textColor ? tool.textColor : '#ffffff',
      iconName: typeof tool.iconName === 'string' && tool.iconName ? tool.iconName : 'Clipboard',
    });
  }
  return tools;
};

export const saveHomeTools = (tools: HomeToolItem[]): void => {
  localStorageService.set(STORAGE_KEYS.HOME_TOOLS, tools);
};

/**
 * 天气卡原先是首页写死的一张卡片，改成由首页工具列表管理后，
 * 老用户已持久化的列表里没有它，这里补一次；补过之后用户再「移出首页」不会被回填。
 */
const seedWeatherTool = (tools: HomeToolItem[]): HomeToolItem[] => {
  if (localStorageService.get<boolean>(STORAGE_KEYS.HOME_TOOLS_WEATHER_SEEDED, false)) return tools;

  localStorageService.set(STORAGE_KEYS.HOME_TOOLS_WEATHER_SEEDED, true);
  if (tools.some(tool => tool.id === WEATHER_TOOL_ID)) return tools;
  return [...tools, weatherHomeTool];
};

/**
 * 读取首页工具。localStorage 从未写入过时落盘默认工具；
 * 用户主动清空后的空数组是合法状态，不会被默认值回填。
 */
export const loadHomeTools = (): HomeToolItem[] => {
  const saved = normalizeHomeTools(localStorageService.get<unknown>(STORAGE_KEYS.HOME_TOOLS, null));
  const tools = saved ?? defaultHomeTools.map(tool => ({ ...tool }));
  const seeded = seedWeatherTool(tools);

  if (!saved || seeded !== tools) saveHomeTools(seeded);
  return seeded;
};

/** 追加到首页末尾；已存在则不重复添加，返回写入后的列表 */
export const addHomeTool = (tool: HomeToolItem): HomeToolItem[] => {
  const tools = loadHomeTools();
  if (tools.some(item => item.id === tool.id)) return tools;

  const next = [...tools, { ...tool }];
  saveHomeTools(next);
  return next;
};

/** 从首页移除；不存在则原样返回，返回写入后的列表 */
export const removeHomeTool = (toolId: string): HomeToolItem[] => {
  const tools = loadHomeTools();
  const next = tools.filter(tool => tool.id !== toolId);
  if (next.length === tools.length) return tools;

  saveHomeTools(next);
  return next;
};
