import {
  BackgroundPosition,
  BackgroundRepeat,
  BackgroundSize,
  CustomTheme,
  CustomThemeColorFieldKey,
  ThemeColorGroup,
  getDefaultTheme,
} from '../types/theme';

/**
 * 主题字段 → CSS 自定义属性（--ct-*）映射。
 * JS 全量注入 --ct-*，theme.css 的覆盖层只做「裸 var(--ct-*)」接入，
 * 覆盖层里禁止写 var(--ct-x, var(--color-x)) 这类自引用 fallback（会形成循环引用）。
 */
export const CUSTOM_THEME_VARS: Record<CustomThemeColorFieldKey, string> = {
  bgColor: '--ct-bg-color',

  textColorPrimary: '--ct-text-primary',
  textColorSecondary: '--ct-text-secondary',
  textColorTertiary: '--ct-text-tertiary',

  colorBgPrimary: '--ct-bg-primary',
  colorBgSecondary: '--ct-bg-secondary',
  colorBgTertiary: '--ct-bg-tertiary',
  colorCard: '--ct-card',
  colorCardHover: '--ct-card-hover',
  colorSidebar: '--ct-sidebar',
  colorSidebarItem: '--ct-sidebar-item',
  colorSidebarItemActive: '--ct-sidebar-item-active',
  colorSidebarItemActiveText: '--ct-sidebar-item-active-text',
  colorSidebarItemText: '--ct-sidebar-item-text',
  colorMenuHover: '--ct-menu-hover',

  colorBorder: '--ct-border',
  colorBorderLight: '--ct-border-light',

  colorPrimary: '--ct-primary',
  colorPrimaryHover: '--ct-primary-hover',
  colorSecondary: '--ct-secondary',
  colorAccent: '--ct-accent',
  colorSuccess: '--ct-success',
  colorWarning: '--ct-warning',
  colorError: '--ct-error',
  colorInfo: '--ct-info',

  toastSuccessBg: '--ct-toast-success-bg',
  toastWarningBg: '--ct-toast-warning-bg',
  toastErrorBg: '--ct-toast-error-bg',
  toastInfoBg: '--ct-toast-info-bg',
  switchBg: '--ct-switch-bg',
  switchActiveBg: '--ct-switch-active-bg',
  switchThumb: '--ct-switch-thumb',
  switchActiveThumb: '--ct-switch-active-thumb',
  favorites: '--ct-favorites',
  favoritesHover: '--ct-favorites-hover',
  favoritesActive: '--ct-favorites-active',
  tooltipBg: '--ct-tooltip',
  tooltipText: '--ct-tooltip-text',
  tooltipBorder: '--ct-tooltip-border',

  colorMuted: '--ct-muted',
  colorCardValue: '--ct-card-value',
};

/** 非颜色字段的 --ct-* 变量（背景图层与透明度） */
export const CUSTOM_THEME_EFFECT_VARS = {
  bgImage: '--ct-bg-image',
  bgOpacity: '--ct-bg-opacity',
  bgSize: '--ct-bg-size',
  bgPosition: '--ct-bg-position',
  bgRepeat: '--ct-bg-repeat',
  surfaceOpacity: '--ct-surface-opacity',
} as const;

/** 页面底色不在分组内（单独渲染），说明文案同样集中在常量里便于维护 */
export const PAGE_BG_COLOR_DESC = '窗口最底层底色，背景图之下、半透明处透出的颜色';

/** 设置页自定义主题编辑器的分组配置（desc 说明该颜色作用到的组件，驱动渲染避免重复 JSX） */
export const THEME_COLOR_GROUPS: ThemeColorGroup[] = [
  {
    title: '文字颜色',
    fields: [
      { key: 'textColorPrimary', label: '主文字', desc: '标题、正文、输入框文字、图标按钮悬停态' },
      { key: 'textColorSecondary', label: '次要文字', desc: '副标题、说明文字、图标控制按钮、未选中导航' },
      { key: 'textColorTertiary', label: '弱化文字', desc: '占位提示、时间戳、禁用按钮与辅助信息' },
    ],
  },
  {
    title: '表面颜色',
    hint: '受表面透明度影响',
    fields: [
      { key: 'colorBgPrimary', label: '主背景', desc: '内容区、面板、表格底色，同时是按钮文字色' },
      { key: 'colorBgSecondary', label: '次背景', desc: '卡片头部、分组区、次级面板、次级按钮' },
      { key: 'colorBgTertiary', label: '三级背景', desc: '标签、未选中页签、侧栏容器' },
      { key: 'colorCard', label: '卡片', desc: '设置卡片、弹窗、下拉菜单、工具卡、次级按钮' },
      { key: 'colorCardHover', label: '卡片悬停', desc: '工具卡与列表项的鼠标悬停底色' },
      { key: 'colorMenuHover', label: '菜单悬停', desc: '用户菜单、右键菜单项与按钮悬停' },
    ],
  },
  {
    title: '侧边栏',
    hint: '独立配色区块，各项互不影响',
    fields: [
      { key: 'colorSidebar', label: '侧边栏背景', desc: '左侧主导航栏整体背景' },
      { key: 'colorSidebarItem', label: '侧栏项背景', desc: '侧边栏导航项（未选中）' },
      { key: 'colorSidebarItemActive', label: '侧栏激活背景', desc: '侧边栏当前选中项与标记条' },
      { key: 'colorSidebarItemActiveText', label: '侧栏激活文字', desc: '侧边栏选中项文字与图标颜色' },
      { key: 'colorSidebarItemText', label: '侧栏文字', desc: '侧边栏未选中项文字与图标颜色' },
    ],
  },
  {
    title: '边框颜色',
    fields: [
      { key: 'colorBorder', label: '边框', desc: '输入框、卡片、表格、分割线与描边按钮' },
      { key: 'colorBorderLight', label: '弱化边框', desc: '内部分隔线、次级描边' },
    ],
  },
  {
    title: '主色与按钮',
    hint: '按钮文字取主背景色，改主色时留意对比度',
    fields: [
      { key: 'colorPrimary', label: '主色', desc: '常规按钮、确认按钮、主操作按钮底色（全站用量最多）' },
      { key: 'colorPrimaryHover', label: '主色悬停', desc: '上述按钮鼠标悬停时的底色' },
    ],
  },
  {
    title: '强调色',
    hint: '链接、高亮与点缀',
    fields: [
      { key: 'colorSecondary', label: '次要', desc: '链接、进度条、选中态描边、渐变强调' },
      { key: 'colorAccent', label: '强调', desc: '日历今天、VIP 标识、收藏星标、高亮标签' },
    ],
  },
  {
    title: '状态色',
    hint: 'Toast 图标、状态标签、表单校验',
    fields: [
      { key: 'colorSuccess', label: '成功', desc: '成功提示、完成状态、成功按钮' },
      { key: 'colorWarning', label: '警告', desc: '警告提示、待处理状态' },
      { key: 'colorError', label: '错误', desc: '错误提示、删除按钮、必填校验' },
      { key: 'colorInfo', label: '信息', desc: '信息提示、说明气泡' },
    ],
  },
  {
    title: 'Toast 提示条',
    hint: '可选，留空跟随当前明暗预设',
    fields: [
      { key: 'toastSuccessBg', label: '成功', desc: '右上角成功提示条背景' },
      { key: 'toastWarningBg', label: '警告', desc: '右上角警告提示条背景' },
      { key: 'toastErrorBg', label: '错误', desc: '右上角错误提示条背景' },
      { key: 'toastInfoBg', label: '信息', desc: '右上角信息提示条背景' },
    ],
  },
  {
    title: '开关与收藏',
    hint: '可选，留空跟随当前明暗预设',
    fields: [
      { key: 'switchBg', label: '开关背景', desc: '开关关闭状态底色' },
      { key: 'switchActiveBg', label: '开关激活', desc: '开关开启状态底色' },
      { key: 'switchThumb', label: '开关圆点', desc: '关闭态圆点颜色' },
      { key: 'switchActiveThumb', label: '激活圆点', desc: '开启态圆点颜色' },
      { key: 'favorites', label: '收藏', desc: '收藏按钮、收藏夹图标默认态' },
      { key: 'favoritesHover', label: '收藏悬停', desc: '收藏按钮鼠标悬停态' },
      { key: 'favoritesActive', label: '收藏激活', desc: '已收藏图标与收藏视图激活态' },
    ],
  },
  {
    title: '提示框气泡',
    hint: '可选，留空跟随当前明暗预设',
    fields: [
      { key: 'tooltipBg', label: '气泡背景', desc: '网址导航卡片悬浮描述气泡底色' },
      { key: 'tooltipText', label: '气泡文字', desc: '上述气泡的文字色' },
      { key: 'tooltipBorder', label: '气泡边框', desc: '上述气泡的描边色' },
    ],
  },
  {
    title: '杂项颜色',
    hint: '可选，留空跟随当前明暗预设',
    fields: [
      { key: 'colorMuted', label: '弱文字', desc: '禁用态图标、次要统计数字、次要描述文字' },
      { key: 'colorCardValue', label: '卡片数值', desc: '统计面板大数字、存储用量等关键数值' },
    ],
  },
];

/** 背景图铺放方式下拉项（value 直接是 CSS 合法值） */
export const BACKGROUND_SIZE_OPTIONS: { value: BackgroundSize; label: string }[] = [
  { value: 'cover', label: '铺满' },
  { value: 'contain', label: '完整显示' },
  { value: 'auto', label: '原始尺寸' },
  { value: '100% 100%', label: '拉伸' },
];

export const BACKGROUND_POSITION_OPTIONS: { value: BackgroundPosition; label: string }[] = [
  { value: 'center', label: '居中' },
  { value: 'top', label: '顶部' },
  { value: 'bottom', label: '底部' },
  { value: 'left', label: '左侧' },
  { value: 'right', label: '右侧' },
  { value: 'left top', label: '左上' },
  { value: 'right top', label: '右上' },
  { value: 'left bottom', label: '左下' },
  { value: 'right bottom', label: '右下' },
];

export const BACKGROUND_REPEAT_OPTIONS: { value: BackgroundRepeat; label: string }[] = [
  { value: 'no-repeat', label: '不重复' },
  { value: 'repeat', label: '平铺' },
  { value: 'repeat-x', label: '横向重复' },
  { value: 'repeat-y', label: '纵向重复' },
];

export interface ThemePreset {
  id: string;
  name: string;
  /** 预设所属的明暗基色：决定未配置字段的兜底默认值 */
  base: 'light' | 'dark';
  patch: Partial<CustomTheme>;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'light-default', name: '浅色默认', base: 'light', patch: {} },
  { id: 'dark-default', name: '深色默认', base: 'dark', patch: {} },
  {
    id: 'morandi-light',
    name: '莫兰迪浅',
    base: 'light',
    patch: {
      bgColor: '#EDE8E4',
      colorBgPrimary: '#F2EDE9',
      colorBgSecondary: '#E5DFD9',
      colorBgTertiary: '#DCD5CC',
      colorCard: '#F7F3EF',
      colorCardHover: '#EDE7E1',
      colorSidebar: '#F2EDE9',
      colorSidebarItem: '#E5DFD9',
      colorSidebarItemActive: '#8C7B6B',
      colorSidebarItemActiveText: '#FFFFFF',
      colorSidebarItemText: '#3D3935',
      colorMenuHover: '#DCD5CC',
      colorBorder: '#D6CFC6',
      colorBorderLight: '#DDD7CE',
      textColorPrimary: '#3D3935',
      textColorSecondary: '#6E6862',
      textColorTertiary: '#9A938B',
      colorPrimary: '#4A443D',
      colorPrimaryHover: '#3A352F',
      colorSecondary: '#9C8B7A',
      colorAccent: '#B89978',
      colorSuccess: '#7C9885',
      colorWarning: '#C2A17B',
      colorError: '#B4796F',
      colorInfo: '#8A9AAB',
      toastSuccessBg: '#E7EFE6',
      toastWarningBg: '#F6EDE2',
      toastErrorBg: '#F7E8E6',
      toastInfoBg: '#E9EEF3',
      switchBg: '#D6CFC6',
      switchActiveBg: '#4A443D',
      switchThumb: '#FFFFFF',
      switchActiveThumb: '#FFFFFF',
      favorites: '#8C7B6B',
      favoritesHover: '#7A6B5C',
      favoritesActive: '#5F5346',
      tooltipBg: '#F7F3EF',
      tooltipText: '#3D3935',
      tooltipBorder: '#D6CFC6',
    },
  },
  {
    id: 'eye-green',
    name: '护眼绿',
    base: 'light',
    patch: {
      bgColor: '#C7E0B6',
      colorBgPrimary: '#EAF3E0',
      colorBgSecondary: '#DCEBCC',
      colorBgTertiary: '#CFE5BC',
      colorCard: '#F0F8E8',
      colorCardHover: '#E0EFD0',
      colorSidebar: '#EAF3E0',
      colorSidebarItem: '#DCEBCC',
      colorSidebarItemActive: '#5E8C4A',
      colorSidebarItemActiveText: '#FFFFFF',
      colorSidebarItemText: '#1F3D1A',
      colorMenuHover: '#CFE5BC',
      colorBorder: '#B8D49B',
      colorBorderLight: '#C4DCAD',
      textColorPrimary: '#1F3D1A',
      textColorSecondary: '#5A7A4F',
      textColorTertiary: '#86A07C',
      colorPrimary: '#3F6B2E',
      colorPrimaryHover: '#2F5222',
      colorSecondary: '#5E8C4A',
      colorAccent: '#C19044',
      colorSuccess: '#4F8A3D',
      colorWarning: '#C9973F',
      colorError: '#C25B4E',
      colorInfo: '#5B8FA8',
      toastSuccessBg: '#E3F2D8',
      toastWarningBg: '#FBEFD9',
      toastErrorBg: '#FBE4E0',
      toastInfoBg: '#E2EEF5',
      switchBg: '#B8D49B',
      switchActiveBg: '#3F6B2E',
      switchThumb: '#FFFFFF',
      switchActiveThumb: '#FFFFFF',
      favorites: '#5E8C4A',
      favoritesHover: '#4E7639',
      favoritesActive: '#3A5A2B',
      tooltipBg: '#F0F8E8',
      tooltipText: '#1F3D1A',
      tooltipBorder: '#B8D49B',
    },
  },
  {
    id: 'midnight-blue',
    name: '深夜蓝',
    base: 'dark',
    patch: {
      bgColor: '#0B1426',
      colorBgPrimary: '#13203A',
      colorBgSecondary: '#1A2A48',
      colorBgTertiary: '#243656',
      colorCard: '#1A2A48',
      colorCardHover: '#243656',
      colorSidebar: '#13203A',
      colorSidebarItem: '#1A2A48',
      colorSidebarItemActive: '#3B82F6',
      colorSidebarItemActiveText: '#FFFFFF',
      colorSidebarItemText: '#A3B5D0',
      colorMenuHover: '#2C4368',
      colorBorder: '#2A3D5E',
      colorBorderLight: '#243656',
      textColorPrimary: '#E5EFFB',
      textColorSecondary: '#A3B5D0',
      textColorTertiary: '#7A8AA6',
      colorPrimary: '#3B82F6',
      colorPrimaryHover: '#2563EB',
      colorSecondary: '#60A5FA',
      colorAccent: '#FBBF24',
      colorSuccess: '#34D399',
      colorWarning: '#FBBF24',
      colorError: '#F87171',
      colorInfo: '#60A5FA',
      toastSuccessBg: '#166534',
      toastWarningBg: '#92400E',
      toastErrorBg: '#991B1B',
      toastInfoBg: '#1E3A8A',
      switchBg: '#2A3D5E',
      switchActiveBg: '#3B82F6',
      switchThumb: '#FFFFFF',
      switchActiveThumb: '#FFFFFF',
      favorites: '#2DD4BF',
      favoritesHover: '#14B8A6',
      favoritesActive: '#0F766E',
      tooltipBg: '#1A2A48',
      tooltipText: '#E5EFFB',
      tooltipBorder: '#2A3D5E',
    },
  },
];

/** 基于预设所属基色生成完整主题配置 */
export const buildPresetTheme = (preset: ThemePreset): CustomTheme => ({
  ...getDefaultTheme(preset.base === 'dark'),
  ...preset.patch,
});
