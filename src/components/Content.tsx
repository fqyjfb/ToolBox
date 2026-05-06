import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';
import { useAuth, useAuthStore } from '../store/AuthStore';
import { Minus, Maximize2, X, Search, X as XIcon, Menu, Settings, Info, LogIn, LogOut, Bell } from 'lucide-react';
import { useNavSearch } from '../contexts/NavSearchContext';
import { useTodoNotification } from '../contexts/TodoNotificationContext';
import { isElectron } from '../utils/environment';
import PopupMenu from './ui/PopupMenu';
import Tooltip from './ui/Tooltip';
import './Content.css';

interface ContentProps {
  children: React.ReactNode;
  className?: string;
}

const Content: React.FC<ContentProps> = ({ children, className = '' }) => {
  const isDesktop = isElectron();
  const { isDark, toggleTheme } = useThemeStore();
  const { searchQuery, setSearchQuery, performSearch, clearSearch, handleSearch } = useNavSearch();
  const { pendingCount } = useTodoNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const showSearch = ['/launch', '/nav', '/tools', '/tools/country-code', '/tools/exchange', '/tools/cloud-clipboard', '/tools/quick-reply', '/tools/todo', '/tools/account'].includes(location.pathname);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  const handleMenuClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className={`flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white ${className}`} style={{ overflowX: 'hidden' }}>
      <div className="px-6 py-2.5 flex items-center justify-between" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
            {location.pathname === '/' && '首页'}
            {location.pathname === '/launch' && '快启动'}
            {location.pathname === '/news' && '热点新闻'}
            {location.pathname === '/nav' && '网址导航'}
            {location.pathname === '/tools' && '工具中心'}
            {location.pathname === '/tools/exchange' && '汇率换算'}
            {location.pathname === '/tools/cloud-clipboard' && '云剪贴板'}
            {location.pathname === '/tools/quick-reply' && '快捷回复'}
            {location.pathname === '/tools/todo' && '待办事项'}
            {location.pathname === '/tools/country-code' && '国家区号查询'}
            {location.pathname === '/tools/account' && '账号管理'}
            {location.pathname === '/tools/weather' && '天气预报'}
            {location.pathname === '/tools/translate' && '在线翻译'}
            {location.pathname === '/tools/markdown-to-wechat' && 'Markdown转微信'}
            {location.pathname === '/tools/ip-info' && 'IP地址查询'}
            {location.pathname === '/tools/emoji-remover' && 'Emoji清理器'}
            {location.pathname === '/tools/json-formatter' && 'JSON格式化'}
            {location.pathname === '/tools/timestamp-converter' && '时间戳转换'}
            {location.pathname === '/tools/case-converter' && '大小写转换'}
            {location.pathname === '/tools/hash-generator' && '哈希生成器'}
            {location.pathname === '/tools/text-deduplicator' && '文本去重'}
            {location.pathname === '/tools/csv-to-json' && 'CSV转JSON'}
            {location.pathname === '/tools/json-to-csv' && 'JSON转CSV'}
            {location.pathname === '/tools/url-parser' && 'URL解析'}
            {location.pathname === '/tools/sitemap-generator' && '站点地图生成器'}
            {location.pathname === '/tools/qr-generator' && '二维码生成器'}
            {location.pathname === '/tools/regex-tester' && '正则表达式测试器'}
            {location.pathname === '/tools/url-encode' && 'URL编码'}
            {location.pathname === '/tools/meta-tags-generator' && '元标签生成器'}
            {location.pathname === '/tools/markdown-to-text' && 'Markdown转文本'}
            {location.pathname === '/tools/html-to-text' && 'HTML转文本'}
            {location.pathname === '/tools/sql-minifier' && 'SQL压缩'}
            {location.pathname === '/tools/hex-encode' && '十六进制编码'}
            {location.pathname === '/tools/hex-decode' && '十六进制解码'}
            {location.pathname === '/admin' && '管理控制台'}
            {location.pathname === '/admin/websites' && '网址管理'}
            {location.pathname === '/admin/users' && '用户管理'}
            {location.pathname.includes('/admin/users/edit') && '编辑用户'}
            {location.pathname === '/admin/tools' && '工具管理'}
            {location.pathname === '/admin/database' && '数据管理'}
            {location.pathname === '/settings' && '设置'}
            {location.pathname === '/about' && '关于'}
            {location.pathname === '/login' && '登录'}
          </span>
        </div>
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="flex items-center space-x-3">
            {showSearch && (
              <div className="relative">
                <input
                  placeholder="搜索..."
                  className="shadow-lg border-2 border-transparent focus:border-gray-300 px-4 py-1.5 rounded-xl w-56 transition-[width] duration-300 focus:w-64 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                  name="search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                  style={{ height: '32px' } as React.CSSProperties}
                />
                {searchQuery && (
                  <Tooltip title="清除搜索">
                    <button
                      onClick={clearSearch}
                      className="absolute right-9 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-all duration-300 ease-in-out"
                    >
                      <XIcon size={14} />
                    </button>
                  </Tooltip>
                )}
                <button
                  onClick={performSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-all duration-300 ease-in-out"
                >
                  <Search size={16} />
                </button>
              </div>
            )}
            <label className="switch">
              <span className="sun"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="#ffd43b"><circle r="5" cy="12" cx="12"></circle><path d="m21 13h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zm-17 0h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zm13.66-5.66a1 1 0 0 1 -.66-.29 1 1 0 0 1 0-1.41l.71-.71a1 1 0 1 1 1.41 1.41l-.71.71a1 1 0 0 1 -.75.29zm-12.02 12.02a1 1 0 0 1 -.71-.29 1 1 0 0 1 0-1.41l.71-.66a1 1 0 0 1 1.41 1.41l-.71.71a1 1 0 0 1 -.7.24zm6.36-14.36a1 1 0 0 1 -1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1 -1 1zm0 17a1 1 0 0 1 -1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1 -1 1zm-5.66-14.66a1 1 0 0 1 -.7-.29l-.71-.71a1 1 0 0 1 1.41-1.41l.71.71a1 1 0 0 1 0 1.41 1 1 0 0 1 -.71.29zm12.02 12.02a1 1 0 0 1 -.7-.29l-.66-.71a1 1 0 0 1 1.36-1.36l.71.71a1 1 0 0 1 0 1.41 1 1 0 0 1 -.71.24z"></path></g></svg></span>
              <span className="moon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="m223.5 32c-123.5 0-223.5 100.3-223.5 224s100 224 223.5 224c60.6 0 115.5-24.2 155.8-63.4 5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6-96.9 0-175.5-78.8-175.5-176 0-65.8 36-123.1 89.3-153.3 6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z"></path></svg></span>
              <input
                type="checkbox"
                className="input"
                checked={isDark}
                onChange={toggleTheme}
              />
              <span className="slider"></span>
            </label>
            <Tooltip title={isAuthenticated ? '用户菜单' : '登录'}>
              <PopupMenu
                trigger={
                  <button
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:-translate-y-0.5"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" height={18} width={18} xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2c2.757 0 5 2.243 5 5.001 0 2.756-2.243 5-5 5s-5-2.244-5-5c0-2.758 2.243-5.001 5-5.001zm0-2c-3.866 0-7 3.134-7 7.001 0 3.865 3.134 7 7 7s7-3.135 7-7c0-3.867-3.134-7.001-7-7.001zm6.369 13.353c-.497.498-1.057.931-1.658 1.302 2.872 1.874 4.378 5.083 4.972 7.346h-19.387c.572-2.29 2.058-5.503 4.973-7.358-.603-.374-1.162-.811-1.658-1.312-4.258 3.072-5.611 8.506-5.611 10.669h24c0-2.142-1.44-7.557-5.631-10.647z" />
                    </svg>
                  </button>
                }
                items={isAuthenticated ? [
                  {
                    id: 'logout',
                    label: '登出',
                    icon: <LogOut className="w-4 h-4" />,
                    onClick: logout
                  }
                ] : [
                  {
                    id: 'login',
                    label: '登录',
                    icon: <LogIn className="w-4 h-4" />,
                    onClick: () => navigate('/login')
                  }
                ]}
              />
            </Tooltip>
            <Tooltip title="待办事项">
              <button
                className="relative p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:-translate-y-0.5"
                onClick={() => navigate('/tools/todo')}
              >
                <Bell className="w-5 h-5" />
                {pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>
            </Tooltip>
            {isDesktop && (
              <Tooltip title="菜单">
                <PopupMenu
                  trigger={
                    <button
                      className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                  }
                  items={[
                    {
                      id: 'settings',
                      label: '设置',
                      icon: <Settings className="w-4 h-4" />,
                      onClick: () => handleMenuClick('/settings')
                    },
                    {
                      id: 'about',
                      label: '关于',
                      icon: <Info className="w-4 h-4" />,
                      onClick: () => handleMenuClick('/about')
                    }
                  ]}
                />
              </Tooltip>
            )}
            {isDesktop && (
              <>
                <Tooltip title="最小化">
                  <button
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:-translate-y-0.5"
                    onClick={() => window.electron?.minimize()}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </Tooltip>
                <Tooltip title="最大化">
                  <button
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:-translate-y-0.5"
                    onClick={() => window.electron?.maximize()}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </Tooltip>
                <Tooltip title="关闭">
                  <button
                    className="p-1.5 rounded-lg hover:bg-red-200 dark:hover:bg-red-900 hover:text-red-600 dark:hover:text-red-400 transition-all duration-300 hover:-translate-y-0.5"
                    onClick={() => window.electron?.close()}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </Tooltip>
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