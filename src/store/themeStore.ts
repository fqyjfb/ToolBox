import { create } from 'zustand';

interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
}

// 从本地存储中获取主题设置，默认为浅色主题
const getInitialTheme = (): boolean => {
  try {
    const storedTheme = localStorage.getItem('theme-isDark');
    return storedTheme ? JSON.parse(storedTheme) : false;
  } catch (error) {
    console.error('Error reading theme from localStorage:', error);
    return false;
  }
};

export const useThemeStore = create<ThemeStore>((set) => ({
  isDark: getInitialTheme(), // 默认使用浅色主题
  toggleTheme: () => set((state) => {
    const newTheme = !state.isDark;
    // 保存到本地存储
    try {
      localStorage.setItem('theme-isDark', JSON.stringify(newTheme));
    } catch (error) {
      console.error('Error saving theme to localStorage:', error);
    }
    return { isDark: newTheme };
  }),
  setTheme: (dark) => {
    // 保存到本地存储
    try {
      localStorage.setItem('theme-isDark', JSON.stringify(dark));
    } catch (error) {
      console.error('Error saving theme to localStorage:', error);
    }
    set({ isDark: dark });
  },
}));
