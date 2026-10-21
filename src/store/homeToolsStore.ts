import { create } from 'zustand';
import { addHomeTool, loadHomeTools, removeHomeTool, type HomeToolItem } from '../utils/homeTools';

interface HomeToolsStore {
  homeTools: HomeToolItem[];
  /** 重新读取磁盘（跨窗口改动 / 缓存清理后对齐内存状态） */
  hydrate: () => void;
  /** 加入首页；已存在则忽略，返回是否新增 */
  addTool: (tool: HomeToolItem) => boolean;
  /** 从首页移除 */
  removeTool: (toolId: string) => void;
}

// 首页工具卡片的唯一数据源：首页网格与工具中心共用，
// 任一侧改动都会立刻反映到另一侧（同窗口内不再依赖 storage 事件）。
export const useHomeToolsStore = create<HomeToolsStore>((set, get) => ({
  homeTools: loadHomeTools(),

  hydrate: () => set({ homeTools: loadHomeTools() }),

  addTool: (tool) => {
    if (get().homeTools.some(item => item.id === tool.id)) return false;
    set({ homeTools: addHomeTool(tool) });
    return true;
  },

  removeTool: (toolId) => {
    const next = removeHomeTool(toolId);
    if (next.length === get().homeTools.length) return;
    set({ homeTools: next });
  },
}));
