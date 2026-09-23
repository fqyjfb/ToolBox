/**
 * 自定义主题数据模型
 *
 * 约定：
 * 1. 所有字段存储的都是「CSS 合法值」，颜色统一用 6 位 hex（input[type=color] 只接受 hex）；
 * 2. 该配置以 localStorage 为唯一持久化载体，不进入 systemTheme 通道
 *    （主进程 nativeTheme.themeSource 只接受 system/light/dark）；
 * 3. 明暗基色（dark class）与自定义配色解耦：主进程 / 托盘 / 悬浮球只感知明暗基色。
 */

export type BackgroundSize = 'cover' | 'contain' | 'auto' | '100% 100%';
export type BackgroundPosition =
  | 'center' | 'top' | 'bottom' | 'left' | 'right'
  | 'left top' | 'right top' | 'left bottom' | 'right bottom';
export type BackgroundRepeat = 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';

export interface CustomTheme {
  /** 页面底色（背景图之下） */
  bgColor: string;
  /** 背景图 data URI，空字符串 = 不使用图片 */
  bgImage: string;
  /** 0-100，只作用于背景图片层 */
  bgOpacity: number;
  bgSize: BackgroundSize;
  bgPosition: BackgroundPosition;
  bgRepeat: BackgroundRepeat;

  textColorPrimary: string;
  textColorSecondary: string;
  textColorTertiary: string;

  colorBgPrimary: string;
  colorBgSecondary: string;
  colorBgTertiary: string;
  colorCard: string;
  colorCardHover: string;
  colorSidebar: string;
  colorSidebarItem: string;
  colorSidebarItemActive: string;
  colorMenuHover: string;

  colorBorder: string;
  colorBorderLight: string;

  /**
   * 主色：全站用量最多的按钮底色（Tailwind bg-primary → var(--color-primary)）。
   * 按钮文字色走 --color-button-text（= 主背景色），不跟随主色，需另行保证对比度。
   */
  colorPrimary: string;
  /** 主色悬停：主按钮 hover 态底色 */
  colorPrimaryHover: string;
  colorSecondary: string;
  colorAccent: string;
  colorSuccess: string;
  colorWarning: string;
  colorError: string;
  colorInfo: string;

  /** 0-100，卡片 / 侧边栏 / 菜单等「表面色」与底色的混合比例 */
  surfaceOpacity: number;

  /** 以下为可选字段：留空时由 themeStore 按当前明暗基色注入默认值 */
  toastSuccessBg?: string;
  toastWarningBg?: string;
  toastErrorBg?: string;
  toastInfoBg?: string;
  switchBg?: string;
  switchActiveBg?: string;
  favorites?: string;
  favoritesHover?: string;
  favoritesActive?: string;

  /** 浮层提示气泡：网址导航卡片悬浮描述框等 */
  tooltipBg?: string;
  tooltipText?: string;
  tooltipBorder?: string;
}

/**
 * CustomTheme 中所有字符串字段的 key 联合类型。
 * `-?` 去掉可选修饰符、`NonNullable` 排除 undefined，
 * 否则同态映射会保留 `?`，索引结果里会混入 undefined。
 */
export type CustomThemeColorKey = {
  [K in keyof CustomTheme]-?: NonNullable<CustomTheme[K]> extends string ? K : never;
}[keyof CustomTheme];

/** 非颜色的字符串字段：背景图与铺放方式，由上传控件 / 下拉框单独处理 */
export type CustomThemeLayoutKey = 'bgImage' | 'bgSize' | 'bgPosition' | 'bgRepeat';

/** 绑定取色器的颜色字段 */
export type CustomThemeColorFieldKey = Exclude<CustomThemeColorKey, CustomThemeLayoutKey>;

export interface ThemeColorField {
  key: CustomThemeColorFieldKey;
  label: string;
  /** 该颜色实际作用到的组件，展示在设置行末尾辅助配色 */
  desc: string;
}

export interface ThemeColorGroup {
  title: string;
  hint?: string;
  fields: ThemeColorField[];
}

/** localStorage 写入失败（配额不足）时 setCustomTheme 抛出的错误码 */
export const CUSTOM_THEME_STORAGE_FULL = 'CUSTOM_THEME_STORAGE_FULL';

export const BACKGROUND_SIZES: BackgroundSize[] = ['cover', 'contain', 'auto', '100% 100%'];
export const BACKGROUND_POSITIONS: BackgroundPosition[] = [
  'center', 'top', 'bottom', 'left', 'right', 'left top', 'right top', 'left bottom', 'right bottom',
];
export const BACKGROUND_REPEATS: BackgroundRepeat[] = ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'];

export const getDefaultLightTheme = (): CustomTheme => ({
  bgColor: '#F7F8FB',
  bgImage: '',
  bgOpacity: 100,
  bgSize: 'cover',
  bgPosition: 'center',
  bgRepeat: 'no-repeat',

  textColorPrimary: '#18181B',
  textColorSecondary: '#71717A',
  textColorTertiary: '#A1A1AA',

  colorBgPrimary: '#FFFFFF',
  colorBgSecondary: '#F4F4F5',
  colorBgTertiary: '#F4F4F5',
  colorCard: '#FFFFFF',
  colorCardHover: '#F9FAFB',
  colorSidebar: '#FFFFFF',
  colorSidebarItem: '#F4F4F5',
  colorSidebarItemActive: '#3B82F6',
  colorMenuHover: '#E4E4E7',

  colorBorder: '#E4E4E7',
  colorBorderLight: '#E4E4E7',

  colorPrimary: '#18181B',
  colorPrimaryHover: '#111113',
  colorSecondary: '#3B82F6',
  colorAccent: '#F59E0B',
  colorSuccess: '#22C55E',
  colorWarning: '#F59E0B',
  colorError: '#EF4444',
  colorInfo: '#3B82F6',

  surfaceOpacity: 100,

  toastSuccessBg: '#EDFBD8',
  toastWarningBg: '#FEFCE8',
  toastErrorBg: '#FEF2F2',
  toastInfoBg: '#EFF6FF',
  switchBg: '#E4E4E7',
  switchActiveBg: '#18181B',
  favorites: '#009F9B',
  favoritesHover: '#008A86',
  favoritesActive: '#156479',
  // 预设的 --color-tooltip 为 95% 半透明，取色器只接受 6 位 hex，
  // 这里用等效不透明色（气泡本身带 backdrop-filter，观感基本一致）
  tooltipBg: '#FFFFFF',
  tooltipText: '#111827',
  tooltipBorder: '#FFFFFF',
});

export const getDefaultDarkTheme = (): CustomTheme => ({
  bgColor: '#0C131A',
  bgImage: '',
  bgOpacity: 100,
  bgSize: 'cover',
  bgPosition: 'center',
  bgRepeat: 'no-repeat',

  textColorPrimary: '#EAF1F8',
  textColorSecondary: '#94A3B8',
  textColorTertiary: '#64748B',

  colorBgPrimary: '#16181D',
  colorBgSecondary: '#1A1D23',
  colorBgTertiary: '#262A33',
  colorCard: '#1A1D23',
  colorCardHover: '#262A33',
  colorSidebar: '#1A1D23',
  colorSidebarItem: '#262A33',
  colorSidebarItemActive: '#EAF1F8',
  colorMenuHover: '#2D3139',

  colorBorder: '#2D3139',
  colorBorderLight: '#2D3139',

  colorPrimary: '#EAF1F8',
  colorPrimaryHover: '#CBD5E1',
  colorSecondary: '#60A5FA',
  colorAccent: '#FBBF24',
  colorSuccess: '#22C55E',
  colorWarning: '#FBBF24',
  colorError: '#F87171',
  colorInfo: '#60A5FA',

  surfaceOpacity: 100,

  toastSuccessBg: '#166534',
  toastWarningBg: '#92400E',
  toastErrorBg: '#991B1B',
  toastInfoBg: '#1E40AF',
  switchBg: '#2D3139',
  switchActiveBg: '#EAF1F8',
  // 深色预设里的 favorites 是 rgba 半透明，取色器无法显示；
  // 自定义主题统一用等效 hex 表达，保证取色器可用。
  favorites: '#0E7A76',
  favoritesHover: '#0B6965',
  favoritesActive: '#156479',
  tooltipBg: '#1F2937',
  tooltipText: '#F9FAFB',
  tooltipBorder: '#1F2937',
});

export const getDefaultTheme = (isDark: boolean): CustomTheme =>
  (isDark ? getDefaultDarkTheme() : getDefaultLightTheme());

/** 0-100 安全取整，非法值回退到 fallback */
export const clampPercent = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
};

const BACKGROUND_VALUES = new Set<string>([
  ...BACKGROUND_SIZES,
  ...BACKGROUND_POSITIONS,
  ...BACKGROUND_REPEATS,
]);

/**
 * 用当前明暗基色的默认值补全（并校验）一份可能不完整的主题配置。
 * 用于导入 JSON、读取历史 localStorage 数据等场景，避免非法值写回导致样式失效。
 */
export const withThemeDefaults = (
  partial: Partial<CustomTheme> | null | undefined,
  isDark: boolean,
): CustomTheme => {
  const base = getDefaultTheme(isDark);
  if (!partial || typeof partial !== 'object') return base;

  const merged: CustomTheme = { ...base };
  (Object.keys(base) as (keyof CustomTheme)[]).forEach((key) => {
    const value = partial[key];
    if (value === undefined || value === null) return;

    switch (key) {
      case 'bgOpacity':
      case 'surfaceOpacity':
        merged[key] = clampPercent(Number(value), base[key]);
        return;
      case 'bgSize':
      case 'bgPosition':
      case 'bgRepeat':
        // 只允许 CSS 合法枚举值，否则整条 background 声明会失效
        if (typeof value === 'string' && BACKGROUND_VALUES.has(value)) {
          merged[key] = value as never;
        }
        return;
      default:
        if (typeof value === typeof base[key]) {
          merged[key] = value as never;
        }
    }
  });

  return merged;
};
