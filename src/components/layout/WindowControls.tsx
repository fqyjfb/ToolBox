import React from 'react';
import { Minus, Maximize2, X } from 'lucide-react';
import { isElectron } from '../../utils/environment';

interface WindowControlsProps {
  /** 是否显示最大化按钮（小窗模式传 false 隐藏，主进程同步拦截最大化） */
  showMaximize?: boolean;
}

// 最小化/最大化/关闭三按钮：原样抽取自 Content.tsx（含关闭按钮红色 hover），整体显隐由组件内部判断
const WindowControls: React.FC<WindowControlsProps> = ({ showMaximize = true }) => {
  if (!isElectron()) return null;

  return (
    <>
      <button className="w-9 h-9 flex items-center justify-center text-content-secondary transition-colors duration-200 hover:bg-menu-hover" onClick={() => window.electron?.minimize()}>
        <Minus className="w-4 h-4" />
      </button>
      {showMaximize && (
        <button className="w-9 h-9 flex items-center justify-center text-content-secondary transition-colors duration-200 hover:bg-menu-hover" onClick={() => window.electron?.maximize()}>
          <Maximize2 className="w-4 h-4" />
        </button>
      )}
      <button className="w-9 h-9 flex items-center justify-center text-content-secondary transition-colors duration-200 hover:bg-red-600 hover:text-white" onClick={() => window.electron?.close()}>
        <X className="w-4 h-4" />
      </button>
    </>
  );
};

export default WindowControls;
