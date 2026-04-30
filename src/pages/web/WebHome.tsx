import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, Zap, BookOpen, Sparkles, ChevronRight, Menu, X } from 'lucide-react';
import { hotNewsApi } from '../../services/hotNews';
import { supabase } from '../../services/supabase';
import { loadHomeTools, type HomeToolItem } from '../../utils/homeTools';
import type { ItNewsItem, AiNewsItem } from '../../types/hotNews';
import WeatherCard from '../../components/home/WeatherCard';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Phone: React.lazy(() => import('lucide-react').then(m => ({ default: m.Phone }))),
  RefreshCw: React.lazy(() => import('lucide-react').then(m => ({ default: m.RefreshCw }))),
  MessageSquare: React.lazy(() => import('lucide-react').then(m => ({ default: m.MessageSquare }))),
  Clipboard: React.lazy(() => import('lucide-react').then(m => ({ default: m.Clipboard }))),
  CheckSquare: React.lazy(() => import('lucide-react').then(m => ({ default: m.CheckSquare }))),
  Key: React.lazy(() => import('lucide-react').then(m => ({ default: m.Key }))),
  FileCode: React.lazy(() => import('lucide-react').then(m => ({ default: m.FileCode }))),
  Globe: React.lazy(() => import('lucide-react').then(m => ({ default: m.Globe }))),
  Smile: React.lazy(() => import('lucide-react').then(m => ({ default: m.Smile }))),
  Clock: React.lazy(() => import('lucide-react').then(m => ({ default: m.Clock }))),
  ArrowUpDown: React.lazy(() => import('lucide-react').then(m => ({ default: m.ArrowUpDown }))),
  Hash: React.lazy(() => import('lucide-react').then(m => ({ default: m.Hash }))),
  Copy: React.lazy(() => import('lucide-react').then(m => ({ default: m.Copy }))),
  Table: React.lazy(() => import('lucide-react').then(m => ({ default: m.Table }))),
  Link: React.lazy(() => import('lucide-react').then(m => ({ default: m.Link }))),
  Map: React.lazy(() => import('lucide-react').then(m => ({ default: m.Map }))),
  QrCode: React.lazy(() => import('lucide-react').then(m => ({ default: m.QrCode }))),
  Code: React.lazy(() => import('lucide-react').then(m => ({ default: m.Code }))),
  AtSign: React.lazy(() => import('lucide-react').then(m => ({ default: m.AtSign }))),
  Tag: React.lazy(() => import('lucide-react').then(m => ({ default: m.Tag }))),
  AlignLeft: React.lazy(() => import('lucide-react').then(m => ({ default: m.AlignLeft }))),
  Code2: React.lazy(() => import('lucide-react').then(m => ({ default: m.Code2 }))),
  Binary: React.lazy(() => import('lucide-react').then(m => ({ default: m.Binary }))),
  Braces: React.lazy(() => import('lucide-react').then(m => ({ default: m.Braces }))),
  Navigation: React.lazy(() => import('lucide-react').then(m => ({ default: m.Navigation }))),
  Newspaper: React.lazy(() => import('lucide-react').then(m => ({ default: m.Newspaper }))),
  Languages: React.lazy(() => import('lucide-react').then(m => ({ default: m.Languages }))),
};

const searchTypes = [
  { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=%s%', placeholder: '百度一下' },
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s%', placeholder: 'Google搜索' },
  { id: 'bing', name: 'Bing', url: 'https://cn.bing.com/search?q=%s%', placeholder: 'Bing搜索' },
];

const WebHome: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchType, setActiveSearchType] = useState('baidu');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [homeTools] = useState(() => loadHomeTools());

  const [sixtySecondsData, setSixtySecondsData] = useState<string[] | null>(null);
  const [sixtySecondsLoading, setSixtySecondsLoading] = useState(false);

  const [itNewsData, setItNewsData] = useState<ItNewsItem[] | null>(null);
  const [itNewsLoading, setItNewsLoading] = useState(false);

  const [aiNewsData, setAiNewsData] = useState<AiNewsItem[] | null>(null);
  const [aiNewsLoading, setAiNewsLoading] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const fetchSixtySeconds = useCallback(async () => {
    setSixtySecondsLoading(true);
    try {
      const data = await hotNewsApi.getSixtySecondsData();
      if (data) {
        setSixtySecondsData(data.data.news.slice(0, 5));
      }
    } catch {
      console.log('获取60秒新闻失败');
    } finally {
      setSixtySecondsLoading(false);
    }
  }, []);

  const fetchItNews = useCallback(async () => {
    setItNewsLoading(true);
    try {
      const data = await hotNewsApi.getItNews();
      if (data) {
        setItNewsData(data.data.slice(0, 6));
      }
    } catch {
      console.log('获取IT新闻失败');
    } finally {
      setItNewsLoading(false);
    }
  }, []);

  const fetchAiNews = useCallback(async () => {
    setAiNewsLoading(true);
    try {
      const data = await hotNewsApi.getAiNews();
      if (data) {
        setAiNewsData(data.data.news.slice(0, 6));
      }
    } catch {
      console.log('获取AI新闻失败');
    } finally {
      setAiNewsLoading(false);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    fetchSixtySeconds();
    fetchItNews();
    fetchAiNews();
    checkAuth();
  }, [fetchSixtySeconds, fetchItNews, fetchAiNews, checkAuth]);

  const performSearch = () => {
    const query = searchQuery.trim();
    if (!query) return;
    
    const currentSearchType = searchTypes.find(type => type.id === activeSearchType);
    if (currentSearchType?.url) {
      const searchUrl = currentSearchType.url.replace('%s%', encodeURIComponent(query));
      window.open(searchUrl, '_blank');
    }
  };

  const handleToolClick = (path: string) => {
    navigate(path);
  };

  const quickTools = useMemo<HomeToolItem[]>(() => homeTools.slice(0, 8), [homeTools]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800 dark:text-white">ToolBox</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Web Edition</p>
              </div>
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              <button 
                onClick={() => navigate('/')}
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg"
              >
                首页
              </button>
              <button 
                onClick={() => navigate('/news')}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                热点资讯
              </button>
              <button 
                onClick={() => navigate('/tools')}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                工具库
              </button>
              {isAuthenticated ? (
                <button 
                  onClick={() => navigate('/tools/todo')}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  待办
                </button>
              ) : (
                <button 
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  登录
                </button>
              )}
            </nav>

            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {isMenuOpen && (
            <nav className="md:hidden mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={() => { navigate('/'); setIsMenuOpen(false); }}
                className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                首页
              </button>
              <button 
                onClick={() => { navigate('/news'); setIsMenuOpen(false); }}
                className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                热点资讯
              </button>
              <button 
                onClick={() => { navigate('/tools'); setIsMenuOpen(false); }}
                className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                工具库
              </button>
              {isAuthenticated ? (
                <button 
                  onClick={() => { navigate('/tools/todo'); setIsMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  待办
                </button>
              ) : (
                <button 
                  onClick={() => { navigate('/login'); setIsMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mt-2"
                >
                  登录
                </button>
              )}
            </nav>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <section className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="max-w-3xl mx-auto">
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {searchTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setActiveSearchType(type.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      activeSearchType === type.id 
                        ? 'bg-white text-blue-600' 
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
              
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                  placeholder={searchTypes.find(t => t.id === activeSearchType)?.placeholder || '搜索...'}
                  className="w-full px-12 py-4 bg-white rounded-xl text-gray-800 placeholder-gray-400 outline-none focus:ring-4 focus:ring-white/30 text-lg"
                />
                <button
                  onClick={performSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  搜索
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">60秒速览</h2>
                </div>
                <button 
                  onClick={() => navigate('/news')}
                  className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:gap-2 transition-all"
                >
                  查看更多 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              {sixtySecondsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              ) : sixtySecondsData?.length ? (
                <div className="space-y-3">
                  {sixtySecondsData.map((news, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors"
                      onClick={() => navigate('/news')}
                    >
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{news}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">暂无数据</p>
              )}
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">科技资讯</h2>
                </div>
                <button 
                  onClick={() => navigate('/news')}
                  className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:gap-2 transition-all"
                >
                  查看更多 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              {itNewsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              ) : itNewsData?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {itNewsData.map((news, index) => (
                    <div 
                      key={index}
                      className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => window.open(news.link, '_blank')}
                    >
                      <h3 className="font-medium text-gray-800 dark:text-white text-sm mb-1 line-clamp-2">{news.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {news.created}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">暂无数据</p>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">快捷工具</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {quickTools.map((tool) => {
                  const IconComponent = iconMap[tool.iconName] || iconMap.Clipboard;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => handleToolClick(tool.path)}
                      className="flex flex-col items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                    >
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ backgroundColor: tool.color }}
                      >
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{tool.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <button 
                onClick={() => handleToolClick('/tools/weather')}
                className="w-full cursor-pointer"
              >
                <WeatherCard />
              </button>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">AI 资讯</h2>
                </div>
                <button 
                  onClick={() => navigate('/news')}
                  className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:gap-2 transition-all"
                >
                  更多 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              {aiNewsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              ) : aiNewsData?.length ? (
                <div className="space-y-3">
                  {aiNewsData.slice(0, 4).map((news, index) => (
                    <div 
                      key={index}
                      className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors"
                      onClick={() => window.open(news.link, '_blank')}
                    >
                      <h3 className="text-sm font-medium text-gray-800 dark:text-white line-clamp-2">{news.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{news.source}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">暂无数据</p>
              )}
            </section>
          </div>
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>ToolBox Web Edition - 高效便捷的在线工具平台</p>
            <p className="mt-1">© 2024 ToolBox. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WebHome;