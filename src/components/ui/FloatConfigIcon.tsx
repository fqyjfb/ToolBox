import React from 'react';
import KubaiIcon from './KubaiIcon';
import FloatIconView from './FloatIconView';
import { ALL_TOOLS } from '../../constants/tools';
import { TOOL_KUBAI_MAP, FALLBACK_ICON } from '../../utils/kubaiIconMap';
import type { FloatConfigItem } from '../../types/settings';

interface FloatConfigIconProps {
  config: FloatConfigItem;
  size?: number;
  className?: string;
}

/**
 * 悬浮窗配置项图标：工具类型统一使用工具中心的 kubai 图标，
 * 其余类型仍走 FloatIconView（lucide data URI / 应用图片 / 插件图标）。
 */
const FloatConfigIcon: React.FC<FloatConfigIconProps> = ({ config, size = 20, className }) => {
  if (config.type === 'tool') {
    const tool = ALL_TOOLS.find(item => item.id === config.action);
    return (
      <KubaiIcon
        name={TOOL_KUBAI_MAP[config.action] || FALLBACK_ICON}
        color={config.color || tool?.color}
        size={size}
        className={className}
      />
    );
  }

  return (
    <FloatIconView
      icon={config.icon}
      path={config.path}
      isPlugin={config.type === 'plugin'}
      name={config.name}
      size={size}
      className={className}
    />
  );
};

export default FloatConfigIcon;
