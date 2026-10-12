import React from 'react';
import { Maximize2 } from 'lucide-react';
import { useIsCompactMode, useWindowModeStore } from '../../store/windowModeStore';

// 小窗模式下对桌面强布局页面（admin 数据表格等）的轻提示条：内部自判断是否小窗，非小窗渲染 null
const CompactUnsupportedHint: React.FC = () => {
  const isCompact = useIsCompactMode();
  const setMode = useWindowModeStore((s) => s.setMode);

  if (!isCompact) return null;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 mt-2 mx-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
      <span>该页面内容较宽，建议切换到大窗模式使用</span>
      <button
        className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-yellow-800 hover:bg-yellow-100 transition-colors"
        onClick={() => setMode('large')}
      >
        <Maximize2 className="w-3 h-3" />
        切换大窗
      </button>
    </div>
  );
};

export default CompactUnsupportedHint;
