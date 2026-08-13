import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Home, Compass, Wrench, User, LogOut, ClipboardList, Link, Clipboard, MessageSquare, Search } from 'lucide-react';
import { useAuthStore } from '../../store/AuthStore';
import { useNavSearch } from '../../contexts/NavSearchContext';

const SEARCH_ENABLED_PATHS = ['/tools/todo', '/tools/memo', '/tools/quick-reply', '/tools/cloud-clipboard', '/tools/account', '/nav'];

const bottomNavItems = [
  { icon: Home, label: '首页', path: '/' },
  { icon: Compass, label: '资讯', path: '/news' },
  { icon: Wrench, label: '工具', path: '/tools' },
  { icon: User, label: '我的', path: '/login' },
];

const MobileNavbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
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

  const getCurrentTabIndex = () => {
    const index = bottomNavItems.findIndex(item => location.pathname.startsWith(item.path));
    return index === -1 ? 0 : index;
  };

  const currentTab = getCurrentTabIndex();

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
    <>
      
      <header className="sticky top-0 z-50 shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ padding: 'var(--space-2)', paddingLeft: 'var(--space-4)', paddingRight: 'var(--space-4)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{ gap: 'var(--space-2)' }} onClick={() => navigate('/')}>
              <img 
                src="./favicon.svg"
                alt="ToolBox Logo" 
                className="rounded-lg object-contain"
                style={{ width: 'calc(var(--space-5) * 0.7)', height: 'calc(var(--space-5) * 0.7)' }}
              />
              <span className="font-bold shine-text" style={{ fontSize: 'var(--text-sm)' }}>ToolBox</span>
            </div>

            {showSearch && (
              <div className="mx-3" style={{ width: '200px', maxWidth: 'calc(100vw - 160px)' }}>
                <div className="relative">
                  <input
                    placeholder="搜索..."
                    className="w-full px-3 py-1.5 pr-9 rounded-lg text-sm outline-none"
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
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-7 top-1/2 transform -translate-y-1/2"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={performSearch}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="rounded-lg"
                style={{ padding: 'var(--space-1-5)', color: 'var(--color-text-secondary)' }}
              >
                {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isMenuOpen && (
            <nav className="border-t" style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderColor: 'var(--color-border)' }}>
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => { navigate('/tools/todo'); setIsMenuOpen(false); }}
                    className="w-full text-left font-medium rounded-lg flex items-center"
                    style={{ gap: 'var(--space-2)', padding: 'var(--space-1-5) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                  >
                    <ClipboardList className="w-4 h-4" />
                    待办事项
                  </button>
                  <button
                    onClick={() => { navigate('/tools/cloud-clipboard'); setIsMenuOpen(false); }}
                    className="w-full text-left font-medium rounded-lg flex items-center"
                    style={{ gap: 'var(--space-2)', padding: 'var(--space-1-5) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                  >
                    <Clipboard className="w-4 h-4" />
                    云剪贴板
                  </button>
                  <button
                    onClick={() => { navigate('/tools/quick-reply'); setIsMenuOpen(false); }}
                    className="w-full text-left font-medium rounded-lg flex items-center"
                    style={{ gap: 'var(--space-2)', padding: 'var(--space-1-5) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                  >
                    <MessageSquare className="w-4 h-4" />
                    快捷回复
                  </button>
                  <button
                    onClick={() => { navigate('/nav'); setIsMenuOpen(false); }}
                    className="w-full text-left font-medium rounded-lg flex items-center"
                    style={{ gap: 'var(--space-2)', padding: 'var(--space-1-5) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                  >
                    <Link className="w-4 h-4" />
                    网址导航
                  </button>
                  <button
                    onClick={() => { navigate('/tools/profile'); setIsMenuOpen(false); }}
                    className="w-full text-left font-medium rounded-lg flex items-center"
                    style={{ gap: 'var(--space-2)', padding: 'var(--space-1-5) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                  >
                    <User className="w-4 h-4" />
                    个人信息
                  </button>
                  <button
                    onClick={() => { handleLogout(); }}
                    className="w-full text-left font-medium rounded-lg flex items-center"
                    style={{ gap: 'var(--space-2)', padding: 'var(--space-1-5) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { navigate('/nav'); setIsMenuOpen(false); }}
                    className="w-full text-left font-medium rounded-lg flex items-center"
                    style={{ gap: 'var(--space-2)', padding: 'var(--space-1-5) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                  >
                    <Link className="w-4 h-4" />
                    网址导航
                  </button>
                  <button
                    onClick={() => { navigate('/login'); setIsMenuOpen(false); }}
                    className="w-full nav-btn-gradient justify-center"
                  >
                    登录
                  </button>
                </>
              )}
            </nav>
          )}
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ backgroundColor: 'var(--color-card)', borderTop: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-around" style={{ paddingTop: 'var(--space-2)' }}>
          {bottomNavItems.map((item, index) => (
            <button
              key={item.path}
              onClick={index === 4 ? handleUserButtonClick : () => navigate(item.path)}
              onContextMenu={index === 4 ? handleUserButtonRightClick : undefined}
              className={`flex flex-col items-center transition-colors relative bottom-nav-active`}
              style={{
                gap: '2px',
                padding: '0 var(--space-3) var(--space-1-5) var(--space-3)',
                color: currentTab === index ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              }}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium" style={{ fontSize: 'var(--text-xs)' }}>{item.label}</span>
              {index === 4 && (
                <span
                  className="absolute cursor-pointer transition-transform hover:scale-110"
                  style={{
                    top: '2px',
                    right: 'var(--space-1)',
                    width: 'calc(var(--space-2) * 0.8)',
                    height: 'calc(var(--space-2) * 0.8)',
                    borderRadius: '50%',
                    border: '2px solid var(--color-card)',
                    backgroundColor: isAuthenticated ? 'var(--color-success)' : 'var(--color-text-tertiary)',
                  }}
                  onClick={handleStatusDotClick}
                  title={isAuthenticated ? '点击退出登录' : '未登录'}
                />
              )}
            </button>
          ))}
        </div>
        
        {showUserMenu && (
          <div
            ref={menuRef}
            className="absolute bottom-full left-1/2 -translate-x-1/2 z-50"
            style={{
              marginBottom: 'var(--space-2)',
              width: 'var(--space-32)',
              backgroundColor: 'var(--color-card)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <button
              onClick={handleLogout}
              className="w-full text-left font-medium user-menu-item flex items-center"
              style={{ gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        )}
      </nav>
    </>
  );
};

export default MobileNavbar;