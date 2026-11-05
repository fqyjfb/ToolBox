import React from 'react';
import { CustomTheme, clampPercent, getDefaultTheme } from '../../types/theme';
import { toCssUrl } from '../../utils/themeInject';

interface ThemePreviewProps {
  /** 编辑器草稿：预览始终跟随草稿，所见即所得 */
  theme: CustomTheme;
  /** 草稿的明暗基色：可选字段留空时按它取默认值，与 applyCustomTheme 的兜底口径一致 */
  isDark: boolean;
}

/**
 * 实时预览：只用草稿值构造内联样式，取色器留空 / 半输入状态统一按当前明暗预设兜底，
 * 颜色口径与全站 --color-button-text / 覆盖层保持一致。
 */
const ThemePreview: React.FC<ThemePreviewProps> = ({ theme, isDark }) => {
  const base = getDefaultTheme(isDark);
  const opacity = `${clampPercent(theme.surfaceOpacity, 100)}%`;

  const pick = (key: keyof CustomTheme): string => {
    const value = theme[key];
    const fallback = base[key];
    return (typeof value === 'string' && value.trim()) ||
      (typeof fallback === 'string' ? fallback : '');
  };
  const surface = (key: keyof CustomTheme) =>
    `color-mix(in srgb, ${pick(key)} ${opacity}, transparent)`;
  const buttonText = pick('colorBgPrimary');

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: surface('colorCard') }}
    >
      {/* 背景层预览：底色 + 图片 + 图片透明度 */}
      <div className="relative h-14" style={{ background: pick('bgColor') }}>
        {theme.bgImage && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: toCssUrl(theme.bgImage),
              backgroundSize: theme.bgSize,
              backgroundPosition: theme.bgPosition,
              backgroundRepeat: theme.bgRepeat,
              opacity: clampPercent(theme.bgOpacity, 100) / 100,
            }}
          />
        )}
      </div>

      <div className="p-3 space-y-1.5">
        <div className="text-sm font-semibold" style={{ color: pick('textColorPrimary') }}>
          预览标题
        </div>
        <div className="text-xs" style={{ color: pick('textColorSecondary') }}>
          次要说明文字
        </div>
        <div className="text-2xs" style={{ color: pick('textColorTertiary') }}>
          弱化辅助文字
        </div>

        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {/* 按钮文字色取主背景色（--color-button-text 口径），与主色无关 */}
          <span
            className="text-2xs px-2 py-0.5 rounded"
            style={{ background: pick('colorPrimary'), color: buttonText }}
          >
            主按钮
          </span>
          <span
            className="text-2xs px-2 py-0.5 rounded"
            style={{ background: pick('colorPrimaryHover'), color: buttonText }}
          >
            按钮悬停
          </span>
          <span className="text-2xs px-2 py-0.5 rounded" style={{ background: pick('colorSecondary'), color: buttonText }}>
            次要
          </span>
          <span className="text-2xs px-2 py-0.5 rounded" style={{ background: pick('colorAccent'), color: buttonText }}>
            强调
          </span>
          <span className="text-2xs px-2 py-0.5 rounded" style={{ background: pick('colorSuccess'), color: buttonText }}>
            成功
          </span>
          <span className="text-2xs px-2 py-0.5 rounded" style={{ background: pick('colorError'), color: buttonText }}>
            错误
          </span>
        </div>

        <div
          className="text-2xs px-2 py-1 rounded"
          style={{ background: surface('colorMenuHover'), color: pick('textColorPrimary') }}
        >
          菜单悬停项示意
        </div>

        {/* 开关预览 */}
        <div className="flex items-center gap-3 pt-1">
          <div className="flex items-center gap-1.5">
            <div
              className="inline-flex items-center h-5 rounded-full w-9 transition-colors overflow-hidden"
              style={{ background: pick('switchBg') }}
            >
              <div
                className="inline-block w-3 h-3 rounded-full transition-all"
                style={{ background: pick('switchThumb'), transform: 'translateX(4px)' }}
              />
            </div>
            <span className="text-2xs" style={{ color: pick('textColorSecondary') }}>关闭</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="inline-flex items-center h-5 rounded-full w-9 transition-colors overflow-hidden"
              style={{ background: pick('switchActiveBg') }}
            >
              <div
                className="inline-block w-3 h-3 rounded-full transition-all"
                style={{ background: pick('switchActiveThumb'), transform: 'translateX(20px)' }}
              />
            </div>
            <span className="text-2xs" style={{ color: pick('textColorSecondary') }}>开启</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemePreview;
