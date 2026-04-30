import React, { useState } from 'react';
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
  const { isAuthenticated, logout } = useAuth();

  const getCurrentTabIndex = () => {
    const index = bottomNavItems.findIndex(item => location.pathname.startsWith(item.path));
    return index === -1 ? 0 : index;
  };

  const currentTab = getCurrentTabIndex();

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setIsMenuOpen(false);
  };

  return (
    <>
      <style>{`
        .shine-text-mobile {
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

        .dark .shine-text-mobile {
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

        .logo-icon-mobile {
          animation: logo-pulse-mobile 2s ease-in-out infinite;
        }

        @keyframes logo-pulse-mobile {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        .nav-btn-gradient-mobile {
          width: fit-content;
          display: flex;
          padding: 0.5rem 1.25rem;
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

        .nav-btn-gradient-mobile:hover {
          background-size: 320%;
          background-position: right center;
        }

        .bottom-nav-active {
          position: relative;
        }

        .bottom-nav-active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 3px;
          background: linear-gradient(90deg, #880088, #f09f33);
          border-radius: 2px;
        }
      `}</style>
      
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <img 
                src="./favicon.png" 
                alt="ToolBox Logo" 
                className="w-7 h-7 rounded-lg logo-icon-mobile object-contain"
              />
              <span className="text-base font-bold shine-text-mobile">ToolBox</span>
            </div>
            
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
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
                  className="w-full nav-btn-gradient-mobile justify-center"
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
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                currentTab === index
                  ? 'text-gray-800 dark:text-white bottom-nav-active'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};

export default MobileNavbar;