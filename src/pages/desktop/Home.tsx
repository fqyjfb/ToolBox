import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { hotNewsApi } from '../../services/hotNews';
import { QuickLaunchItem, loadHomeQuickLaunchApps, removeHomeQuickLaunchApp, saveHomeQuickLaunchApps, ensureAppIconsCached } from '../../utils/quickLaunch';
import { loadHomeTools } from '../../utils/homeTools';
import { loadHomeBookmarks, removeHomeBookmark, saveHomeBookmarkOrder, type HomeBookmark } from '../../utils/homeBookmarks';
import { isElectron } from '../../utils/environment';
import SearchBar from '../../components/home/SearchBar';
import FavoritesBar from '../../components/home/FavoritesBar';
import ToolGrid from '../../components/home/ToolGrid';
import NewsContainer from '../../components/home/NewsContainer';
import QuickLaunchBar from '../../components/home/QuickLaunchBar';
import HomeBookmarkBar from '../../components/home/HomeBookmarkBar';
import MoyuCard from '../../components/home/MoyuCard';
import { useHomeFavorites } from '../../hooks/useHomeFavorites';
import './Home.css';

const Home: React.FC = () => {
  const isDesktop = isElectron();

  const [sixtySecondsData, setSixtySecondsData] = useState<string[] | null>(null);
  const [sixtySecondsLoading, setSixtySecondsLoading] = useState(false);
  const [sixtySecondsError, setSixtySecondsError] = useState('');

  const { favorites, handleFavoritesReorder } = useHomeFavorites();

  const [homeQuickLaunchApps, setHomeQuickLaunchApps] = useState<QuickLaunchItem[]>([]);
  const [homeBookmarks, setHomeBookmarks] = useState<HomeBookmark[]>([]);
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

  // forceRefresh 仅用于用户主动重试/刷新；首次进入走 cacheService 的缓存，避免每次
  // 回到首页都打网络并闪一次 loading
  const fetchSixtySeconds = useCallback(async (forceRefresh = false) => {
    setSixtySecondsLoading(true);
    setSixtySecondsError('');

    try {
      const data = await hotNewsApi.getSixtySecondsData({ forceRefresh });
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

  const handleRetrySixtySeconds = useCallback(() => {
    void fetchSixtySeconds(true);
  }, [fetchSixtySeconds]);

  const fetchHomeQuickLaunchApps = useCallback(() => {
    const apps = loadHomeQuickLaunchApps();
    setHomeQuickLaunchApps(apps);
    if (apps.length > 0) {
      ensureAppIconsCached(apps).catch(() => {});
    }
  }, []);

  const handleRemoveHomeQuickLaunch = useCallback((appId: string) => {
    removeHomeQuickLaunchApp(appId);
    setHomeQuickLaunchApps(prev => prev.filter(app => app.id !== appId));
  }, []);

  const handleLaunchApp = useCallback((path: string) => {
    window.electron?.openFile(path);
  }, []);

  const handleQuickLaunchReorder = useCallback((reorderedApps: QuickLaunchItem[]) => {
    setHomeQuickLaunchApps(reorderedApps);
    saveHomeQuickLaunchApps(reorderedApps);
  }, []);

  const fetchHomeBookmarks = useCallback(async () => {
    setHomeBookmarks(await loadHomeBookmarks());
  }, []);

  const handleRemoveHomeBookmark = useCallback(async (id: string) => {
    setHomeBookmarks(prev => prev.filter(bookmark => bookmark.id !== id));
    await removeHomeBookmark(id);
  }, []);

  const handleHomeBookmarkReorder = useCallback(async (orderedIds: string[]) => {
    setHomeBookmarks(prev => {
      const bookmarkMap = new Map(prev.map(bookmark => [bookmark.id, bookmark]));
      return orderedIds
        .map(id => bookmarkMap.get(id))
        .filter((bookmark): bookmark is HomeBookmark => !!bookmark);
    });
    await saveHomeBookmarkOrder(orderedIds);
  }, []);

  const navigateToTool = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const refreshHomeTools = useCallback(() => {
    setHomeTools(loadHomeTools());
  }, []);

  useEffect(() => {
    fetchSixtySeconds();
    if (isDesktop) {
      fetchHomeQuickLaunchApps();
      void fetchHomeBookmarks();
    }
  }, [fetchSixtySeconds, fetchHomeQuickLaunchApps, fetchHomeBookmarks, isDesktop]);

  // 插件窗口改动首页网址后，回到主窗口即刷新
  useEffect(() => {
    if (!isDesktop) return;
    const handleFocus = () => { void fetchHomeBookmarks(); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchHomeBookmarks, isDesktop]);

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
    <div className="h-full flex flex-col">
      <div className="flex flex-col items-center gap-2 mb-2 flex-shrink-0">
        <SearchBar searchTypes={searchTypes} />
        <FavoritesBar favorites={favorites} onReorder={handleFavoritesReorder} />
      </div>

      <div className="flex gap-2 flex-1 items-stretch min-h-0">
        <div className="flex flex-col gap-1 w-home-card flex-shrink-0">
          <ToolGrid tools={homeTools} onToolClick={navigateToTool} />
          {isDesktop && (
            <div className="flex-1 min-h-0 flex flex-col quicklaunch-group">
              <QuickLaunchBar
                apps={homeQuickLaunchApps}
                onLaunch={handleLaunchApp}
                onRemove={handleRemoveHomeQuickLaunch}
                onReorder={handleQuickLaunchReorder}
              />
              <HomeBookmarkBar
                bookmarks={homeBookmarks}
                onRemove={handleRemoveHomeBookmark}
                onReorder={handleHomeBookmarkReorder}
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <NewsContainer
            sixtySecondsLoading={sixtySecondsLoading}
            sixtySecondsError={sixtySecondsError}
            sixtySecondsData={sixtySecondsData}
            onRetrySixtySeconds={handleRetrySixtySeconds}
          />
        </div>

        <div className="w-72 flex-shrink-0">
          <MoyuCard className="h-full" />
        </div>
      </div>
    </div>
  );
};

export default React.memo(Home);