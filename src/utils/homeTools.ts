export interface HomeToolItem {
  id: string;
  name: string;
  path: string;
  color: string;
  textColor: string;
  iconName: string;
}

const HOME_TOOLS_KEY = 'homeTools';

export const defaultHomeTools: HomeToolItem[] = [
  { id: 'cloud-clipboard', name: '云剪贴板', path: '/tools/cloud-clipboard', color: '#67aaf7', textColor: '#fff', iconName: 'Clipboard' },
  { id: 'todo', name: '待办事项', path: '/tools/todo', color: '#bc8acf', textColor: '#fff', iconName: 'CheckSquare' },
  { id: 'nav', name: '导航', path: '/nav', color: '#f5a623', textColor: '#fff', iconName: 'Globe' },
  { id: 'account', name: '账号', path: '/tools/account', color: '#00bcd4', textColor: '#fff', iconName: 'Rocket' },
  { id: 'news', name: '新闻', path: '/news', color: '#e91e63', textColor: '#fff', iconName: 'MessageSquare' },
  { id: 'translate', name: '在线翻译', path: '/tools/translate', color: '#2196F3', textColor: '#fff', iconName: 'Languages' },
];

export const loadHomeTools = (): HomeToolItem[] => {
  const savedTools = localStorage.getItem(HOME_TOOLS_KEY);
  if (savedTools) {
    try {
      const parsedTools = JSON.parse(savedTools);
      if (parsedTools.length < defaultHomeTools.length) {
        const updatedTools = [...parsedTools];
        for (let i = parsedTools.length; i < defaultHomeTools.length; i++) {
          updatedTools.push(defaultHomeTools[i]);
        }
        saveHomeTools(updatedTools);
        return updatedTools;
      }
      return parsedTools;
    } catch {
      return [...defaultHomeTools];
    }
  }
  return [...defaultHomeTools];
};

export const saveHomeTools = (tools: HomeToolItem[]): void => {
  localStorage.setItem(HOME_TOOLS_KEY, JSON.stringify(tools));
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

export const getHomeToolByIndex = (index: number): HomeToolItem | undefined => {
  const tools = loadHomeTools();
  return tools[index];
};

export const resetHomeTools = (): void => {
  saveHomeTools([...defaultHomeTools]);
};