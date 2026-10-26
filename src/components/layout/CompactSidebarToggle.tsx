import React from 'react';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import Tooltip from '../ui/Tooltip';
import { useSidebarStore } from '../../store/sidebarStore';

// 类名与头部现有图标按钮完全一致（Content.tsx 头部按钮组）
const BTN_CLASS = 'w-9 h-9 flex items-center justify-center text-content-secondary transition-colors duration-200 hover:bg-menu-hover';

// 小窗标题栏侧边栏显隐按钮：仅在小窗模式渲染，切换的是小窗专属隐藏态，不影响大窗侧边栏
const CompactSidebarToggle: React.FC = () => {
  const compactHidden = useSidebarStore((s) => s.compactHidden);
  const toggleCompactSidebar = useSidebarStore((s) => s.toggleCompactSidebar);

  return (
    <Tooltip title={compactHidden ? '显示侧边栏' : '隐藏侧边栏'} position="bottom">
      <button className={BTN_CLASS} onClick={toggleCompactSidebar}>
        {compactHidden
          ? <PanelLeft className="w-4 h-4" />
          : <PanelLeftClose className="w-4 h-4" />}
      </button>
    </Tooltip>
  );
};

export default CompactSidebarToggle;
