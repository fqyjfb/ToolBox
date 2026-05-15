import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, ClipboardList, User } from 'lucide-react';
import { useAuth } from '../../store/AuthStore';

const navItems = [
  { path: '/', label: '首页' },
  { path: '/news', label: '热点资讯' },
  { path: '/tools', label: '工具库' },
];

const WebNavbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { isAuthenticated, logout, admin } = useAuth();
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
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <style>{`
        .shine-text {
          font-weight: 900;
          color: rgba(0, 0, 0, 0.3);
          background: #222 -webkit-gradient(
              linear,
              left top,
              right top,
              from(#222),
              to(#222),
              color-stop(0.5, #fff)
            ) 0 0 no-repeat;
          background-image: -webkit-linear-gradient(
            -40deg,
            transparent 0%,
            transparent 40%,
            #fff 50%,
            transparent 60%,
            transparent 100%
          );
          -webkit-background-clip: text;
          -webkit-background-size: 50px;
          -webkit-animation: shine 5s infinite;
          animation: shine 5s infinite;
        }

        .dark .shine-text {
          color: rgba(255, 196, 0, 0.93);
        }

        @-webkit-keyframes shine {
          0%, 10% {
            background-position: -200px;
          }
          20% {
            background-position: top left;
          }
          100% {
            background-position: 200px;
          }
        }

        @keyframes shine {
          0%, 10% {
            background-position: -200px;
          }
          20% {
            background-position: top left;
          }
          100% {
            background-position: 200px;
          }
        }

        .nav-btn-gradient {
          width: fit-content;
          display: flex;
          padding: 0.5rem 1rem;
          gap: 0.3rem;
          border: none;
          font-weight: bold;
          border-radius: 30px;
          cursor: pointer;
          text-shadow: 2px 2px 3px rgb(136 0 136 / 50%);
          background: linear-gradient(
              15deg,
              #880088,
              #aa2068,
              #cc3f47,
              #de6f3d,
              #f09f33,
              #de6f3d,
              #cc3f47,
              #aa2068,
              #880088
            )
            no-repeat;
          background-size: 300%;
          background-position: left center;
          transition: background 0.3s ease;
          color: #fff;
          font-size: 14px;
        }

        .nav-btn-gradient:hover {
          background-size: 320%;
          background-position: right center;
        }

        .nav-item {
          position: relative;
          transition: all 0.3s ease;
        }

        .nav-item::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #880088, #f09f33);
          transform: translateX(-50%);
          transition: width 0.3s ease;
        }

        .nav-item:hover::after {
          width: 80%;
        }

        .nav-item.active::after {
          width: 100%;
        }

        .logo-icon {
          animation: logo-pulse 2s ease-in-out infinite;
        }

        @keyframes logo-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        .user-menu-item:hover {
          background-color: rgb(243 244 246);
        }

        .dark .user-menu-item:hover {
          background-color: rgb(55 65 81);
        }
      `}</style>
      
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <img 
              src="./favicon.png" 
              alt="ToolBox Logo" 
              className="w-8 h-8 rounded-lg logo-icon object-contain"
            />
            <h1 className="text-base font-bold shine-text">ToolBox</h1>
          </div>
          
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all nav-item ${
                  isActive(item.path)
                    ? 'text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-700 active'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
            
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => navigate('/tools/todo')}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors nav-item flex items-center gap-1"
                >
                  <ClipboardList className="w-4 h-4" />
                  待办
                </button>
                
                <div className="relative ml-2">
                  <button
                    onClick={handleUserButtonClick}
                    onContextMenu={handleUserButtonRightClick}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors nav-item flex items-center gap-2 relative"
                    title={isAuthenticated ? '点击进入个人信息，右键点击退出登录' : '点击进入登录页面'}
                  >
                    <User className="w-4 h-4" />
                    <span>{admin?.name || admin?.username || '个人中心'}</span>
                    <span
                      className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 cursor-pointer transition-transform hover:scale-110 ${
                        isAuthenticated ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                      onClick={handleStatusDotClick}
                      title={isAuthenticated ? '点击退出登录' : '未登录'}
                    />
                  </button>
                  
                  {showUserMenu && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 min-w-36"
                    >
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 user-menu-item flex items-center gap-2"
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
                  className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-gray-400"
                  title="未登录"
                />
              </button>
            )}
          </nav>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {isMenuOpen && (
          <nav className="md:hidden mt-2.5 pt-2.5 border-t border-gray-200 dark:border-gray-700">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setIsMenuOpen(false); }}
                className={`w-full px-3 py-1.5 text-left text-sm font-medium rounded-lg transition-colors ${
                  isActive(item.path)
                    ? 'text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-700'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => { navigate('/tools/todo'); setIsMenuOpen(false); }}
                  className="w-full px-3 py-1.5 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2"
                >
                  <ClipboardList className="w-4 h-4" />
                  待办
                </button>
                <button
                  onClick={() => { navigate('/tools/profile'); setIsMenuOpen(false); }}
                  className="w-full px-3 py-1.5 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  个人信息
                </button>
                <button
                  onClick={() => { handleLogout(); }}
                  className="w-full px-3 py-1.5 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </>
            ) : (
              <button
                onClick={() => { navigate('/login'); setIsMenuOpen(false); }}
                className="w-full nav-btn-gradient justify-center mt-2"
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