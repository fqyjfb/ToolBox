/**
 * 自定义主题数据模型
 *
 * 约定：
 * 1. 所有字段存储的都是「CSS 合法值」，颜色统一用 6 位 hex（input[type=color] 只接受 hex）；
 * 2. 该配置以 localStorage 为唯一持久化载体，自定义配色不进入 systemTheme 通道
 *    （systemTheme 只承载明暗基色，主进程 nativeTheme.themeSource 只接受 system/light/dark；
 *    配色通过 setThemeSnapshot 独立通道同步给锁屏等独立窗口）；
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
  colorSidebarItemActiveText: string;
  colorSidebarItemText: string;
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
  switchThumb?: string;
  switchActiveThumb?: string;
  favorites?: string;
  favoritesHover?: string;
  favoritesActive?: string;

  /** 浮层提示气泡：网址导航卡片悬浮描述框等 */
  tooltipBg?: string;
  tooltipText?: string;
  tooltipBorder?: string;

  /** 弱次要文字色：禁用态图标、次要统计数字 */
  colorMuted?: string;
  /** 卡片数值主色：统计面板大数字、重要状态值 */
  colorCardValue?: string;
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

/**
 * 同步给主进程的主题快照：仅颜色字段。
 * 背景图是可能达数 MB 的 data URI，而主进程侧（锁屏窗口）用不到，不进快照。
 */
export type CustomThemeColorSnapshot = Pick<CustomTheme, CustomThemeColorFieldKey>;

export interface ThemeColorField {
  key: CustomThemeColorFieldKey;
  label: string;
  /** 该颜色实际作用到的组件，展示在设置行末尾辅助配色 */
  desc: string;
}

export interface ThemeColorGroup {
  title: string;
  hint?: string;
  /** true = 高级颜色，编辑器默认折叠，字段留空时由 withThemeDefaults 自动派生 */
  advanced?: boolean;
  fields: ThemeColorField[];
}

/** 背景图片库条目（独立于 CustomTheme，用于多图管理） */
export interface BgImageItem {
  id: string;
  /** data URI（上传）或网络地址 */
  url: string;
  source: 'upload' | 'network';
  name: string;
}

/** localStorage 写入失败（配额不足）时 setCustomTheme 抛出的错误码 */
export const CUSTOM_THEME_STORAGE_FULL = 'CUSTOM_THEME_STORAGE_FULL';

export const BACKGROUND_SIZES: BackgroundSize[] = ['cover', 'contain', 'auto', '100% 100%'];
export const BACKGROUND_POSITIONS: BackgroundPosition[] = [
  'center', 'top', 'bottom', 'left', 'right', 'left top', 'right top', 'left bottom', 'right bottom',
];
export const BACKGROUND_REPEATS: BackgroundRepeat[] = ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'];

const getDefaultLightTheme = (): CustomTheme => ({
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
  colorSidebarItemActive: '#e9f5ff',
  colorSidebarItemActiveText: '#0f766e',
  colorSidebarItemText: '#18181B',
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

  // 与 theme.css 明暗预设保持等价，启用自定义主题时不跳色
  toastSuccessBg: '#F0FDF4',
  toastWarningBg: '#FFFBEB',
  toastErrorBg: '#FEF2F2',
  toastInfoBg: '#EFF6FF',
  switchBg: '#E4E4E7',
  switchActiveBg: '#18181B',
  switchThumb: '#FFFFFF',
  switchActiveThumb: '#FFFFFF',
  favorites: '#009F9B',
  favoritesHover: '#008A86',
  favoritesActive: '#156479',
  // 预设的 --color-tooltip 为 95% 半透明，取色器只接受 6 位 hex，
  // 这里用等效不透明色（气泡本身带 backdrop-filter，观感基本一致）
  tooltipBg: '#FFFFFF',
  tooltipText: '#111827',
  tooltipBorder: '#FFFFFF',

  colorMuted: '#9ca3af',
  colorCardValue: '#111827',
});

const getDefaultDarkTheme = (): CustomTheme => ({
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
  colorSidebarItemActive: '#1e3a5f',
  colorSidebarItemActiveText: '#FFFFFF',
  colorSidebarItemText: '#94A3B8',
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

  // 预设的深色 Toast 底色是 8 位半透明 hex；取色器只接受 6 位 hex，
  // 这里用等效不透明色，文字 / 边框仍由覆盖层按底色派生
  toastSuccessBg: '#166534',
  toastWarningBg: '#92400E',
  toastErrorBg: '#991B1B',
  toastInfoBg: '#1E40AF',
  switchBg: '#2D3139',
  switchActiveBg: '#EAF1F8',
  switchThumb: '#FFFFFF',
  switchActiveThumb: '#FFFFFF',
  // 深色预设里的 favorites 是 rgba 半透明，取色器无法显示；
  // 自定义主题统一用等效 hex 表达，保证取色器可用。
  favorites: '#0E7A76',
  favoritesHover: '#0B6965',
  favoritesActive: '#156479',
  tooltipBg: '#1F2937',
  tooltipText: '#F9FAFB',
  tooltipBorder: '#1F2937',

  colorMuted: '#6b7280',
  colorCardValue: '#E5E7EB',
});

export const getDefaultTheme = (isDark: boolean): CustomTheme =>
  (isDark ? getDefaultDarkTheme() : getDefaultLightTheme());

/** 0-100 安全取整，非法值回退到 fallback */
export const clampPercent = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
};

/** 字符串字段中不属于颜色的：背景图 data URI / 网络地址，不参与颜色校验 */
const NON_COLOR_STRING_KEYS = new Set<keyof CustomTheme>(['bgImage']);

/**
 * 规范化单个颜色值：合法 CSS 颜色原样返回，非法值（含输入中的半成品 "#F2"）回退到默认值。
 * 空串表示「使用当前明暗默认值」，语义交给调用方处理。
 * 预览、保存、导入、启动四条路径共用，保证所见即所得。
 */
export const normalizeThemeColor = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const isValid = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    ? CSS.supports('color', trimmed)
    : /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed);
  return isValid ? trimmed : fallback;
};

/** #RRGGBB → [r,g,b]；非 6 位 hex（rgba / 8 位 / 3 位）返回 null，交由调用方回退 */
const parseHex = (hex: string): [number, number, number] | null => {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** 线性插值两个 #RRGGBB 颜色，t 为 b 的占比；任一非法返回 null。输出 6 位 hex 保证取色器可用 */
const mixHex = (a: string, b: string, t: number): string | null => {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return null;
  const ch = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${ch(ca[0] + (cb[0] - ca[0]) * t)}${ch(ca[1] + (cb[1] - ca[1]) * t)}${ch(ca[2] + (cb[2] - ca[2]) * t)}`;
};

/** 近似相对亮度（0~1），用于高亮主色圆点的对比色选择 */
const relativeLuminance = (hex: string): number => {
  const c = parseHex(hex);
  if (!c) return 0;
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
};

/**
 * 高级区字段留空（用户清除 / 未配置）时按既有字段派生，减少需手调项。
 * 仅改写 pending（用户显式空串）字段；已配置字段原样保留，确保旧配置升级零变化。
 * 依赖顺序：先解析基础字段，再派生其下游（如 次背景 → 三级背景）。
 */
const applyDerivedColors = (
  merged: CustomTheme,
  base: CustomTheme,
  pending: Set<keyof CustomTheme>,
  isDark: boolean,
): void => {
  const derive = (key: keyof CustomTheme, value: string | null) => {
    if (!pending.has(key)) return;
    const resolved = value ?? base[key];
    if (typeof resolved === 'string' && resolved) merged[key] = resolved as never;
  };

  // 表面细节
  derive('colorBgSecondary', mixHex(merged.colorBgPrimary, merged.textColorPrimary, 0.05));
  derive('colorBgTertiary', mixHex(merged.colorBgSecondary, merged.textColorPrimary, 0.06));
  derive('colorCardHover', mixHex(merged.colorCard, merged.textColorPrimary, 0.08));
  derive('colorMenuHover', mixHex(merged.colorBgPrimary, merged.textColorPrimary, 0.11));
  derive('colorBorderLight', mixHex(merged.colorBorder, merged.colorBgPrimary, 0.5));
  // 侧边栏细节
  derive('colorSidebarItem', mixHex(merged.colorSidebar, merged.colorBorder, 0.5));
  derive('colorSidebarItemText', mixHex(merged.textColorPrimary, merged.textColorSecondary, 0.38));
  // 杂项
  derive('colorMuted', merged.textColorTertiary);
  derive('colorCardValue', merged.textColorPrimary);
  // 开关
  derive('switchBg', merged.colorBorder);
  derive('switchActiveBg', merged.colorPrimary);
  derive('switchActiveThumb', relativeLuminance(merged.colorPrimary) >= 0.6 ? '#1F2430' : '#FFFFFF');
  // Toast 底色：按明暗基色方向混黑白，近似预设深色档
  const toastTarget = isDark ? '#000000' : '#FFFFFF';
  const toastRatio = isDark ? 0.55 : 0.78;
  derive('toastSuccessBg', mixHex(merged.colorSuccess, toastTarget, toastRatio));
  derive('toastWarningBg', mixHex(merged.colorWarning, toastTarget, toastRatio));
  derive('toastErrorBg', mixHex(merged.colorError, toastTarget, toastRatio));
  derive('toastInfoBg', mixHex(merged.colorInfo, toastTarget, toastRatio));
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
  const pending = new Set<keyof CustomTheme>();
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
          if (typeof value === 'string' && value.trim() === '') {
            if (NON_COLOR_STRING_KEYS.has(key)) {
              // 背景图空串 = 不使用图片，保持空（不参与派生）
              merged[key] = '' as never;
            } else {
              // 颜色字段空串 = 留空待派生（见 applyDerivedColors），避免存储残留空值
              pending.add(key);
            }
          } else if (typeof value === 'string' && !NON_COLOR_STRING_KEYS.has(key)) {
            merged[key] = normalizeThemeColor(value, (base[key] as string) ?? '') as never;
          } else {
            merged[key] = value as never;
          }
        }
    }
  });

  applyDerivedColors(merged, base, pending, isDark);
  return merged;
};
