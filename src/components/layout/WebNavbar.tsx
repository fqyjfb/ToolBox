import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, ClipboardList, User, Search } from 'lucide-react';
import { useAuthStore } from '../../store/AuthStore';
import { useNavSearch } from '../../contexts/NavSearchContext';
import './WebNavbar.css';

const SEARCH_ENABLED_PATHS = ['/tools/todo', '/tools/memo', '/tools/quick-reply', '/tools/cloud-clipboard', '/tools/account', '/nav'];

const navItems = [
  { path: '/', label: '首页' },
  { path: '/news', label: '热点资讯' },
  { path: '/nav', label: '网址导航' },
  { path: '/tools/tool-downloads', label: '工具下载' },
  { path: '/tools', label: '工具库' },
];

const WebNavbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const admin = useAuthStore((s) => s.admin);
  const { searchQuery, setSearchQuery, handleSearch, clearSearch, performSearch } = useNavSearch();
  const menuRef = useRef<HTMLDivElement>(null);

  const showSearch = SEARCH_ENABLED_PATHS.some(path => location.pathname.startsWith(path));

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
    setShowUserMenu(false);
    setIsMenuOpen(false);
  }, [logout, navigate]);

  const handleUserButtonClick = () => {
    if (isAuthenticated) {
      navigate('/tools/profile');
    } else {
      navigate('/login');
    }
  };

  const handleUserButtonRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAuthenticated) {
      setShowUserMenu(true);
    }
  };

  const handleStatusDotClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAuthenticated) {
      handleLogout();
    }
  };

  return (
    <header className="web-navbar sticky top-0 z-50">
      <div className="web-navbar__inner max-w-7xl mx-auto h-full flex items-center justify-between" style={{ paddingLeft: 'var(--space-4)', paddingRight: 'var(--space-4)' }}>

        {/* Brand */}
        <div className="web-navbar__brand" onClick={() => navigate('/')}>
          <img
            src="./favicon.svg"
            alt="ToolBox Logo"
            className="rounded-lg logo-icon object-contain"
            style={{ width: '24px', height: '24px' }}
          />
          <h1 className="font-bold shine-text" style={{ fontSize: 'var(--text-sm)' }}>ToolBox</h1>
        </div>

        {/* Right side */}
        <div className="flex items-center" style={{ gap: 'var(--space-3)' }}>

          {/* Search */}
          {showSearch && (
            <div className="hidden md:flex web-navbar__search-wrap">
              <div className="relative w-full">
                <input
                  placeholder="搜索..."
                  className="web-navbar__search-input"
                  name="search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={performSearch}
                  className="web-navbar__search-btn"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Desktop nav */}
          <nav className="hidden md:flex web-navbar__nav">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`web-navbar__link ${isActive(item.path) ? 'web-navbar__link--active' : ''}`}
              >
                {item.label}
              </button>
            ))}

            {isAuthenticated ? (
              <>
                <button
                  onClick={() => navigate('/tools/todo')}
                  className="web-navbar__link"
                >
                  <span className="web-navbar__link-icon"><ClipboardList className="w-3.5 h-3.5" /></span>
                  待办
                </button>

                <div className="relative" style={{ marginLeft: 'var(--space-2)' }}>
                  <button
                    onClick={handleUserButtonClick}
                    onContextMenu={handleUserButtonRightClick}
                    className="web-navbar__user"
                    title={isAuthenticated ? '点击进入个人信息，右键点击退出登录' : '点击进入登录页面'}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>{admin?.name || admin?.username || '个人中心'}</span>
                    <span
                      className={`web-navbar__dot ${isAuthenticated ? 'web-navbar__dot--active' : 'web-navbar__dot--inactive'}`}
                      onClick={handleStatusDotClick}
                      title={isAuthenticated ? '点击退出登录' : '未登录'}
                    />
                  </button>

                  {showUserMenu && (
                    <div ref={menuRef} className="web-navbar__dropdown">
                      <button onClick={handleLogout} className="web-navbar__dropdown-item">
                        <LogOut className="w-3.5 h-3.5" />
                        退出登录
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={handleUserButtonClick}
                onContextMenu={(e) => e.preventDefault()}
                className="web-navbar__login"
                title="点击进入登录页面"
              >
                登录
                <span
                  className="web-navbar__dot web-navbar__dot--inactive"
                  title="未登录"
                />
              </button>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden rounded-md flex items-center justify-center p-1"
            style={{ width: '28px', height: '28px', color: 'var(--color-text-secondary)' }}
          >
            {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <nav className="web-navbar__mobile-menu">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setIsMenuOpen(false); }}
              className={`web-navbar__mobile-item ${isActive(item.path) ? 'web-navbar__mobile-item--active' : ''}`}
            >
              {item.label}
            </button>
          ))}
          {isAuthenticated ? (
            <>
              <button
                onClick={() => { navigate('/tools/todo'); setIsMenuOpen(false); }}
                className="web-navbar__mobile-item"
              >
                <ClipboardList className="w-4 h-4" />
                待办
              </button>
              <button
                onClick={() => { navigate('/tools/profile'); setIsMenuOpen(false); }}
                className="web-navbar__mobile-item"
              >
                <User className="w-4 h-4" />
                个人信息
              </button>
              <button
                onClick={() => { handleLogout(); }}
                className="web-navbar__mobile-item"
                style={{ color: 'var(--color-text-error)' }}
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </>
          ) : (
            <button
              onClick={() => { navigate('/login'); setIsMenuOpen(false); }}
              className="web-navbar__login"
              style={{ width: '100%', marginTop: 'var(--space-1)' }}
            >
              登录
            </button>
          )}
        </nav>
      )}
    </header>
  );
};

export default WebNavbar;
