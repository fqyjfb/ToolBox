import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Globe, Wrench, Zap, Key, Crown } from 'lucide-react';
import { useAuthStore } from '../store/AuthStore';
import { useSidebarStore } from '../store/sidebarStore';
import './Sidebar.css';

interface NavItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  path: string;
}

const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin } = useAuthStore();
  const { isVisible } = useSidebarStore();
  
  const getActiveItem = () => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path === '/launch') return 'launch';
    if (path === '/news') return 'news';
    if (path === '/nav') return 'nav';
    if (path === '/tools') return 'tools';
    if (path.startsWith('/admin')) return 'admin';
    return 'home';
  };
  
  const activeItem = getActiveItem();

  const navItems: NavItem[] = [
    {
      id: 'home',
      title: '首页',
      icon: <Home className="w-6 h-6" />,
      path: '/',
    },
    {
      id: 'launch',
      title: '快启动',
      icon: <Zap className="w-6 h-6" />,
      path: '/launch',
    },
    {
      id: 'nav',
      title: '导航',
      icon: <Globe className="w-6 h-6" />,
      path: '/nav',
    },
    {
      id: 'account',
      title: '账号',
      icon: <Key className="w-6 h-6" />,
      path: '/tools/account',
    },
    {
      id: 'tools',
      title: '工具',
      icon: <Wrench className="w-6 h-6" />,
      path: '/tools',
    },
  ];

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className="w-sidebar-collapsed h-full flex flex-col"
      style={{ 
        WebkitAppRegion: 'drag',
        backgroundColor: 'var(--color-sidebar)'
      } as React.CSSProperties}
    >
      <div className="p-2 flex items-center justify-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <img src="./favicon.png" alt="ToolBox Logo" className="w-10 h-10" />
      </div>
      
      <div className="flex-1 py-4 flex justify-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <ul className="nav-sidebar">
          {navItems.map((item) => (
            <li key={item.id} className={`nav-item ${activeItem === item.id ? 'active' : ''}`}>
              <a 
                href={item.path} 
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.path);
                }}
              >
                <div className="filled" />
                {item.icon}
              </a>
              <div className="tooltip">{item.title}</div>
            </li>
          ))}
        </ul>
      </div>
      
      {admin && (admin.role === 'super' || admin.role === 'normal') && (
        <div className="pb-4 flex justify-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <ul className="nav-sidebar">
            <li className={`nav-item ${activeItem === 'admin' ? 'active' : ''}`}>
              <a 
                href="/admin" 
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/admin');
                }}
              >
                <div className="filled" />
                <Crown className="w-6 h-6" />
              </a>
              <div className="tooltip">管理</div>
            </li>
          </ul>
        </div>
      )}
      
    </div>
  );
};

export default Sidebar;