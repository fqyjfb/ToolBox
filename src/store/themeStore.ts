import { create } from 'zustand';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';

interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean | 'light' | 'dark') => void;
}

const getInitialTheme = (): boolean => {
  const storedTheme = localStorageService.getString(STORAGE_KEYS.THEME);
  if (storedTheme === 'dark') {
    return true;
  }
  const legacyTheme = localStorageService.getString('theme-isDark');
  return legacyTheme ? JSON.parse(legacyTheme) : false;
};

// 已同步给主进程的主题值（null = 尚未同步过）
let syncedIsDark: boolean | null = null;

// 主题同步的唯一出口：主进程收到后会刷新 nativeTheme（托盘菜单等原生 UI）
// 并向悬浮球窗口广播主题。放在这里可保证所有入口（头部按钮 / 设置页 / 后续新增入口）都生效。
const syncThemeToMain = (isDark: boolean) => {
  // 主进程回广播 setting-changed 会再次触发 setTheme，值未变时不再回发，避免 IPC 循环
  if (syncedIsDark === isDark) return;
  syncedIsDark = isDark;
  if (window.electron) {
    void window.electron.updateSetting({ name: 'systemTheme', value: isDark ? 'dark' : 'light' });
  }
};

const applyTheme = (isDark: boolean) => {
  localStorageService.setString(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }
  syncThemeToMain(isDark);
};

export const useThemeStore = create<ThemeStore>((set) => ({
  isDark: getInitialTheme(),
  toggleTheme: () => set((state) => {
    const newTheme = !state.isDark;
    applyTheme(newTheme);
    return { isDark: newTheme };
  }),
  setTheme: (dark) => {
    const isDark = typeof dark === 'boolean' ? dark : dark === 'dark';
    applyTheme(isDark);
    set({ isDark });
  },
}));