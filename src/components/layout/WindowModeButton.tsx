import React from 'react';
import { RectangleVertical, RectangleHorizontal } from 'lucide-react';
import Tooltip from '../ui/Tooltip';
import { useWindowModeStore } from '../../store/windowModeStore';

// 类名与头部现有图标按钮完全一致（Content.tsx 头部按钮组）
const BTN_CLASS = 'w-9 h-9 flex items-center justify-center text-content-secondary transition-colors duration-200 hover:bg-menu-hover';

// 头部窗口模式切换按钮：大窗态显示「小窗模式」入口，小窗态显示「大窗模式」入口
const WindowModeButton: React.FC = () => {
  const mode = useWindowModeStore((s) => s.mode);
  const setMode = useWindowModeStore((s) => s.setMode);
  const isCompact = mode === 'compact';

  return (
    <Tooltip title={isCompact ? '大窗模式' : '小窗模式'} position="bottom">
      <button className={BTN_CLASS} onClick={() => setMode(isCompact ? 'large' : 'compact')}>
        {isCompact
          ? <RectangleHorizontal className="w-4 h-4" />
          : <RectangleVertical className="w-4 h-4" />}
      </button>
    </Tooltip>
  );
};

export default WindowModeButton;
