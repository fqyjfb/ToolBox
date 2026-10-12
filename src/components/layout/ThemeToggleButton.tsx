import React from 'react';
import { useShallow } from 'zustand/shallow';
import Tooltip from '../ui/Tooltip';
import { useThemeStore } from '../../store/themeStore';

// 主题切换按钮：原样抽取自 Content.tsx 头部按钮组，Content 与 CompactTitleBar 共用
const ThemeToggleButton: React.FC = () => {
  const { isDark, toggleTheme } = useThemeStore(useShallow((s) => ({ isDark: s.isDark, toggleTheme: s.toggleTheme })));

  return (
    <Tooltip title={isDark ? '浅色模式' : '深色模式'} position="bottom">
      <button className="w-9 h-9 flex items-center justify-center text-content-secondary transition-colors duration-200 hover:bg-menu-hover" onClick={toggleTheme}>
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
    </Tooltip>
  );
};

export default ThemeToggleButton;
