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

const applyTheme = (isDark: boolean) => {
  localStorageService.setString(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
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