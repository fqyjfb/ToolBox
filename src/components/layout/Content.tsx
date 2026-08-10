import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Minus, Maximize2, X, Search, X as XIcon, Bell, Settings, PanelLeft, PanelLeftClose } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { useNavSearch } from '../../contexts/NavSearchContext';
import { useThemeStore } from '../../store/themeStore';
import { useSidebarStore } from '../../store/sidebarStore';
import { useTodoNotification } from '../../contexts/TodoNotificationContext';
import { isElectron } from '../../utils/environment';
import Breadcrumb from '../ui/Breadcrumb';
import './Content.css';

interface ContentProps {
  children: React.ReactNode;
  className?: string;
}

const Content: React.FC<ContentProps> = ({ children, className = '' }) => {
  const isDesktop = isElectron();
  const { searchQuery, setSearchQuery, performSearch, clearSearch, handleSearch } = useNavSearch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useThemeStore(useShallow((s) => ({ isDark: s.isDark, toggleTheme: s.toggleTheme })));
  const { isCollapsed, toggleSidebar } = useSidebarStore(useShallow((s) => ({ isCollapsed: s.isCollapsed, toggleSidebar: s.toggleSidebar })));
  const { pendingCount } = useTodoNotification();



  const showSearch = ['/launch', '/nav', '/tools/country-code', '/tools/exchange', '/tools/cloud-clipboard', '/tools/quick-reply', '/tools/todo', '/tools/memo', '/tools/account', '/tools/profile'].includes(location.pathname);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  return (
    <div className={`flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white ${className}`} style={{ overflowX: 'hidden' }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-300/50 dark:hover:bg-gray-600/50 transition-colors" onClick={toggleSidebar} title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}>
            {isCollapsed ? (
              <PanelLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
          <Breadcrumb />
        </div>
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="flex items-center space-x-3">
            {showSearch && (
              <div className="relative">
                <input
                  placeholder="搜索..."
                  className="border-2 border-transparent focus:border-gray-300 px-4 py-1.5 rounded-xl w-56 transition-[width] duration-300 focus:w-64 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                  name="search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                  style={{ height: '32px' } as React.CSSProperties}
                />
                {searchQuery && (
                  <button onClick={clearSearch} className="absolute right-9 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-all duration-300 ease-in-out">
                    <XIcon size={14} />
                  </button>
                )}
                <button onClick={performSearch} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-all duration-300 ease-in-out">
                  <Search size={16} />
                </button>
              </div>
            )}

            <button className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300" onClick={toggleTheme} title={isDark ? '浅色模式' : '深色模式'}>
              {isDark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <button className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 relative" onClick={() => navigate('/tools/todo')} title="待办事项">
              <Bell className="w-4 h-4" />
              {pendingCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </button>
            <button className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300" onClick={() => navigate('/settings')} title="设置">
              <Settings className="w-4 h-4" />
            </button>

            {isDesktop && (
              <>
                <button className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:-translate-y-0.5" onClick={() => window.electron?.minimize()}>
                  <Minus className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:-translate-y-0.5" onClick={() => window.electron?.maximize()}>
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-red-200 dark:hover:bg-red-900 hover:text-red-600 dark:hover:text-red-400 transition-all duration-300 hover:-translate-y-0.5" onClick={() => window.electron?.close()}>
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
};

export default Content;