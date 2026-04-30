import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, Zap, BookOpen, Sparkles, ChevronRight } from 'lucide-react';
import { hotNewsApi } from '../../services/hotNews';
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
  const [homeTools] = useState(() => loadHomeTools());

  const [sixtySecondsData, setSixtySecondsData] = useState<string[] | null>(null);
  const [sixtySecondsLoading, setSixtySecondsLoading] = useState(false);

  const [itNewsData, setItNewsData] = useState<ItNewsItem[] | null>(null);
  const [itNewsLoading, setItNewsLoading] = useState(false);

  const [aiNewsData, setAiNewsData] = useState<AiNewsItem[] | null>(null);
  const [aiNewsLoading, setAiNewsLoading] = useState(false);

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

  useEffect(() => {
    fetchSixtySeconds();
    fetchItNews();
    fetchAiNews();
  }, [fetchSixtySeconds, fetchItNews, fetchAiNews]);

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
    <>
      <section className="mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-wrap gap-2 mb-4 justify-center">
              {searchTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setActiveSearchType(type.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    activeSearchType === type.id
                      ? 'bg-gray-800 dark:bg-gray-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                className="w-full px-12 py-4 bg-gray-50 dark:bg-gray-700 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 outline-none border border-gray-200 dark:border-gray-600 focus:border-gray-400 dark:focus:border-gray-500 text-lg"
              />
              <button
                onClick={performSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-gray-800 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-500 transition-colors font-medium"
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
                className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 hover:gap-2 transition-all"
              >
                查看更多 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {sixtySecondsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
                    <span className="flex-shrink-0 w-6 h-6 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full flex items-center justify-center text-xs font-medium">
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
                <BookOpen className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">科技资讯</h2>
              </div>
              <button
                onClick={() => navigate('/news')}
                className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 hover:gap-2 transition-all"
              >
                查看更多 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {itNewsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : itNewsData?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {itNewsData.map((news, index) => (
                  <div
                    key={index}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-400 hover:shadow-md transition-all cursor-pointer"
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
                <Sparkles className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">AI 资讯</h2>
              </div>
              <button
                onClick={() => navigate('/news')}
                className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 hover:gap-2 transition-all"
              >
                更多 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {aiNewsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
    </>
  );
};

export default WebHome;