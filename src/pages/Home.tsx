import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { hotNewsApi } from '../services/hotNews';
import { supabase } from '../services/supabase';
import { websiteService } from '../services/WebsiteService';
import { QuickLaunchItem, loadHomeQuickLaunchApps, removeHomeQuickLaunchApp, saveHomeQuickLaunchApps } from '../utils/quickLaunch';
import { loadHomeTools } from '../utils/homeTools';
import { isElectron } from '../utils/environment';
import type { ItNewsItem, AiNewsItem, TodayInHistoryItem } from '../types/hotNews';
import SearchBar from '../components/home/SearchBar';
import FavoritesBar, { Bookmark } from '../components/home/FavoritesBar';
import ToolGrid from '../components/home/ToolGrid';
import NewsContainer from '../components/home/NewsContainer';
import QuickLaunchBar from '../components/home/QuickLaunchBar';
import MoyuCard from '../components/home/MoyuCard';
import './Home.css';

const Home: React.FC = () => {
  const isDesktop = isElectron();
  
  const [sixtySecondsData, setSixtySecondsData] = useState<string[] | null>(null);
  const [sixtySecondsLoading, setSixtySecondsLoading] = useState(false);
  const [sixtySecondsError, setSixtySecondsError] = useState('');

  const [todayInHistoryData, setTodayInHistoryData] = useState<TodayInHistoryItem[] | null>(null);
  const [todayInHistoryLoading, setTodayInHistoryLoading] = useState(false);
  const [todayInHistoryError, setTodayInHistoryError] = useState('');

  const [itNewsData, setItNewsData] = useState<ItNewsItem[] | null>(null);
  const [itNewsLoading, setItNewsLoading] = useState(false);
  const [itNewsError, setItNewsError] = useState('');

  const [aiNewsData, setAiNewsData] = useState<AiNewsItem[] | null>(null);
  const [aiNewsLoading, setAiNewsLoading] = useState(false);
  const [aiNewsError, setAiNewsError] = useState('');

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [favorites, setFavorites] = useState<Bookmark[]>(() => {
    const cached = localStorage.getItem('homeFavorites');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        return data.favorites || [];
      } catch {
        return [];
      }
    }
    return [];
  });
  
  const [homeQuickLaunchApps, setHomeQuickLaunchApps] = useState<QuickLaunchItem[]>([]);
  const [homeTools, setHomeTools] = useState(() => loadHomeTools());
  
  const navigate = useNavigate();
  
  const searchTypes = [
    { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=%s%', placeholder: '百度一下' },
    { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s%', placeholder: 'Google搜索' },
    { id: '360', name: '360', url: 'https://www.so.com/s?q=%s%', placeholder: '360搜索' },
    { id: 'sogou', name: '搜狗', url: 'https://www.sogou.com/web?query=%s%', placeholder: '搜狗搜索' },
    { id: 'bing', name: 'Bing', url: 'https://cn.bing.com/search?q=%s%', placeholder: 'Bing搜索' },
    { id: 'shenma', name: '神马', url: 'https://yz.m.sm.cn/s?q=%s%', placeholder: '神马搜索' }
  ];

  const fetchSixtySeconds = useCallback(async () => {
    setSixtySecondsLoading(true);
    setSixtySecondsError('');
    
    try {
      const data = await hotNewsApi.getSixtySecondsData();
      if (data) {
        setSixtySecondsData(data.data.news);
      } else {
        setSixtySecondsError('获取数据失败，请稍后重试');
      }
    } catch {
      setSixtySecondsError('网络错误，请检查网络连接后重试');
    } finally {
      setSixtySecondsLoading(false);
    }
  }, []);

  const fetchTodayInHistory = useCallback(async () => {
    setTodayInHistoryLoading(true);
    setTodayInHistoryError('');
    
    try {
      const data = await hotNewsApi.getTodayInHistory();
      if (data) {
        setTodayInHistoryData(data.data.items);
      } else {
        setTodayInHistoryError('获取数据失败，请稍后重试');
      }
    } catch {
      setTodayInHistoryError('网络错误，请检查网络连接后重试');
    } finally {
      setTodayInHistoryLoading(false);
    }
  }, []);

  const fetchItNews = useCallback(async () => {
    setItNewsLoading(true);
    setItNewsError('');
    
    try {
      const data = await hotNewsApi.getItNews();
      if (data) {
        setItNewsData(data.data);
      } else {
        setItNewsError('获取数据失败，请稍后重试');
      }
    } catch {
      setItNewsError('网络错误，请检查网络连接后重试');
    } finally {
      setItNewsLoading(false);
    }
  }, []);

  const fetchAiNews = useCallback(async () => {
    setAiNewsLoading(true);
    setAiNewsError('');
    
    try {
      const data = await hotNewsApi.getAiNews();
      if (data) {
        setAiNewsData(data.data.news);
      } else {
        setAiNewsError('获取数据失败，请稍后重试');
      }
    } catch {
      setAiNewsError('网络错误，请检查网络连接后重试');
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

  const fetchFavorites = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated) return;
    
    const now = Date.now();
    const cacheExpiry = 5 * 60 * 1000;
    
    const cached = localStorage.getItem('homeFavorites');
    const cachedData = cached ? JSON.parse(cached) : null;
    const cachedTimestamp = cachedData?.timestamp || 0;
    
    if (!forceRefresh && cachedData?.favorites && (now - cachedTimestamp) < cacheExpiry) {
      if (favorites.length === 0 && cachedData.favorites.length > 0) {
        setFavorites(cachedData.favorites);
      }
      return;
    }
    
    try {
      const userFavorites = await websiteService.getFavorites();
      setFavorites(userFavorites);
      localStorage.setItem('homeFavorites', JSON.stringify({
        favorites: userFavorites,
        timestamp: now
      }));
    } catch {
      if (!cachedData?.favorites || cachedData.favorites.length === 0) {
        setFavorites([]);
      } else if (favorites.length === 0) {
        setFavorites(cachedData.favorites);
      }
    }
  }, [isAuthenticated]);

  const shouldFetchFavorites = useMemo(() => {
    return isAuthenticated && favorites.length === 0;
  }, [isAuthenticated, favorites.length]);

  const fetchHomeQuickLaunchApps = useCallback(() => {
    const apps = loadHomeQuickLaunchApps();
    setHomeQuickLaunchApps(apps);
  }, []);

  const handleRemoveHomeQuickLaunch = useCallback((appId: string) => {
    removeHomeQuickLaunchApp(appId);
    setHomeQuickLaunchApps(prev => prev.filter(app => app.id !== appId));
  }, []);

  const handleLaunchApp = useCallback((path: string) => {
    window.electron?.openFile(path);
  }, []);

  const handleFavoritesReorder = useCallback((reorderedFavorites: Bookmark[]) => {
    setFavorites(reorderedFavorites);
    localStorage.setItem('homeFavorites', JSON.stringify({
      favorites: reorderedFavorites,
      timestamp: Date.now()
    }));
  }, []);

  const handleQuickLaunchReorder = useCallback((reorderedApps: QuickLaunchItem[]) => {
    setHomeQuickLaunchApps(reorderedApps);
    saveHomeQuickLaunchApps(reorderedApps);
  }, []);

  const navigateToTool = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const refreshHomeTools = useCallback(() => {
    setHomeTools(loadHomeTools());
  }, []);

  useEffect(() => {
    fetchSixtySeconds();
    fetchTodayInHistory();
    fetchItNews();
    fetchAiNews();
    checkAuth();
    if (isDesktop) {
      fetchHomeQuickLaunchApps();
    }
  }, [fetchSixtySeconds, fetchTodayInHistory, fetchItNews, fetchAiNews, checkAuth, fetchHomeQuickLaunchApps, isDesktop]);

  useEffect(() => {
    if (shouldFetchFavorites) {
      fetchFavorites();
    } else if (!isAuthenticated) {
      setFavorites([]);
      localStorage.removeItem('homeFavorites');
    }
  }, [shouldFetchFavorites, isAuthenticated]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'homeTools') {
        refreshHomeTools();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshHomeTools]);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col items-center gap-2 mb-6 flex-shrink-0">
        <SearchBar searchTypes={searchTypes} />
        <FavoritesBar favorites={favorites} onReorder={handleFavoritesReorder} />
      </div>

      <div className="flex gap-2 flex-1 items-stretch min-h-0">
        <div className="flex flex-col gap-1 w-[280px] flex-shrink-0">
          <ToolGrid tools={homeTools} onToolClick={navigateToTool} />
          {isDesktop && (
            <div className="flex-1 min-h-0">
              <QuickLaunchBar
                apps={homeQuickLaunchApps}
                onLaunch={handleLaunchApp}
                onRemove={handleRemoveHomeQuickLaunch}
                onReorder={handleQuickLaunchReorder}
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <NewsContainer
            sixtySecondsLoading={sixtySecondsLoading}
            sixtySecondsError={sixtySecondsError}
            sixtySecondsData={sixtySecondsData}
            historyLoading={todayInHistoryLoading}
            historyError={todayInHistoryError}
            historyData={todayInHistoryData}
            itNewsLoading={itNewsLoading}
            itNewsError={itNewsError}
            itNewsData={itNewsData}
            aiNewsLoading={aiNewsLoading}
            aiNewsError={aiNewsError}
            aiNewsData={aiNewsData}
            onRetrySixtySeconds={fetchSixtySeconds}
            onRetryHistory={fetchTodayInHistory}
            onRetryItNews={fetchItNews}
            onRetryAiNews={fetchAiNews}
          />
        </div>

        <div className="w-72 flex-shrink-0">
          <MoyuCard className="h-full" />
        </div>
      </div>
    </div>
  );
};

export default Home;