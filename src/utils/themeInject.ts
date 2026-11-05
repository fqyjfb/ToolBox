/**
 * 主题注入：主窗口（themeStore）与翻译浮层共用。
 * 浮层读不到主窗口 localStorage，靠主进程 theme.json 快照调用这里的同一套注入逻辑，
 * 保证深浅基色与自定义配色完全一致。
 */
import { CUSTOM_THEME_EFFECT_VARS, CUSTOM_THEME_VARS } from '../constants/theme';
import { CustomTheme, clampPercent, getDefaultTheme } from '../types/theme';

/**
 * 背景图 → CSS url()：只允许 data:image/ 与 http(s) 地址，并转义会破坏 url("…") 的字符。
 * 主题注入、设置页缩略图、局部预览、模式卡片共用，避免各处重复拼接。
 */
export const toCssUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed || !/^(data:image\/|https?:\/\/)/i.test(trimmed)) return 'none';
  const escaped = trimmed
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[()]/g, (char) => `\\${char}`)
    .replace(/[\r\n]/g, '');
  return `url("${escaped}")`;
};

/** 切换 .dark 基色 class */
export const applyBaseClass = (isDark: boolean) => {
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
};

/** 清理全部 --ct-* 注入与自定义标记 */
export const clearCustomThemeStyles = () => {
  const root = document.documentElement;
  for (const prop of Array.from(root.style)) {
    if (prop.startsWith('--ct-')) root.style.removeProperty(prop);
  }
  root.removeAttribute('data-custom-theme');
  document.body.removeAttribute('data-custom-bg');
};

/** 向 :root 注入全部 --ct-* 变量并激活覆盖层；未配置的可选字段回退到当前基色默认值 */
export const applyCustomTheme = (theme: CustomTheme, isDark: boolean) => {
  const base = getDefaultTheme(isDark);
  const root = document.documentElement;

  (Object.keys(CUSTOM_THEME_VARS) as (keyof typeof CUSTOM_THEME_VARS)[]).forEach((key) => {
    // 绝不注入空字符串：空值会让对应的 var() 解析失败，整条声明失效
    root.style.setProperty(CUSTOM_THEME_VARS[key], theme[key]?.trim() || base[key] || '');
  });

  root.style.setProperty(CUSTOM_THEME_EFFECT_VARS.bgImage, toCssUrl(theme.bgImage ?? ''));
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
