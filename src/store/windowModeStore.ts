import { create } from 'zustand';
import { isElectron } from '../utils/environment';

export type WindowMode = 'large' | 'compact';

interface WindowModeStore {
  /** 当前窗口模式；Web 端恒为 'large' */
  mode: WindowMode;
  /** 冷启动时由 App 初始化流程（getSettings 回流）写入一次 */
  hydrate: (mode: WindowMode) => void;
  /** 切换模式：本地立即生效（乐观更新）+ 通知主进程调整原生窗口 */
  setMode: (mode: WindowMode) => void;
}

export const useWindowModeStore = create<WindowModeStore>((set) => ({
  mode: 'large',
  hydrate: (mode) => set({ mode }),
  setMode: (mode) => set(() => {
    if (isElectron()) window.electron?.setWindowMode(mode);
    return { mode };
  }),
}));

/** 统一入口：是否处于 Electron 小窗模式（页面级适配判断都用它，禁止各自拼条件） */
export const useIsCompactMode = (): boolean =>
  useWindowModeStore((s) => s.mode === 'compact' && isElectron());
