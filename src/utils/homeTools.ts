import { localStorageService, STORAGE_KEYS } from '../services/localStorageService';

export interface HomeToolItem {
  id: string;
  name: string;
  path: string;
  color: string;
  textColor: string;
  iconName: string;
}

export const defaultHomeTools: HomeToolItem[] = [
  { id: 'cloud-clipboard', name: '云剪贴板', path: '/tools/cloud-clipboard', color: '#67aaf7', textColor: '#fff', iconName: 'Clipboard' },
  { id: 'todo', name: '待办事项', path: '/tools/todo', color: '#bc8acf', textColor: '#fff', iconName: 'CheckSquare' },
  { id: 'nav', name: '导航', path: '/nav', color: '#f5a623', textColor: '#fff', iconName: 'Globe' },
  { id: 'account', name: '账号', path: '/tools/account', color: '#00bcd4', textColor: '#fff', iconName: 'Rocket' },
  { id: 'news', name: '新闻', path: '/news', color: '#e91e63', textColor: '#fff', iconName: 'MessageSquare' },
  { id: 'translate', name: '在线翻译', path: '/tools/translate', color: '#2196F3', textColor: '#fff', iconName: 'Languages' },
];

// 已废弃的快捷工具 ID（从首页移除）：旧版本 localStorage 中可能仍存在，加载时过滤
const DEPRECATED_TOOL_IDS = new Set(['notes']);

export const loadHomeTools = (): HomeToolItem[] => {
  const savedTools = localStorageService.get<HomeToolItem[]>(STORAGE_KEYS.HOME_TOOLS, [])
    .filter(tool => !DEPRECATED_TOOL_IDS.has(tool.id));
  if (savedTools.length > 0) {
    if (savedTools.length < defaultHomeTools.length) {
      const updatedTools = [...savedTools];
      for (let i = savedTools.length; i < defaultHomeTools.length; i++) {
        updatedTools.push(defaultHomeTools[i]);
      }
      saveHomeTools(updatedTools);
      return updatedTools;
    }
    return savedTools;
  }
  return [...defaultHomeTools];
};

export const saveHomeTools = (tools: HomeToolItem[]): void => {
  localStorageService.set(STORAGE_KEYS.HOME_TOOLS, tools);
};

export const replaceHomeTool = (index: number, newTool: HomeToolItem): boolean => {
  const tools = loadHomeTools();
  if (index >= 0 && index < tools.length) {
    tools[index] = { ...newTool };
    saveHomeTools(tools);
    return true;
  }
  return false;
};