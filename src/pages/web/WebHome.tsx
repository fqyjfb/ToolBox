import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, Zap, BookOpen, Sparkles, ChevronRight } from 'lucide-react';
import { hotNewsApi } from '../../services/hotNews';
import { loadHomeTools, type HomeToolItem } from '../../utils/homeTools';
import { iconMap } from '../../utils/iconMap';
import type { ItNewsItem, AiNewsItem, TodayInHistoryItem } from '../../types/hotNews';
import WeatherCard from '../../components/home/WeatherCard';
import FavoritesBar from '../../components/home/FavoritesBar';
import { useHomeFavorites } from '../../hooks/useHomeFavorites';
import { useRevealAnimation } from '../../hooks/useScrollParallax';
import { DISPLAY_LIMITS } from '../../constants/timers';
import './WebHome.css';

const searchTypes = [
  { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=%s%', placeholder: '百度一下' },
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s%', placeholder: 'Google搜索' },
  { id: 'bing', name: 'Bing', url: 'https://cn.bing.com/search?q=%s%', placeholder: 'Bing搜索' },
];

const RevealSection: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const { ref, isVisible } = useRevealAnimation(0.1);
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`web-home__reveal${isVisible ? ' web-home__reveal--visible' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

const LoadingDots: React.FC = () => (
  <div className="web-home__loading-dots">
    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '0ms' }} />
    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '150ms' }} />
    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-secondary)', animationDelay: '300ms' }} />
  </div>
);

const WebHome: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchType, setActiveSearchType] = useState('baidu');
  const [homeTools] = useState(() => loadHomeTools());
  const { favorites, handleFavoritesReorder } = useHomeFavorites();

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

  const quickTools = useMemo<HomeToolItem[]>(() => homeTools.slice(0, DISPLAY_LIMITS.WEB_QUICK_TOOLS), [homeTools]);

  return (
    <div className="web-home p-4">
      <section className="web-home__hero">
        <div className="web-home__hero-content">
          <RevealSection>
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="flex-1 max-w-md w-full">
                <div className="flex flex-wrap justify-center" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                  {searchTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setActiveSearchType(type.id)}
                      className="font-medium transition-all rounded-full"
                      style={{
                        padding: 'var(--space-1-5) var(--space-4)',
                        fontSize: 'var(--text-xs)',
                        backgroundColor: activeSearchType === type.id ? 'var(--color-text-primary)' : 'transparent',
                        color: activeSearchType === type.id ? 'var(--color-bg-primary)' : 'var(--color-text-secondary)',
                        border: activeSearchType === type.id ? 'none' : '1px solid var(--color-border)',
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
                      paddingLeft: 'var(--space-9)',
                      paddingRight: 'var(--space-3)',
                      paddingTop: 'var(--space-2)',
                      paddingBottom: 'var(--space-2)',
                      backgroundColor: 'var(--color-bg-primary)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text-primary)',
                      borderColor: 'var(--color-border)',
                    }}
                  />
                </div>
              </div>
            </div>
          </RevealSection>

          <RevealSection>
            <FavoritesBar favorites={favorites} onReorder={handleFavoritesReorder} />
          </RevealSection>
        </div>
      </section>

      <div className="web-home__main-grid">
        <div className="web-home__col">
          <RevealSection>
            <section className="web-home__section">
              <div className="web-home__section-header">
                <div className="web-home__section-title web-home__section-title--accent">
                  <Sparkles className="web-home__section-icon w-5 h-5" />
                  60秒速览
                </div>
                {sixtySecondsData && sixtySecondsData.length > 5 && (
                  <button
                    onClick={() => setExpandedNews(expandedNews === 'sixtySeconds' ? null : 'sixtySeconds')}
                    className="web-home__expand-btn"
                  >
                    {expandedNews === 'sixtySeconds' ? '收起' : '更多'}
                    <ChevronRight className={`web-home__expand-icon${expandedNews === 'sixtySeconds' ? ' web-home__expand-icon--rotated' : ''}`} />
                  </button>
                )}
              </div>

              {sixtySecondsLoading ? (
                <LoadingDots />
              ) : sixtySecondsData?.length ? (
                <div className="web-home__news-list">
                  {(expandedNews === 'sixtySeconds' ? sixtySecondsData : sixtySecondsData.slice(0, DISPLAY_LIMITS.WEB_SIXTY_SECONDS_NEWS)).map((news, index) => (
                    <div key={index} className="web-home__news-item">
                      <span className="web-home__news-index">{index + 1}</span>
                      <p className="web-home__news-text">{news}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="web-home__empty">暂无数据</p>
              )}
            </section>
          </RevealSection>

          <RevealSection>
            <section className="web-home__section">
              <div className="web-home__section-header">
                <div className="web-home__section-title">
                  <BookOpen className="web-home__section-icon w-5 h-5" />
                  科技资讯
                </div>
                {itNewsData && itNewsData.length > 6 && (
                  <button
                    onClick={() => setExpandedNews(expandedNews === 'itNews' ? null : 'itNews')}
                    className="web-home__expand-btn"
                  >
                    {expandedNews === 'itNews' ? '收起' : '更多'}
                    <ChevronRight className={`web-home__expand-icon${expandedNews === 'itNews' ? ' web-home__expand-icon--rotated' : ''}`} />
                  </button>
                )}
              </div>

              {itNewsLoading ? (
                <LoadingDots />
              ) : itNewsData?.length ? (
                <div className="web-home__news-grid web-home__news-grid--2">
                  {(expandedNews === 'itNews' ? itNewsData : itNewsData.slice(0, DISPLAY_LIMITS.WEB_IT_NEWS)).map((news, index) => (
                    <div
                      key={index}
                      className="web-home__news-card"
                      onClick={() => window.open(news.link, '_blank')}
                    >
                      <h3 className="web-home__news-card-title line-clamp-2">{news.title}</h3>
                      <p className="web-home__news-card-meta">
                        <Clock className="w-3 h-3" />
                        {news.created}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="web-home__empty">暂无数据</p>
              )}
            </section>
          </RevealSection>

          <RevealSection>
            <section className="web-home__section">
              <div className="web-home__section-header">
                <div className="web-home__section-title">
                  <Clock className="web-home__section-icon w-5 h-5" />
                  历史今天
                </div>
                {todayInHistoryData && todayInHistoryData.length > 5 && (
                  <button
                    onClick={() => setExpandedNews(expandedNews === 'todayInHistory' ? null : 'todayInHistory')}
                    className="web-home__expand-btn"
                  >
                    {expandedNews === 'todayInHistory' ? '收起' : '更多'}
                    <ChevronRight className={`web-home__expand-icon${expandedNews === 'todayInHistory' ? ' web-home__expand-icon--rotated' : ''}`} />
                  </button>
                )}
              </div>

              {todayInHistoryLoading ? (
                <LoadingDots />
              ) : todayInHistoryData?.length ? (
                <div className="web-home__news-list">
                  {(expandedNews === 'todayInHistory' ? todayInHistoryData : todayInHistoryData.slice(0, DISPLAY_LIMITS.WEB_TODAY_IN_HISTORY)).map((item, index) => (
                    <div
                      key={index}
                      className="web-home__news-item"
                      onClick={() => item.link && window.open(item.link, '_blank')}
                    >
                      <span className="web-home__news-index">{index + 1}</span>
                      <div className="flex-1">
                        <p className="web-home__news-item-title line-clamp-2">{item.title}</p>
                        {item.description && (
                          <p className="web-home__news-item-desc line-clamp-2">{item.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="web-home__empty">暂无数据</p>
              )}
            </section>
          </RevealSection>
        </div>

        <div className="web-home__col">
          <RevealSection>
            <section className="web-home__section">
              <div
                className="web-home__weather-inline"
                onClick={() => handleToolClick('/tools/weather')}
              >
                <WeatherCard />
              </div>
            </section>
          </RevealSection>

          <RevealSection>
            <section className="web-home__section">
              <div className="web-home__section-header">
                <div className="web-home__section-title web-home__section-title--blue">
                  <Zap className="web-home__section-icon w-5 h-5" />
                  快捷工具
                </div>
              </div>

              <div className="web-home__tools-grid">
                {quickTools.map((tool) => {
                  const IconComponent = iconMap[tool.iconName] || iconMap.Clipboard;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => handleToolClick(tool.path)}
                      className="web-home__tool-btn"
                    >
                      <div className="web-home__tool-icon" style={{ backgroundColor: tool.color }}>
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <span className="web-home__tool-name">{tool.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </RevealSection>

          <RevealSection>
            <section className="web-home__section">
              <div className="web-home__section-header">
                <div className="web-home__section-title">
                  <Sparkles className="web-home__section-icon w-5 h-5" />
                  AI 资讯
                </div>
                {aiNewsData && aiNewsData.length > 4 && (
                  <button
                    onClick={() => setExpandedNews(expandedNews === 'aiNews' ? null : 'aiNews')}
                    className="web-home__expand-btn"
                  >
                    {expandedNews === 'aiNews' ? '收起' : '更多'}
                    <ChevronRight className={`web-home__expand-icon${expandedNews === 'aiNews' ? ' web-home__expand-icon--rotated' : ''}`} />
                  </button>
                )}
              </div>

              {aiNewsLoading ? (
                <LoadingDots />
              ) : aiNewsData?.length ? (
                <div className="web-home__news-list">
                  {(expandedNews === 'aiNews' ? aiNewsData : aiNewsData.slice(0, DISPLAY_LIMITS.AI_NEWS)).map((news, index) => (
                    <div
                      key={index}
                      className="web-home__newsletter-item"
                      onClick={() => window.open(news.link, '_blank')}
                    >
                      <h3 className="web-home__newsletter-title line-clamp-2">{news.title}</h3>
                      <p className="web-home__newsletter-source">{news.source}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="web-home__empty">暂无数据</p>
              )}
            </section>
          </RevealSection>
        </div>
      </div>
    </div>
  );
};

export default WebHome;
