import React from 'react';
import CachedIcon from './CachedIcon';
import { renderFloatIcon, isPluginIcon } from '../../utils/floatIconRenderer';

interface FloatIconViewProps {
  /** 配置项的 icon 字段：预定义图标名 / base64 / data URI / plugin:xxx */
  icon: string;
  /** 插件图标地址，命中插件图标时优先渲染 */
  path?: string;
  /** 配置项类型是否为插件（type === 'plugin'） */
  isPlugin?: boolean;
  name?: string;
  /** 图标统一边长（px），所有来源的图标都会被限制在该尺寸内 */
  size?: number;
  /** 附加在外层容器上的类名 */
  className?: string;
}

/**
 * 统一尺寸的悬浮窗图标。
 *
 * 预定义 SVG、base64 图片与插件远程图标来源不同，之前各自的尺寸规则不一致
 * （SVG 固定 16/18/20，插件图片却是 w-full h-full 撑满圆形容器），
 * 导致设置页圆形按钮里的图标视觉大小参差不齐。
 * 这里统一收敛到 size x size 的方框内居中显示。
 */
const FloatIconView: React.FC<FloatIconViewProps> = ({
  icon,
  path,
  isPlugin = false,
  name,
  size = 20,
  className = ''
}) => {
  const usePluginIcon = !!path && (isPlugin || isPluginIcon(icon));
  const { element } = renderFloatIcon(icon, size);

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {usePluginIcon ? (
        <CachedIcon
          url={path}
          name={name}
          type="plugin"
          className="w-full h-full object-contain"
          fallbackIcon={element}
          iconOnly
        />
      ) : (
        element
      )}
    </span>
  );
};

export default FloatIconView;
