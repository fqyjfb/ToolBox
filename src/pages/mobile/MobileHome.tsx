import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Zap, Sun, Cloud, CloudRain, CloudSnow, Clock, ChevronRight } from 'lucide-react';
import { hotNewsApi } from '../../services/hotNews';
import { loadHomeTools, type HomeToolItem } from '../../utils/homeTools';
import type { ItNewsItem, AiNewsItem, TodayInHistoryItem } from '../../types/hotNews';
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
  const [todayInHistoryData, setTodayInHistoryData] = useState<TodayInHistoryItem[] | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherInfo | null>(null);

  const [expandedNews, setExpandedNews] = useState<string | null>(null);

  const fetchSixtySeconds = useCallback(async () => {
    try {
      const data = await hotNewsApi.getSixtySecondsData();
      if (data) {
        setSixtySecondsData(data.data.news);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchItNews = useCallback(async () => {
    try {
      const data = await hotNewsApi.getItNews();
      if (data) {
        setItNewsData(data.data);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchAiNews = useCallback(async () => {
    try {
      const data = await hotNewsApi.getAiNews();
      if (data) {
        setAiNewsData(data.data.news);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchTodayInHistory = useCallback(async () => {
    try {
      const data = await hotNewsApi.getTodayInHistory();
      if (data) {
        setTodayInHistoryData(data.data.items);
      }
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      fetchSixtySeconds();
      fetchItNews();
      fetchAiNews();
      fetchTodayInHistory();
      fetchWeather();
    }, 0);
  }, [fetchSixtySeconds, fetchItNews, fetchAiNews, fetchTodayInHistory, fetchWeather]);

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
      <section style={{ marginBottom: 'var(--space-3)' }}>
        <div className="shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', border: '1px solid var(--color-border)' }}>
          <div className="flex flex-wrap" style={{ gap: 'var(--space-1-5)', marginBottom: 'var(--space-2)' }}>
            {searchTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setActiveSearchType(type.id)}
                className="font-medium transition-all rounded-full"
                style={{
                  padding: 'var(--space-1) var(--space-3)',
                  fontSize: 'var(--text-xs)',
                  backgroundColor: activeSearchType === type.id ? 'var(--color-text-primary)' : 'var(--color-bg-tertiary)',
                  color: activeSearchType === type.id ? 'var(--color-bg-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {type.name}
              </button>
            ))}
          </div>
          
          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4" style={{ left: 'var(--space-2)', color: 'var(--color-text-tertiary)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && performSearch()}
              placeholder={searchTypes.find(t => t.id === activeSearchType)?.placeholder || '搜索...'}
              className="w-full outline-none border rounded-xl"
              style={{
                paddingLeft: 'var(--space-9)',
                paddingRight: 'var(--space-4)',
                paddingTop: 'var(--space-2)',
                paddingBottom: 'var(--space-2)',
                backgroundColor: 'var(--color-bg-tertiary)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-primary)',
                borderColor: 'var(--color-border)',
              }}
            />
          </div>
        </div>
      </section>

      {weatherData && (
        <section style={{ marginBottom: 'var(--space-3)' }}>
          <button
            onClick={() => handleToolClick('/tools/weather')}
            className="w-full shadow-sm flex items-center"
            style={{ gap: 'var(--space-4)', backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', border: '1px solid var(--color-border)' }}
          >
            <div>
              {getWeatherIcon(weatherData.weather?.condition || '')}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline" style={{ gap: 'var(--space-1)' }}>
                <span className="font-bold" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-text-primary)' }}>
                  {weatherData.weather?.temperature ?? '--'}
                </span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>°C</span>
              </div>
              <div className="flex items-center" style={{ gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                <span>{weatherData.location?.city || '未知城市'}</span>
                <span>·</span>
                <span>{weatherData.weather?.condition || '未知'}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5" style={{ color: 'var(--color-text-tertiary)' }} />
          </button>
        </section>
      )}

      <section style={{ marginBottom: 'var(--space-3)' }}>
        <div className="shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
            <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
              <Zap className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>快捷工具</h2>
            </div>
            <button
                onClick={() => navigate('/tools')}
                className="flex items-center"
                style={{ gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
              >
                更多 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="grid grid-cols-3" style={{ gap: 'var(--space-2)' }}>
            {quickTools.map((tool) => {
              const IconComponent = iconMap[tool.iconName] || iconMap.Clipboard;
              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool.path)}
                  className="flex flex-col items-center"
                  style={{ gap: 'var(--space-1)', padding: 'var(--space-2)' }}
                >
                  <div
                    className="rounded-xl flex items-center justify-center"
                    style={{ width: 'calc(var(--space-5) * 1.4)', height: 'calc(var(--space-5) * 1.4)', backgroundColor: tool.color }}
                  >
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{tool.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 'var(--space-3)' }}>
        <div className="shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>60秒速览</h2>
            {sixtySecondsData && sixtySecondsData.length > 4 && (
              <button
                onClick={() => setExpandedNews(expandedNews === 'sixtySeconds' ? null : 'sixtySeconds')}
                className="flex items-center"
                style={{ gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
              >
                {expandedNews === 'sixtySeconds' ? '收起' : '更多'}
                <ChevronRight className={`w-3 h-3 transition-transform ${expandedNews === 'sixtySeconds' ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>
          
          {sixtySecondsData?.length ? (
            <div style={{ gap: 'var(--space-2)' }}>
              {(expandedNews === 'sixtySeconds' ? sixtySecondsData : sixtySecondsData.slice(0, 4)).map((news, index) => (
                <div
                  key={index}
                  className="flex items-start rounded-lg"
                  style={{ gap: 'var(--space-2)', padding: 'var(--space-2)', backgroundColor: 'var(--color-bg-tertiary)' }}
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
                    {index + 1}
                  </span>
                  <p className="flex-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{news}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ padding: 'var(--space-4)' }}>
              <div className="flex" style={{ gap: 'var(--space-1-5)' }}>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: 'var(--duration-bounce-delay)' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: 'calc(var(--duration-bounce-delay) * 2)' }}></div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 'var(--space-3)' }}>
        <div className="shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>科技资讯</h2>
            {itNewsData && itNewsData.length > 4 && (
              <button
                onClick={() => setExpandedNews(expandedNews === 'itNews' ? null : 'itNews')}
                className="flex items-center"
                style={{ gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
              >
                {expandedNews === 'itNews' ? '收起' : '更多'}
                <ChevronRight className={`w-3 h-3 transition-transform ${expandedNews === 'itNews' ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>
          
          {itNewsData?.length ? (
            <div style={{ gap: 'var(--space-3)' }}>
              {(expandedNews === 'itNews' ? itNewsData : itNewsData.slice(0, 4)).map((news, index) => (
                <div
                  key={index}
                  className="flex items-center"
                  style={{ gap: 'var(--space-3)' }}
                  onClick={() => window.open(news.link, '_blank')}
                >
                  <div className="flex-1">
                    <h3 className="font-medium line-clamp-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>{news.title}</h3>
                    <p className="flex items-center" style={{ gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
                      <Clock className="w-3 h-3" />
                      {news.created}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ padding: 'var(--space-4)' }}>
              <div className="flex" style={{ gap: 'var(--space-1-5)' }}>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: 'var(--duration-bounce-delay)' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: 'calc(var(--duration-bounce-delay) * 2)' }}></div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 'var(--space-3)' }}>
        <div className="shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>历史今天</h2>
            {todayInHistoryData && todayInHistoryData.length > 4 && (
              <button
                onClick={() => setExpandedNews(expandedNews === 'todayInHistory' ? null : 'todayInHistory')}
                className="flex items-center"
                style={{ gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
              >
                {expandedNews === 'todayInHistory' ? '收起' : '更多'}
                <ChevronRight className={`w-3 h-3 transition-transform ${expandedNews === 'todayInHistory' ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>
          
          {todayInHistoryData?.length ? (
            <div style={{ gap: 'var(--space-2)' }}>
              {(expandedNews === 'todayInHistory' ? todayInHistoryData : todayInHistoryData.slice(0, 4)).map((item, index) => (
                <div
                  key={index}
                  className="flex items-start rounded-lg"
                  style={{ gap: 'var(--space-2)', padding: 'var(--space-2)', backgroundColor: 'var(--color-bg-tertiary)' }}
                  onClick={() => item.link && window.open(item.link, '_blank')}
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>{item.title}</p>
                    {item.description && (
                      <p className="line-clamp-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>{item.description}</p>
                    )}
                  </div>
                  {item.link && <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ padding: 'var(--space-4)' }}>
              <div className="flex" style={{ gap: 'var(--space-1-5)' }}>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: 'var(--duration-bounce-delay)' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: 'calc(var(--duration-bounce-delay) * 2)' }}></div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>AI 资讯</h2>
            {aiNewsData && aiNewsData.length > 4 && (
              <button
                onClick={() => setExpandedNews(expandedNews === 'aiNews' ? null : 'aiNews')}
                className="flex items-center"
                style={{ gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
              >
                {expandedNews === 'aiNews' ? '收起' : '更多'}
                <ChevronRight className={`w-3 h-3 transition-transform ${expandedNews === 'aiNews' ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>
          
          {aiNewsData?.length ? (
            <div style={{ gap: 'var(--space-3)' }}>
              {(expandedNews === 'aiNews' ? aiNewsData : aiNewsData.slice(0, 4)).map((news, index) => (
                <div
                  key={index}
                  className="flex items-center"
                  style={{ gap: 'var(--space-3)' }}
                  onClick={() => window.open(news.link, '_blank')}
                >
                  <div className="flex-1">
                    <h3 className="font-medium line-clamp-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>{news.title}</h3>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>{news.source}</p>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ padding: 'var(--space-4)' }}>
              <div className="flex" style={{ gap: 'var(--space-1-5)' }}>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: 'var(--duration-bounce-delay)' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: 'calc(var(--duration-bounce-delay) * 2)' }}></div>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default MobileHome;