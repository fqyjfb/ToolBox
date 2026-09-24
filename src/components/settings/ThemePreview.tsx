import React from 'react';
import { CustomTheme, clampPercent } from '../../types/theme';

interface ThemePreviewProps {
  /** 编辑器草稿：预览始终跟随草稿，所见即所得 */
  theme: CustomTheme;
}

/**
 * 实时预览：用草稿值直接构造内联样式，不依赖已保存的主题，
 * 因此用户未点保存时也能看到效果。
 */
const ThemePreview: React.FC<ThemePreviewProps> = ({ theme }) => {
  const opacity = `${clampPercent(theme.surfaceOpacity, 100)}%`;
  const surface = (color: string) => `color-mix(in srgb, ${color} ${opacity}, transparent)`;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: surface(theme.colorCard) }}
    >
      {/* 背景层预览：底色 + 图片 + 图片透明度 */}
      <div className="relative h-14" style={{ background: theme.bgColor }}>
        {theme.bgImage && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("${theme.bgImage}")`,
              backgroundSize: theme.bgSize,
              backgroundPosition: theme.bgPosition,
              backgroundRepeat: theme.bgRepeat,
              opacity: clampPercent(theme.bgOpacity, 100) / 100,
            }}
          />
        )}
      </div>

      <div className="p-3 space-y-1.5">
        <div className="text-sm font-semibold" style={{ color: theme.textColorPrimary }}>
          预览标题
        </div>
        <div className="text-xs" style={{ color: theme.textColorSecondary }}>
          次要说明文字
        </div>
        <div className="text-2xs" style={{ color: theme.textColorTertiary }}>
          弱化辅助文字
        </div>

        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {/* 按钮文字色走 --color-button-text（= 主背景色），与主色无关 */}
          <span
            className="text-2xs px-2 py-0.5 rounded"
            style={{ background: theme.colorPrimary, color: theme.colorBgPrimary }}
          >
            主按钮
          </span>
          <span
            className="text-2xs px-2 py-0.5 rounded"
            style={{ background: theme.colorPrimaryHover, color: theme.colorBgPrimary }}
          >
            按钮悬停
          </span>
          <span className="text-2xs px-2 py-0.5 rounded" style={{ background: theme.colorSecondary, color: '#FFFFFF' }}>
            次要
          </span>
          <span className="text-2xs px-2 py-0.5 rounded" style={{ background: theme.colorAccent, color: '#FFFFFF' }}>
            强调
          </span>
          <span className="text-2xs px-2 py-0.5 rounded" style={{ background: theme.colorSuccess, color: '#FFFFFF' }}>
            成功
          </span>
          <span className="text-2xs px-2 py-0.5 rounded" style={{ background: theme.colorError, color: '#FFFFFF' }}>
            错误
          </span>
        </div>

        <div
          className="text-2xs px-2 py-1 rounded"
          style={{ background: surface(theme.colorMenuHover), color: theme.textColorPrimary }}
        >
          菜单悬停项示意
        </div>

        {/* 开关预览 */}
        <div className="flex items-center gap-3 pt-1">
          {/* 关闭态 */}
          <div className="flex items-center gap-1.5">
            <div
              className="inline-flex items-center h-5 rounded-full w-9 transition-colors overflow-hidden"
              style={{ background: theme.switchBg ?? '#E4E4E7' }}
            >
              <div
                className="inline-block w-3 h-3 rounded-full transition-all"
                style={{
                  background: theme.switchThumb ?? '#FFFFFF',
                  transform: 'translateX(4px)',
                }}
              />
            </div>
            <span className="text-2xs" style={{ color: theme.textColorSecondary }}>关闭</span>
          </div>
          {/* 开启态 */}
          <div className="flex items-center gap-1.5">
            <div
              className="inline-flex items-center h-5 rounded-full w-9 transition-colors overflow-hidden"
              style={{ background: theme.switchActiveBg ?? '#18181B' }}
            >
              <div
                className="inline-block w-3 h-3 rounded-full transition-all"
                style={{
                  background: theme.switchActiveThumb ?? '#FFFFFF',
                  transform: 'translateX(20px)',
                }}
              />
            </div>
            <span className="text-2xs" style={{ color: theme.textColorSecondary }}>开启</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemePreview;
