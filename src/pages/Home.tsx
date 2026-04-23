import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { hotNewsApi } from '../services/hotNews';
import { supabase } from '../services/supabase';
import { websiteService } from '../services/WebsiteService';
import { QuickLaunchItem, loadHomeQuickLaunchApps, removeHomeQuickLaunchApp, saveHomeQuickLaunchApps } from '../utils/quickLaunch';
import { loadHomeTools } from '../utils/homeTools';
import SearchBar from '../components/home/SearchBar';
import FavoritesBar, { Bookmark } from '../components/home/FavoritesBar';
import ToolGrid from '../components/home/ToolGrid';
import NewsCard from '../components/home/NewsCard';
import HistoryCard from '../components/home/HistoryCard';
import QuickLaunchBar from '../components/home/QuickLaunchBar';
import './Home.css';

const Home: React.FC = () => {
  const [sixtySecondsData, setSixtySecondsData] = useState<string[] | null>(null);
  const [sixtySecondsLoading, setSixtySecondsLoading] = useState(false);
  const [sixtySecondsError, setSixtySecondsError] = useState('');

  const [todayInHistoryData, setTodayInHistoryData] = useState<any[] | null>(null);
  const [todayInHistoryLoading, setTodayInHistoryLoading] = useState(false);
  const [todayInHistoryError, setTodayInHistoryError] = useState('');

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
    checkAuth();
    fetchHomeQuickLaunchApps();
  }, [fetchSixtySeconds, fetchTodayInHistory, checkAuth, fetchHomeQuickLaunchApps]);

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
    <div className="p-6 h-full">
      <SearchBar searchTypes={searchTypes} />
      
      <div>
        <FavoritesBar favorites={favorites} onReorder={handleFavoritesReorder} />
      
        <div className="flex gap-6">
          <ToolGrid tools={homeTools} onToolClick={navigateToTool} />
          
          <div className="flex-1 flex flex-row gap-6">
            <NewsCard 
              loading={sixtySecondsLoading} 
              error={sixtySecondsError} 
              newsData={sixtySecondsData} 
              onRetry={fetchSixtySeconds} 
            />
            <HistoryCard 
              loading={todayInHistoryLoading} 
              error={todayInHistoryError} 
              historyData={todayInHistoryData} 
              onRetry={fetchTodayInHistory} 
            />
          </div>
        </div>

        <QuickLaunchBar 
          apps={homeQuickLaunchApps} 
          onLaunch={handleLaunchApp} 
          onRemove={handleRemoveHomeQuickLaunch}
          onReorder={handleQuickLaunchReorder}
        />
      </div>
    </div>
  );
};

export default Home;