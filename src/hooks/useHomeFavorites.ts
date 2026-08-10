import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { websiteService } from '../services/WebsiteService';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';
import type { Bookmark } from '../components/home/FavoritesBar';

type FavoritesCache = { favorites: Bookmark[]; timestamp: number };

const CACHE_EXPIRY = 5 * 60 * 1000;

const readCache = (): FavoritesCache | null => {
  return localStorageService.get<FavoritesCache | null>(STORAGE_KEYS.HOME_FAVORITES, null as unknown as FavoritesCache);
};

/**
 * 首页网站导航收藏夹 Hook
 * 三端（桌面/Web/Mobile）共用，负责登录态检查、收藏数据获取与本地缓存
 */
export const useHomeFavorites = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [favorites, setFavorites] = useState<Bookmark[]>(() => {
    const cached = readCache();
    return cached?.favorites || [];
  });

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
    const cached = readCache();
    const cachedTimestamp = cached?.timestamp || 0;

    if (!forceRefresh && cached?.favorites && (now - cachedTimestamp) < CACHE_EXPIRY) {
      if (favorites.length === 0 && cached.favorites.length > 0) {
        setFavorites(cached.favorites);
      }
      return;
    }

    try {
      const userFavorites = await websiteService.getFavorites();
      setFavorites(userFavorites);
      localStorageService.set(STORAGE_KEYS.HOME_FAVORITES, {
        favorites: userFavorites,
        timestamp: now
      });
    } catch {
      if (!cached?.favorites || cached.favorites.length === 0) {
        setFavorites([]);
      } else if (favorites.length === 0) {
        setFavorites(cached.favorites);
      }
    }
  }, [isAuthenticated, favorites.length]);

  const handleFavoritesReorder = useCallback((reorderedFavorites: Bookmark[]) => {
    setFavorites(reorderedFavorites);
    localStorageService.set(STORAGE_KEYS.HOME_FAVORITES, {
      favorites: reorderedFavorites,
      timestamp: Date.now()
    });
  }, []);

  const shouldFetchFavorites = useMemo(() => {
    return isAuthenticated && favorites.length === 0;
  }, [isAuthenticated, favorites.length]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (shouldFetchFavorites) {
      fetchFavorites();
    } else if (!isAuthenticated) {
      setFavorites([]);
      localStorageService.remove(STORAGE_KEYS.HOME_FAVORITES);
    }
  }, [shouldFetchFavorites, isAuthenticated, fetchFavorites]);

  return {
    favorites,
    handleFavoritesReorder,
  };
};
