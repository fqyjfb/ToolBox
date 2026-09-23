import { create } from 'zustand';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';
import {
  CUSTOM_THEME_STORAGE_FULL,
  CustomTheme,
  clampPercent,
  getDefaultTheme,
  withThemeDefaults,
} from '../types/theme';
import { CUSTOM_THEME_EFFECT_VARS, CUSTOM_THEME_VARS } from '../constants/theme';

interface ThemeStore {
  /** 明暗基色（true = dark），自定义模式下仍然有效：主进程 / 托盘 / 悬浮球只感知它 */
  isDark: boolean;
  /** 当前是否处于自定义主题模式 */
  isCustomTheme: boolean;
  /** 最近一次保存的自定义主题配置；退出自定义模式时保留，便于再次启用 */
  customTheme: CustomTheme | null;
  /** 主题变更计数器，每次主题状态变更时递增；用于强制订阅组件重渲染 */
  themeKey: number;
  toggleTheme: () => void;
  /** 切换到明暗预设（会退出自定义模式，但保留 customTheme 配置） */
  setTheme: (dark: boolean | 'light' | 'dark') => void;
  /** 仅切换明暗基色，不改变自定义模式的激活状态（预设模板跨基色时使用） */
  setBaseTheme: (dark: boolean | 'light' | 'dark') => void;
  /** 保存并立即激活自定义主题 */
  setCustomTheme: (theme: CustomTheme) => void;
  /** 删除自定义主题配置并切回当前明暗预设 */
  deleteCustomTheme: () => void;
}

const toIsDark = (dark: boolean | 'light' | 'dark'): boolean =>
  typeof dark === 'boolean' ? dark : dark === 'dark';

const getInitialTheme = (): boolean => {
  if (localStorageService.getString(STORAGE_KEYS.THEME) === 'dark') return true;
  // 兼容旧版本写入的 theme-isDark
  return localStorageService.getString('theme-isDark') === 'true';
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

const applyBaseClass = (isDark: boolean) => {
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
};

const persistMode = (isCustomTheme: boolean, isDark: boolean) => {
  localStorageService.setString(
    STORAGE_KEYS.THEME,
    isCustomTheme ? 'custom' : isDark ? 'dark' : 'light',
  );
};

const clearCustomThemeStyles = () => {
  const root = document.documentElement;
  for (const prop of Array.from(root.style)) {
    if (prop.startsWith('--ct-')) root.style.removeProperty(prop);
  }
  root.removeAttribute('data-custom-theme');
  document.body.removeAttribute('data-custom-bg');
};

/** 向 :root 注入全部 --ct-* 变量并激活覆盖层；未配置的可选字段回退到当前基色默认值 */
const applyCustomTheme = (theme: CustomTheme, isDark: boolean) => {
  const base = getDefaultTheme(isDark);
  const root = document.documentElement;

  (Object.keys(CUSTOM_THEME_VARS) as (keyof typeof CUSTOM_THEME_VARS)[]).forEach((key) => {
    // 绝不注入空字符串：空值会让对应的 var() 解析失败，整条声明失效
    root.style.setProperty(CUSTOM_THEME_VARS[key], theme[key]?.trim() || base[key] || '');
  });

  root.style.setProperty(
    CUSTOM_THEME_EFFECT_VARS.bgImage,
    theme.bgImage ? `url("${theme.bgImage}")` : 'none',
  );
  root.style.setProperty(CUSTOM_THEME_EFFECT_VARS.bgOpacity, String(clampPercent(theme.bgOpacity, 100) / 100));
  root.style.setProperty(CUSTOM_THEME_EFFECT_VARS.bgSize, theme.bgSize);
  root.style.setProperty(CUSTOM_THEME_EFFECT_VARS.bgPosition, theme.bgPosition);
  root.style.setProperty(CUSTOM_THEME_EFFECT_VARS.bgRepeat, theme.bgRepeat);
  // color-mix() 的百分比必须带 %
  root.style.setProperty(
    CUSTOM_THEME_EFFECT_VARS.surfaceOpacity,
    `${clampPercent(theme.surfaceOpacity, 100)}%`,
  );

  root.setAttribute('data-custom-theme', 'active');
  document.body.setAttribute('data-custom-bg', 'true');
};

/** 切回明暗预设：清理自定义注入，但保留已保存的配置，允许用户再次启用 */
const switchToPreset = (isDark: boolean) => {
  clearCustomThemeStyles();
  applyBaseClass(isDark);
  persistMode(false, isDark);
  syncThemeToMain(isDark);
};

// ── 模块级初始化（先于 React 首帧执行，避免主题闪烁）──
const initialIsDark = getInitialTheme();
applyBaseClass(initialIsDark);

const storedCustomTheme = localStorageService.get<CustomTheme | null>(STORAGE_KEYS.CUSTOM_THEME, null);
const initialCustomTheme = storedCustomTheme ? withThemeDefaults(storedCustomTheme, initialIsDark) : null;
const initialIsCustom =
  initialCustomTheme !== null && localStorageService.getString(STORAGE_KEYS.THEME) === 'custom';

if (initialIsCustom && initialCustomTheme) {
  applyCustomTheme(initialCustomTheme, initialIsDark);
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: initialIsDark,
  isCustomTheme: initialIsCustom,
  customTheme: initialCustomTheme,
  // 初始 themeKey：自定义模式启用时为 1（让订阅组件能感知到初始自定义状态），否则为 0
  themeKey: initialIsCustom ? 1 : 0,

  toggleTheme: () => set((state) => {
    const isDark = !state.isDark;
    switchToPreset(isDark);
    return { isDark, isCustomTheme: false, themeKey: state.themeKey + 1 };
  }),

  setTheme: (dark) => {
    const isDark = toIsDark(dark);
    switchToPreset(isDark);
    set({ isDark, isCustomTheme: false, themeKey: get().themeKey + 1 });
  },

  setBaseTheme: (dark) => {
    const isDark = toIsDark(dark);
    const { isDark: currentIsDark, isCustomTheme, customTheme } = get();
    if (isDark === currentIsDark) return;

    applyBaseClass(isDark);
    syncThemeToMain(isDark);
    // 未配置的可选字段按新基色重新兜底
    if (isCustomTheme && customTheme) applyCustomTheme(customTheme, isDark);
    persistMode(isCustomTheme, isDark);
    set({ isDark, themeKey: get().themeKey + 1 });
  },

  setCustomTheme: (theme) => {
    if (!localStorageService.set(STORAGE_KEYS.CUSTOM_THEME, theme)) {
      throw new Error(CUSTOM_THEME_STORAGE_FULL);
    }
    const isDark = get().isDark;
    applyCustomTheme(theme, isDark);
    persistMode(true, isDark);
    set({ customTheme: theme, isCustomTheme: true, themeKey: get().themeKey + 1 });
  },

  deleteCustomTheme: () => {
    localStorageService.remove(STORAGE_KEYS.CUSTOM_THEME);
    switchToPreset(get().isDark);
    set({ customTheme: null, isCustomTheme: false, themeKey: get().themeKey + 1 });
  },
}));
