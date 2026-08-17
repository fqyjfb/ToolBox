import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, ClipboardList, User, Search } from 'lucide-react';
import { useAuthStore } from '../../store/AuthStore';
import { useNavSearch } from '../../contexts/NavSearchContext';

const SEARCH_ENABLED_PATHS = ['/tools/todo', '/tools/memo', '/tools/quick-reply', '/tools/cloud-clipboard', '/tools/account', '/nav'];

const navItems = [
  { path: '/', label: '首页' },
  { path: '/news', label: '热点资讯' },
  { path: '/nav', label: '网址导航' },
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
    <header className="sticky top-0 z-50 shadow-sm relative" style={{ 
      backgroundColor: 'var(--color-card)', 
      borderBottom: '1px solid var(--color-border)',
      height: '42px'
    }}>
      
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between" style={{ paddingLeft: 'var(--space-4)', paddingRight: 'var(--space-4)' }}>
          <div className="flex items-center" style={{ gap: 'var(--space-2)' }} onClick={() => navigate('/')}>
            <img 
              src="./favicon.svg"
              alt="ToolBox Logo" 
              className="rounded-lg logo-icon object-contain"
              style={{ width: '24px', height: '24px' }}
            />
            <h1 className="font-bold shine-text" style={{ fontSize: 'var(--text-sm)' }}>ToolBox</h1>
          </div>

          <div className="flex items-center" style={{ gap: 'var(--space-3)' }}>
            {showSearch && (
              <div className="hidden md:flex items-center" style={{ width: '200px' }}>
                <div className="relative w-full">
                  <input
                    placeholder="搜索..."
                    className="w-full px-2 py-1 pr-8 rounded-md text-sm outline-none"
                    name="search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--text-xs)',
                      height: '24px'
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-6 top-1/2 transform -translate-y-1/2"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={performSearch}
                    className="absolute right-1.5 top-1/2 transform -translate-y-1/2"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    <Search className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            <nav className="hidden md:flex items-center" style={{ gap: 'var(--space-1)' }}>
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`font-medium rounded-md transition-all nav-item flex items-center ${
                  isActive(item.path)
                    ? 'active'
                    : ''
                }`}
                style={{
                  padding: '4px 10px',
                  fontSize: 'var(--text-xs)',
                  color: isActive(item.path) ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive(item.path) ? 'var(--color-bg-tertiary)' : 'transparent',
                  height: '24px'
                }}
              >
                {item.label}
              </button>
            ))}
            
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => navigate('/tools/todo')}
                  className="nav-item flex items-center rounded-md"
                  style={{ gap: 'var(--space-1)', padding: '4px 10px', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', height: '24px' }}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  待办
                </button>
                
                <div className="relative" style={{ marginLeft: 'var(--space-2)' }}>
                  <button
                    onClick={handleUserButtonClick}
                    onContextMenu={handleUserButtonRightClick}
                    className="nav-item flex items-center relative rounded-md"
                    style={{ gap: 'var(--space-1)', padding: '4px 10px', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', height: '24px' }}
                    title={isAuthenticated ? '点击进入个人信息，右键点击退出登录' : '点击进入登录页面'}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>{admin?.name || admin?.username || '个人中心'}</span>
                    <span
                      className="absolute cursor-pointer transition-transform hover:scale-110"
                      style={{
                        top: '-1px',
                        right: '-1px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        border: '2px solid var(--color-card)',
                        backgroundColor: isAuthenticated ? 'var(--color-success)' : 'var(--color-text-tertiary)',
                      }}
                      onClick={handleStatusDotClick}
                      title={isAuthenticated ? '点击退出登录' : '未登录'}
                    />
                  </button>
                  
                  {showUserMenu && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 top-full z-50"
                      style={{
                        marginTop: 'var(--space-1)',
                        backgroundColor: 'var(--color-card)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-md)',
                        border: '1px solid var(--color-border)',
                        paddingTop: 'var(--space-1)',
                        paddingBottom: 'var(--space-1)',
                        minWidth: 'var(--space-32)',
                      }}
                    >
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-left user-menu-item flex items-center"
                        style={{ gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                      >
                        <LogOut className="w-4 h-4" />
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
                className="nav-btn-gradient relative"
              >
                登录
                <span
                  className="absolute"
                  style={{
                    top: '-2px',
                    right: '-2px',
                    width: 'var(--space-2)',
                    height: 'var(--space-2)',
                    borderRadius: '50%',
                    border: '2px solid var(--color-card)',
                    backgroundColor: 'var(--color-text-tertiary)',
                  }}
                  title="未登录"
                />
              </button>
            )}
          </nav>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden rounded-md flex items-center justify-center"
            style={{ width: '24px', height: '24px', color: 'var(--color-text-secondary)' }}
          >
            {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <nav 
          className="md:hidden absolute left-0 right-0 top-full z-50"
          style={{ 
            backgroundColor: 'var(--color-card)',
            borderBottom: '1px solid var(--color-border)',
            padding: 'var(--space-2)',
            boxShadow: 'var(--shadow-md)'
          }}
        >
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setIsMenuOpen(false); }}
              className="w-full text-left font-medium rounded-md transition-colors flex items-center"
              style={{
                padding: 'var(--space-2)',
                fontSize: 'var(--text-xs)',
                color: isActive(item.path) ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                backgroundColor: isActive(item.path) ? 'var(--color-bg-tertiary)' : 'transparent',
                marginBottom: 'var(--space-1)'
              }}
            >
              {item.label}
            </button>
          ))}
          {isAuthenticated ? (
            <>
              <button
                onClick={() => { navigate('/tools/todo'); setIsMenuOpen(false); }}
                className="w-full text-left font-medium rounded-md flex items-center"
                style={{ gap: 'var(--space-2)', padding: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}
              >
                <ClipboardList className="w-4 h-4" />
                待办
              </button>
              <button
                onClick={() => { navigate('/tools/profile'); setIsMenuOpen(false); }}
                className="w-full text-left font-medium rounded-md flex items-center"
                style={{ gap: 'var(--space-2)', padding: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}
              >
                <User className="w-4 h-4" />
                个人信息
              </button>
              <button
                onClick={() => { handleLogout(); }}
                className="w-full text-left font-medium rounded-md flex items-center"
                style={{ gap: 'var(--space-2)', padding: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-error)' }}
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </>
          ) : (
            <button
              onClick={() => { navigate('/login'); setIsMenuOpen(false); }}
              className="w-full nav-btn-gradient justify-center"
              style={{ marginTop: 'var(--space-1)' }}
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