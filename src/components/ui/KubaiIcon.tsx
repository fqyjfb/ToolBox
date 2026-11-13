import { useEffect, useRef, useMemo } from 'react';
import { mountIcon, go, BY_NAME } from '../../assets/kubai-icons';

interface KubaiIconProps {
  /** kubai-icons 的图标名（中文），例如 "文件夹"、"下载"。找不到时回退到第一个可用图标 */
  name: string;
  /** 主色 hex，如 #bc8acf。不传则用全局默认色 */
  color?: string;
  /** 尺寸 px，默认 26 */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 渲染一个 kubai-icons 动态 SVG 图标。
 * 鼠标悬停时由引擎自动触发形变动画（go()）。
 * 每个实例独立主色，不影响其他图标。
 */
const KubaiIcon: React.FC<KubaiIconProps> = ({ name, color, size = 26, className, style }) => {
  const hostRef = useRef<HTMLSpanElement | null>(null);

  const icon = useMemo(() => BY_NAME[name] || Object.values(BY_NAME)[0], [name]);

  useEffect(() => {
    if (!hostRef.current || !icon) return;

    // 1. mountIcon 挂载时即带上实例色，首帧不会闪默认蓝
    const inst = mountIcon(icon, 0, hostRef.current, color);

    // 2. hover 绑定
    const host = hostRef.current;
    const enter = () => { inst.hover++; go(inst); };
    const leave = () => { inst.hover = Math.max(0, inst.hover - 1); go(inst); };
    host.addEventListener('pointerenter', enter);
    host.addEventListener('pointerleave', leave);
    const focus = () => { inst.hover++; go(inst); };
    const blur = () => { inst.hover = Math.max(0, inst.hover - 1); go(inst); };
    host.addEventListener('focus', focus);
    host.addEventListener('blur', blur);

    return () => {
      host.removeEventListener('pointerenter', enter);
      host.removeEventListener('pointerleave', leave);
      host.removeEventListener('focus', focus);
      host.removeEventListener('blur', blur);
      cancelAnimationFrame(inst.raf);
      host.innerHTML = '';
    };
  }, [icon, color]);

  return (
    <span
      ref={hostRef}
      className={className}
      style={{
        display: 'inline-flex',
        width: size,
        height: size,
        verticalAlign: 'middle',
        ...style,
      }}
    />
  );
};

export default KubaiIcon;
