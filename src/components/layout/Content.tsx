import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Settings, PanelLeft, PanelLeftClose } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { useThemeStore } from '../../store/themeStore';
import { useSidebarStore } from '../../store/sidebarStore';
import { useTodoNotification } from '../../contexts/TodoNotificationContext';
import { isElectron } from '../../utils/environment';
import Breadcrumb from '../ui/Breadcrumb';
import Tooltip from '../ui/Tooltip';
import HeaderWeather from './HeaderWeather';
import WindowModeButton from './WindowModeButton';
import ThemeToggleButton from './ThemeToggleButton';
import WindowControls from './WindowControls';
import HeaderSearchBox from './HeaderSearchBox';
import PageTransition from './PageTransition';
import './Content.css';

interface ContentProps {
  children: React.ReactNode;
  className?: string;
}

const Content: React.FC<ContentProps> = ({ children, className = '' }) => {
  const isDesktop = isElectron();
  const navigate = useNavigate();
  // 订阅 themeKey，确保自定义主题保存后 Content 强制重渲染，面包屑/头部按钮颜色同步更新
  useThemeStore((s) => s.themeKey);
  const { isCollapsed, toggleSidebar } = useSidebarStore(useShallow((s) => ({ isCollapsed: s.isCollapsed, toggleSidebar: s.toggleSidebar })));
  const { pendingCount } = useTodoNotification();

  return (
    <div className={`flex-1 flex flex-col text-content-primary ${className}`} style={{ overflowX: 'hidden' }}>
      <div className="pl-4 pr-0 py-0 flex items-center justify-between" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Tooltip title={isCollapsed ? '展开侧边栏' : '收起侧边栏'} position="bottom">
            <button className="flex items-center justify-center w-6 h-6 rounded hover:bg-menu-hover transition-colors" onClick={toggleSidebar}>
              {isCollapsed ? (
                <PanelLeft className="w-4 h-4 text-content-secondary" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-content-secondary" />
              )}
            </button>
          </Tooltip>
          <Breadcrumb />
        </div>
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="flex items-center">
            <HeaderSearchBox />

            <div className="flex items-center overflow-hidden rounded-lg">
              {isDesktop && (
                <>
                  <HeaderWeather />
                  <WindowModeButton />
                </>
              )}
              <ThemeToggleButton />

              <Tooltip title="待办事项" position="bottom">
                <button className="w-9 h-9 flex items-center justify-center text-content-secondary transition-colors duration-200 hover:bg-menu-hover relative" onClick={() => navigate('/tools/todo')}>
                  <Bell className="w-4 h-4" />
                  {pendingCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </button>
              </Tooltip>
              <Tooltip title="设置" position="bottom">
                <button className="w-9 h-9 flex items-center justify-center text-content-secondary transition-colors duration-200 hover:bg-menu-hover" onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4" />
                </button>
              </Tooltip>

              <WindowControls />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="w-full h-full overflow-auto scrollbar-hide p-2">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </div>
    </div>
  );
};

export default Content;