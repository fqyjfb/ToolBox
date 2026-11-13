import { mountIcon, BY_NAME, SVG_NS } from '../assets/kubai-icons';
import { ALL_TOOLS } from '../constants/tools';
import { TOOL_KUBAI_MAP, FALLBACK_ICON } from './kubaiIconMap';
import type { FloatConfigItem } from '../types/settings';

/**
 * 把 kubai 图标渲染成静态 SVG data URI。
 * 悬浮球主进程只能渲染 <img src>，用 data URI 让悬浮球菜单与设置页预览、
 * 工具中心卡片保持同一图标。
 */
export const kubaiIconToDataUrl = (name: string, color?: string): string => {
  const icon = BY_NAME[name] || Object.values(BY_NAME)[0];
  if (!icon) return '';

  const host = document.createElement('div');
  mountIcon(icon, 0, host, color);
  const svg = host.querySelector('svg');
  if (!svg) return '';

  // 内联序列化不会补 xmlns，而 data URI 作为独立图片必须显式声明
  svg.setAttribute('xmlns', SVG_NS);
  return `data:image/svg+xml,${encodeURIComponent(svg.outerHTML)}`;
};

/**
 * 把悬浮窗配置里的工具项图标收敛为工具中心同款 kubai 图标。
 * 非工具项原样返回；生成结果确定，未变化时不产生新对象，避免无谓写盘。
 */
export const syncToolFloatIcon = (config: FloatConfigItem): FloatConfigItem => {
  if (config.type !== 'tool') return config;

  const tool = ALL_TOOLS.find(item => item.id === config.action);
  const icon = kubaiIconToDataUrl(
    TOOL_KUBAI_MAP[config.action] || FALLBACK_ICON,
    config.color || tool?.color,
  );
  return icon && icon !== config.icon ? { ...config, icon } : config;
};
