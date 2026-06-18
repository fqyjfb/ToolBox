import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, Zap, BookOpen, Sparkles, ChevronRight } from 'lucide-react';
import { hotNewsApi } from '../../services/hotNews';
import { loadHomeTools, type HomeToolItem } from '../../utils/homeTools';
import type { ItNewsItem, AiNewsItem, TodayInHistoryItem } from '../../types/hotNews';
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

  const [todayInHistoryData, setTodayInHistoryData] = useState<TodayInHistoryItem[] | null>(null);
  const [todayInHistoryLoading, setTodayInHistoryLoading] = useState(false);

  const [expandedNews, setExpandedNews] = useState<string | null>(null);

  const fetchSixtySeconds = useCallback(async () => {
    setSixtySecondsLoading(true);
    try {
      const data = await hotNewsApi.getSixtySecondsData();
      if (data) {
        setSixtySecondsData(data.data.news);
      }
    } catch { /* ignore */ } finally {
      setSixtySecondsLoading(false);
    }
  }, []);

  const fetchItNews = useCallback(async () => {
    setItNewsLoading(true);
    try {
      const data = await hotNewsApi.getItNews();
      if (data) {
        setItNewsData(data.data);
      }
    } catch { /* ignore */ } finally {
      setItNewsLoading(false);
    }
  }, []);

  const fetchAiNews = useCallback(async () => {
    setAiNewsLoading(true);
    try {
      const data = await hotNewsApi.getAiNews();
      if (data) {
        setAiNewsData(data.data.news);
      }
    } catch { /* ignore */ } finally {
      setAiNewsLoading(false);
    }
  }, []);

  const fetchTodayInHistory = useCallback(async () => {
    setTodayInHistoryLoading(true);
    try {
      const data = await hotNewsApi.getTodayInHistory();
      if (data) {
        setTodayInHistoryData(data.data.items);
      }
    } catch { /* ignore */ } finally {
      setTodayInHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      fetchSixtySeconds();
      fetchItNews();
      fetchAiNews();
      fetchTodayInHistory();
    }, 0);
  }, [fetchSixtySeconds, fetchItNews, fetchAiNews, fetchTodayInHistory]);

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
      <section style={{ marginBottom: 'var(--space-5)' }}>
        <div className="shadow-sm relative" style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
          <div className="hidden lg:block absolute top-4 right-4">
            <button
              onClick={() => handleToolClick('/tools/weather')}
              className="cursor-pointer"
              style={{ width: '110px', height: '65px' }}
            >
              <WeatherCard />
            </button>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:pr-32">
            <div className="flex-1 max-w-xl w-full">
              <div className="flex flex-wrap justify-center" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                {searchTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setActiveSearchType(type.id)}
                    className="font-medium transition-all rounded-full"
                    style={{
                      padding: 'var(--space-1-5) var(--space-4)',
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
                <Search className="absolute top-1/2 -translate-y-1/2 w-5 h-5" style={{ left: 'var(--space-3)', color: 'var(--color-text-tertiary)' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                  placeholder={searchTypes.find(t => t.id === activeSearchType)?.placeholder || '搜索...'}
                  className="w-full outline-none border rounded-xl placeholder-gray-400"
                  style={{
                    paddingLeft: 'var(--space-10)',
                    paddingRight: 'var(--space-4)',
                    paddingTop: 'var(--space-3)',
                    paddingBottom: 'var(--space-3)',
                    backgroundColor: 'var(--color-bg-tertiary)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-primary)',
                    borderColor: 'var(--color-border)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 'var(--space-4)' }}>
        <div className="lg:col-span-2" style={{ gap: 'var(--space-4)' }}>
          <section className="shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
              <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
                <Sparkles className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                <h2 className="font-semibold" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>60秒速览</h2>
              </div>
              {sixtySecondsData && sixtySecondsData.length > 5 && (
                <button
                  onClick={() => setExpandedNews(expandedNews === 'sixtySeconds' ? null : 'sixtySeconds')}
                  className="flex items-center transition-all"
                  style={{ gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                >
                  {expandedNews === 'sixtySeconds' ? '收起' : '更多'}
                  <ChevronRight className={`w-4 h-4 transition-transform ${expandedNews === 'sixtySeconds' ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>
            
            {sixtySecondsLoading ? (
              <div className="flex items-center justify-center" style={{ padding: 'var(--space-5)' }}>
                <div className="flex" style={{ gap: 'var(--space-2)' }}>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : sixtySecondsData?.length ? (
              <div style={{ gap: 'var(--space-3)' }}>
                {(expandedNews === 'sixtySeconds' ? sixtySecondsData : sixtySecondsData.slice(0, 5)).map((news, index) => (
                  <div
                    key={index}
                    className="flex items-start rounded-lg transition-colors"
                    style={{ gap: 'var(--space-3)', padding: 'var(--space-3)' }}
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                      {index + 1}
                    </span>
                    <p className="line-clamp-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{news}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center" style={{ padding: 'var(--space-4)', color: 'var(--color-text-tertiary)' }}>暂无数据</p>
            )}
          </section>

          <section className="shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
              <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
                <BookOpen className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
                <h2 className="font-semibold" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>科技资讯</h2>
              </div>
              {itNewsData && itNewsData.length > 6 && (
                <button
                  onClick={() => setExpandedNews(expandedNews === 'itNews' ? null : 'itNews')}
                  className="flex items-center transition-all"
                  style={{ gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                >
                  {expandedNews === 'itNews' ? '收起' : '更多'}
                  <ChevronRight className={`w-4 h-4 transition-transform ${expandedNews === 'itNews' ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>
            
            {itNewsLoading ? (
              <div className="flex items-center justify-center" style={{ padding: 'var(--space-5)' }}>
                <div className="flex" style={{ gap: 'var(--space-2)' }}>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : itNewsData?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 'var(--space-3)' }}>
                {(expandedNews === 'itNews' ? itNewsData : itNewsData.slice(0, 6)).map((news, index) => (
                  <div
                    key={index}
                    className="rounded-lg cursor-pointer transition-all"
                    style={{ padding: 'var(--space-3)', border: '1px solid var(--color-border)' }}
                    onClick={() => window.open(news.link, '_blank')}
                  >
                    <h3 className="font-medium line-clamp-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>{news.title}</h3>
                    <p className="flex items-center" style={{ gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                      <Clock className="w-3 h-3" />
                      {news.created}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center" style={{ padding: 'var(--space-4)', color: 'var(--color-text-tertiary)' }}>暂无数据</p>
            )}
          </section>

          <section className="shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
              <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
                <Clock className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
                <h2 className="font-semibold" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>历史今天</h2>
              </div>
              {todayInHistoryData && todayInHistoryData.length > 5 && (
                <button
                  onClick={() => setExpandedNews(expandedNews === 'todayInHistory' ? null : 'todayInHistory')}
                  className="flex items-center transition-all"
                  style={{ gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                >
                  {expandedNews === 'todayInHistory' ? '收起' : '更多'}
                  <ChevronRight className={`w-4 h-4 transition-transform ${expandedNews === 'todayInHistory' ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>
            
            {todayInHistoryLoading ? (
              <div className="flex items-center justify-center" style={{ padding: 'var(--space-5)' }}>
                <div className="flex" style={{ gap: 'var(--space-2)' }}>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : todayInHistoryData?.length ? (
              <div style={{ gap: 'var(--space-3)' }}>
                {(expandedNews === 'todayInHistory' ? todayInHistoryData : todayInHistoryData.slice(0, 5)).map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start rounded-lg cursor-pointer transition-colors"
                    style={{ gap: 'var(--space-3)', padding: 'var(--space-3)' }}
                    onClick={() => item.link && window.open(item.link, '_blank')}
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium line-clamp-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>{item.title}</p>
                      {item.description && (
                        <p className="line-clamp-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center" style={{ padding: 'var(--space-4)', color: 'var(--color-text-tertiary)' }}>暂无数据</p>
            )}
          </section>
        </div>

        <div style={{ gap: 'var(--space-4)' }}>
          <section className="shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <Zap className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <h2 className="font-semibold" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>快捷工具</h2>
            </div>
            
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-2)' }}>
              {quickTools.map((tool) => {
                const IconComponent = iconMap[tool.iconName] || iconMap.Clipboard;
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToolClick(tool.path)}
                    className="flex flex-col items-center transition-colors"
                    style={{ gap: 'var(--space-1-5)', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-lg)' }}
                  >
                    <div
                      className="rounded-xl flex items-center justify-center"
                      style={{ width: 'calc(var(--space-5) * 1.4)', height: 'calc(var(--space-5) * 1.4)', backgroundColor: tool.color }}
                    >
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-medium" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{tool.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="shadow-sm" style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
              <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
                <Sparkles className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
                <h2 className="font-semibold" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>AI 资讯</h2>
              </div>
              {aiNewsData && aiNewsData.length > 4 && (
                <button
                  onClick={() => setExpandedNews(expandedNews === 'aiNews' ? null : 'aiNews')}
                  className="flex items-center transition-all"
                  style={{ gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
                >
                  {expandedNews === 'aiNews' ? '收起' : '更多'}
                  <ChevronRight className={`w-4 h-4 transition-transform ${expandedNews === 'aiNews' ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>
            
            {aiNewsLoading ? (
              <div className="flex items-center justify-center" style={{ padding: 'var(--space-5)' }}>
                <div className="flex" style={{ gap: 'var(--space-2)' }}>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : aiNewsData?.length ? (
              <div style={{ gap: 'var(--space-3)' }}>
                {(expandedNews === 'aiNews' ? aiNewsData : aiNewsData.slice(0, 4)).map((news, index) => (
                  <div
                    key={index}
                    className="rounded-lg cursor-pointer transition-colors"
                    style={{ padding: 'var(--space-3)' }}
                    onClick={() => window.open(news.link, '_blank')}
                  >
                    <h3 className="font-medium line-clamp-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>{news.title}</h3>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>{news.source}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center" style={{ padding: 'var(--space-4)', color: 'var(--color-text-tertiary)' }}>暂无数据</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default WebHome;