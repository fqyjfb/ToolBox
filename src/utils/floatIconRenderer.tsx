import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HelpCircle, type LucideIcon } from 'lucide-react';
import { NAV_ACTIONS, SYSTEM_ACTIONS } from '../constants/settings';
import { ALL_TOOLS } from '../constants/tools';
import { iconMap } from './iconMap';

// 悬浮窗功能图标统一蓝色：与既有图标集一致，在白/深色菜单项与深色预览球上均可清晰显示
const FLOAT_ICON_COLOR = '#00A2FF';
const FLOAT_ICON_SIZE = 24;

/**
 * 将应用内 lucide 图标序列化为蓝色 SVG data URI。
 * 悬浮窗主进程端无法复用 React 图标组件，data URI 可被设置页预览与
 * float.cjs 的 <img> 分支统一渲染，使所选功能始终复用其原有图标。
 */
export const lucideIconToDataUrl = (Icon: LucideIcon): string => {
  const svgMarkup = renderToStaticMarkup(
    <Icon width={FLOAT_ICON_SIZE} height={FLOAT_ICON_SIZE} style={{ color: FLOAT_ICON_COLOR }} />
  );
  return `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`;
};

/**
 * 依据类型与已选目标解析功能原有图标；尚未选择时回退到该类型的首个可选项，
 * 保证导航/工具/系统三类配置始终有确定的对应图标。
 */
export const getTargetIcon = (type: string, action: string): string => {
  if (type === 'nav') {
    const target = NAV_ACTIONS.find(item => item.action === action) || NAV_ACTIONS[0];
    return lucideIconToDataUrl(target.icon);
  }
  if (type === 'system') {
    const target = SYSTEM_ACTIONS.find(item => item.action === action) || SYSTEM_ACTIONS[0];
    return lucideIconToDataUrl(target.icon);
  }
  if (type === 'tool') {
    const tool = ALL_TOOLS.find(item => item.id === action) || ALL_TOOLS[0];
    const Icon = iconMap[tool.iconName] || iconMap.Package;
    return lucideIconToDataUrl(Icon);
  }
  return '';
};

export const isPluginIcon = (icon: string): boolean => {
  return !!icon && icon.startsWith('plugin:');
};

export const getPluginIconId = (icon: string): string => {
  if (!isPluginIcon(icon)) return '';
  return icon.substring(7);
};

export const formatIconSrc = (icon: string): string | null => {
  if (icon.startsWith('data:image/')) {
    return icon;
  }
  if (icon && icon.length > 100 && !icon.includes(' ')) {
    return `data:image/png;base64,${icon}`;
  }
  return null;
};

export interface FloatIconRenderResult {
  element: React.ReactNode;
  isImg: boolean;
  iconSrc: string | null;
  isPlugin: boolean;
  pluginId: string;
}

export const renderFloatIcon = (
  icon: string,
  size: number = 18
): FloatIconRenderResult => {
  const isPlugin = isPluginIcon(icon);
  if (isPlugin) {
    // 插件图标由 FloatIconView 经插件地址解析；这里仅提供等待/兜底元素
    return {
      element: <HelpCircle size={size} />,
      isImg: false,
      iconSrc: null,
      isPlugin: true,
      pluginId: getPluginIconId(icon)
    };
  }

  const iconSrc = formatIconSrc(icon);
  if (iconSrc) {
    return {
      element: (
        <img
          loading="lazy"
          src={iconSrc}
          alt=""
          style={{ width: size, height: size, objectFit: 'contain', borderRadius: '4px' }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ),
      isImg: true,
      iconSrc,
      isPlugin: false,
      pluginId: ''
    };
  }

  // 正常配置的图标均为 data URI；无法识别时以 HelpCircle 兜底
  return {
    element: <HelpCircle size={size} />,
    isImg: false,
    iconSrc: null,
    isPlugin: false,
    pluginId: ''
  };
};
