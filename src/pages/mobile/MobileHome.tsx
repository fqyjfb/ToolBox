import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Zap, Sun, Cloud, CloudRain, CloudSnow, Clock, ChevronRight } from 'lucide-react';
import { hotNewsApi } from '../../services/hotNews';
import { loadHomeTools, type HomeToolItem } from '../../utils/homeTools';
import type { ItNewsItem, AiNewsItem } from '../../types/hotNews';
import { apiService } from '../../services/api';
import { isWeb } from '../../utils/environment';
import { getWeatherCity } from '../../utils/weatherLocation';
import type { WeatherInfo } from '../../types/weather';

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

const MobileHome: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchType, setActiveSearchType] = useState('baidu');
  const [homeTools] = useState(() => loadHomeTools());

  const [sixtySecondsData, setSixtySecondsData] = useState<string[] | null>(null);
  const [itNewsData, setItNewsData] = useState<ItNewsItem[] | null>(null);
  const [aiNewsData, setAiNewsData] = useState<AiNewsItem[] | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherInfo | null>(null);

  const fetchSixtySeconds = useCallback(async () => {
    try {
      const data = await hotNewsApi.getSixtySecondsData();
      if (data) {
        setSixtySecondsData(data.data.news.slice(0, 4));
      }
    } catch {
      console.log('获取60秒新闻失败');
    }
  }, []);

  const fetchItNews = useCallback(async () => {
    try {
      const data = await hotNewsApi.getItNews();
      if (data) {
        setItNewsData(data.data.slice(0, 4));
      }
    } catch {
      console.log('获取IT新闻失败');
    }
  }, []);

  const fetchAiNews = useCallback(async () => {
    try {
      const data = await hotNewsApi.getAiNews();
      if (data) {
        setAiNewsData(data.data.news.slice(0, 4));
      }
    } catch {
      console.log('获取AI新闻失败');
    }
  }, []);

  const fetchWeather = useCallback(async () => {
    try {
      let city = localStorage.getItem('weatherCity');
      if (!city && isWeb()) {
        city = await getWeatherCity();
      }
      if (!city) {
        city = '南京';
      }
      const data = await apiService.getWeather(city);
      if (data?.data) {
        setWeatherData(data.data);
      }
    } catch {
      console.log('获取天气失败');
    }
  }, []);

  useEffect(() => {
    fetchSixtySeconds();
    fetchItNews();
    fetchAiNews();
    fetchWeather();
  }, [fetchSixtySeconds, fetchItNews, fetchAiNews, fetchWeather]);

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

  const getWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase();
    if (lowerCondition.includes('晴')) return <Sun className="w-8 h-8 text-yellow-500" />;
    if (lowerCondition.includes('多云')) return <Cloud className="w-8 h-8 text-yellow-500" />;
    if (lowerCondition.includes('雨')) return <CloudRain className="w-8 h-8 text-gray-500" />;
    if (lowerCondition.includes('雪')) return <CloudSnow className="w-8 h-8 text-gray-400" />;
    return <Cloud className="w-8 h-8 text-gray-400" />;
  };

  const quickTools: HomeToolItem[] = homeTools.slice(0, 6);

  return (
    <>
      <section className="mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {searchTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setActiveSearchType(type.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  activeSearchType === type.id
                    ? 'bg-gray-800 dark:bg-gray-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {type.name}
              </button>
            ))}
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && performSearch()}
              placeholder={searchTypes.find(t => t.id === activeSearchType)?.placeholder || '搜索...'}
              className="w-full px-10 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 outline-none border border-gray-200 dark:border-gray-600 text-sm"
            />
          </div>
        </div>
      </section>

      {weatherData && (
        <section className="mb-4">
          <button
            onClick={() => handleToolClick('/tools/weather')}
            className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4"
          >
            <div>
              {getWeatherIcon(weatherData.weather?.condition || '')}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-800 dark:text-white">
                  {weatherData.weather?.temperature ?? '--'}
                </span>
                <span className="text-gray-500 dark:text-gray-400">°C</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{weatherData.location?.city || '未知城市'}</span>
                <span>·</span>
                <span>{weatherData.weather?.condition || '未知'}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </section>
      )}

      <section className="mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h2 className="font-semibold text-gray-800 dark:text-white">快捷工具</h2>
            </div>
            <button
              onClick={() => navigate('/tools')}
              className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-0.5"
            >
              更多 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {quickTools.map((tool) => {
              const IconComponent = iconMap[tool.iconName] || iconMap.Clipboard;
              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool.path)}
                  className="flex flex-col items-center gap-1.5 p-2"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: tool.color }}
                  >
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-gray-700 dark:text-gray-300">{tool.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 dark:text-white">60秒速览</h2>
            <button
              onClick={() => navigate('/news')}
              className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-0.5"
            >
              更多 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          {sixtySecondsData?.length ? (
            <div className="space-y-2">
              {sixtySecondsData.map((news, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  onClick={() => navigate('/news')}
                >
                  <span className="flex-shrink-0 w-5 h-5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <p className="text-xs text-gray-700 dark:text-gray-300 flex-1">{news}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 dark:text-white">科技资讯</h2>
            <button
              onClick={() => navigate('/news')}
              className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-0.5"
            >
              更多 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          {itNewsData?.length ? (
            <div className="space-y-3">
              {itNewsData.map((news, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3"
                  onClick={() => window.open(news.link, '_blank')}
                >
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-800 dark:text-white line-clamp-2">{news.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {news.created}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 dark:text-white">AI 资讯</h2>
            <button
              onClick={() => navigate('/news')}
              className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-0.5"
            >
              更多 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          {aiNewsData?.length ? (
            <div className="space-y-3">
              {aiNewsData.map((news, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3"
                  onClick={() => window.open(news.link, '_blank')}
                >
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-800 dark:text-white line-clamp-2">{news.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{news.source}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default MobileHome;