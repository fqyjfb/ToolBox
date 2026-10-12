import React from 'react';
import { useLocation } from 'react-router-dom';
import { useSidebarStore } from '../../store/sidebarStore';
import Sidebar from './Sidebar';
import WindowModeButton from './WindowModeButton';
import ThemeToggleButton from './ThemeToggleButton';
import WindowControls from './WindowControls';
import HeaderSearchBox, { isSearchRoute } from './HeaderSearchBox';
import PageTransition from './PageTransition';

// 小窗紧凑标题栏：隐藏清单 = 面包屑、Logo、侧栏开关、设置按钮、待办铃铛、最大化按钮
// （Logo 与设置入口由折叠侧栏承担；直接不渲染而非 CSS 隐藏）
const CompactTitleBar: React.FC = () => {
  const location = useLocation();

  return (
    <div className="flex flex-col flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="pl-4 pr-0 py-0 flex items-center justify-between">
        <div className="flex-1 min-w-0" />
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="flex items-center overflow-hidden rounded-lg">
            <WindowModeButton />
            <ThemeToggleButton />
            <WindowControls showMaximize={false} />
          </div>
        </div>
      </div>
      {isSearchRoute(location.pathname) && (
        <div className="px-4 pb-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <HeaderSearchBox />
        </div>
      )}
    </div>
  );
};

// 小窗布局：折叠侧栏（与大窗折叠态同位置同视觉）+ 紧凑标题栏 + 内容区
// 内容区容器与 Content.tsx 逐类一致（p-2 / scrollbar-hide / PageTransition），路由仍走 desktopRoutes
const CompactLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const sidebarPosition = useSidebarStore((s) => s.position); // 与 Layout 一致：支持侧栏右置

  return (
    <div className={`flex h-screen overflow-hidden ${sidebarPosition === 'right' ? 'flex-row-reverse' : ''}`}>
      <Sidebar forceCollapsed />
      <div className="flex-1 flex flex-col min-w-0">
        <CompactTitleBar />
        <div className="flex-1 overflow-hidden">
          <div className="w-full h-full overflow-auto scrollbar-hide p-2">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompactLayout;
