import { create } from 'zustand';

interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean | 'light' | 'dark') => void;
}

// 从本地存储中获取主题设置，默认为浅色主题
const getInitialTheme = (): boolean => {
  try {
    const storedTheme = localStorage.getItem('toolbox_theme');
    if (storedTheme === 'dark') {
      return true;
    }
    const legacyTheme = localStorage.getItem('theme-isDark');
    return legacyTheme ? JSON.parse(legacyTheme) : false;
  } catch (error) {
    console.error('Error reading theme from localStorage:', error);
    return false;
  }
};

// 统一更新主题的函数
const applyTheme = (isDark: boolean) => {
  try {
    localStorage.setItem('toolbox_theme', isDark ? 'dark' : 'light');
  } catch (error) {
    console.error('Error saving theme to localStorage:', error);
  }
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }
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
