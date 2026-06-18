import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, ClipboardList, User, Sparkles, Search } from 'lucide-react';
import { useAuth } from '../../store/AuthStore';
import { useNavSearch } from '../../contexts/NavSearchContext';

const SEARCH_ENABLED_PATHS = ['/tools/todo', '/tools/quick-reply', '/tools/cloud-clipboard', '/tools/account', '/nav'];

const navItems = [
  { path: '/', label: '首页' },
  { path: '/tools/ai-chat', label: 'AI助手', icon: Sparkles },
  { path: '/news', label: '热点资讯' },
  { path: '/nav', label: '网址导航' },
  { path: '/tools', label: '工具库' },
];

const WebNavbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { isAuthenticated, logout, admin } = useAuth();
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
    <header className="sticky top-0 z-50 shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderBottom: '1px solid var(--color-border)' }}>
      
      <div className="max-w-7xl mx-auto" style={{ padding: 'var(--space-2)', paddingLeft: 'var(--space-4)', paddingRight: 'var(--space-4)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: 'var(--space-2)' }} onClick={() => navigate('/')}>
            <img 
              src="./favicon.png" 
              alt="ToolBox Logo" 
              className="rounded-lg logo-icon object-contain"
              style={{ width: 'calc(var(--space-5) * 0.8)', height: 'calc(var(--space-5) * 0.8)' }}
            />
            <h1 className="font-bold shine-text" style={{ fontSize: 'var(--text-sm)' }}>ToolBox</h1>
          </div>

          {showSearch && (
            <div className="hidden md:flex mx-4" style={{ width: '220px' }}>
              <div className="relative w-full">
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

          <nav className="hidden md:flex items-center" style={{ gap: 'var(--space-1)' }}>
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`font-medium rounded-lg transition-all nav-item flex items-center ${
                  isActive(item.path)
                    ? 'active'
                    : ''
                }`}
                style={{
                  gap: item.icon ? 'var(--space-1)' : '0',
                  padding: 'var(--space-1-5) var(--space-3)',
                  fontSize: 'var(--text-xs)',
                  color: isActive(item.path) ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive(item.path) ? 'var(--color-bg-tertiary)' : 'transparent',
                }}
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                {item.label}
              </button>
            ))}
            
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => navigate('/tools/todo')}
                  className="nav-item flex items-center"
                  style={{ gap: 'var(--space-1)', padding: 'var(--space-1-5) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                >
                  <ClipboardList className="w-4 h-4" />
                  待办
                </button>
                
                <div className="relative" style={{ marginLeft: 'var(--space-2)' }}>
                  <button
                    onClick={handleUserButtonClick}
                    onContextMenu={handleUserButtonRightClick}
                    className="nav-item flex items-center relative"
                    style={{ gap: 'var(--space-2)', padding: 'var(--space-1-5) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                    title={isAuthenticated ? '点击进入个人信息，右键点击退出登录' : '点击进入登录页面'}
                  >
                    <User className="w-4 h-4" />
                    <span>{admin?.name || admin?.username || '个人中心'}</span>
                    <span
                      className="absolute cursor-pointer transition-transform hover:scale-110"
                      style={{
                        top: '-2px',
                        right: '-2px',
                        width: 'var(--space-2)',
                        height: 'var(--space-2)',
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
            className="md:hidden rounded-lg"
            style={{ padding: 'var(--space-1-5)', color: 'var(--color-text-secondary)' }}
          >
            {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {isMenuOpen && (
          <nav className="md:hidden border-t" style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderColor: 'var(--color-border)' }}>
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setIsMenuOpen(false); }}
                className="w-full text-left font-medium rounded-lg transition-colors flex items-center"
                style={{
                  gap: item.icon ? 'var(--space-2)' : '0',
                  padding: 'var(--space-1-5) var(--space-3)',
                  fontSize: 'var(--text-xs)',
                  color: isActive(item.path) ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive(item.path) ? 'var(--color-bg-tertiary)' : 'transparent',
                }}
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                {item.label}
              </button>
            ))}
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => { navigate('/tools/todo'); setIsMenuOpen(false); }}
                  className="w-full text-left font-medium rounded-lg flex items-center"
                  style={{ gap: 'var(--space-2)', padding: 'var(--space-1-5) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                >
                  <ClipboardList className="w-4 h-4" />
                  待办
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
              <button
                onClick={() => { navigate('/login'); setIsMenuOpen(false); }}
                className="w-full nav-btn-gradient justify-center"
                style={{ marginTop: 'var(--space-2)' }}
              >
                登录
              </button>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};

export default WebNavbar;