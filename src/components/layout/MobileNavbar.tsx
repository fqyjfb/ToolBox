import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Home, Compass, Wrench, User, LogOut, ClipboardList } from 'lucide-react';
import { useAuth } from '../../store/AuthStore';

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
  const { isAuthenticated, logout } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

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
      
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <img 
                src="./favicon.png" 
                alt="ToolBox Logo" 
                className="w-7 h-7 rounded-lg object-contain"
              />
              <span className="text-base font-bold shine-text">ToolBox</span>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isMenuOpen && (
            <nav className="mt-2.5 pt-2.5 border-t border-gray-200 dark:border-gray-700">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => { navigate('/tools/todo'); setIsMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2"
                  >
                    <ClipboardList className="w-4 h-4" />
                    待办事项
                  </button>
                  <button
                    onClick={() => { navigate('/tools/cloud-clipboard'); setIsMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2"
                  >
                    <span className="w-4 h-4 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-xs">📋</span>
                    云剪贴板
                  </button>
                  <button
                    onClick={() => { navigate('/tools/quick-reply'); setIsMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2"
                  >
                    <span className="w-4 h-4 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-xs">💬</span>
                    快捷回复
                  </button>
                  <button
                    onClick={() => { navigate('/tools/profile'); setIsMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    个人信息
                  </button>
                  <button
                    onClick={() => { handleLogout(); }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { navigate('/login'); setIsMenuOpen(false); }}
                  className="w-full nav-btn-gradient justify-center"
                >
                  登录
                </button>
              )}
            </nav>
          )}
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50">
        <div className="flex items-center justify-around py-2">
          {bottomNavItems.map((item, index) => (
            <button
              key={item.path}
              onClick={index === 3 ? handleUserButtonClick : () => navigate(item.path)}
              onContextMenu={index === 3 ? handleUserButtonRightClick : undefined}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors relative ${
                currentTab === index
                  ? 'text-gray-800 dark:text-white bottom-nav-active'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
              {index === 3 && (
                <span
                  className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full border border-white dark:border-gray-800 cursor-pointer transition-transform hover:scale-110 ${
                    isAuthenticated ? 'bg-green-500' : 'bg-gray-400'
                  }`}
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
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
          >
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-300 user-menu-item flex items-center gap-2"
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