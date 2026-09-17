import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { websiteService } from '../services/WebsiteService';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';
import type { Bookmark } from '../components/home/FavoritesBar';

type FavoritesCache = { favorites: Bookmark[]; timestamp: number };

// 'unknown' 表示登录态尚未确认，此状态既不能拉取也不能清缓存：
// 旧实现用 boolean 初值 false 充当「未登录」，导致每次回到首页都先清空缓存再重新请求
type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

const CACHE_EXPIRY = 5 * 60 * 1000;

/**
 * 本次页面会话是否已成功拉取过收藏。
 * 切换导航只是组件卸载重挂，本模块不会重新求值，可据此复用数据；
 * 整页刷新（含设置里「刷新页面」快捷键，本质是 reload）会重新执行本模块，标记归零后照常重新拉取。
 */
let hasFetchedThisSession = false;

const readCache = (): FavoritesCache | null =>
  localStorageService.get<FavoritesCache | null>(STORAGE_KEYS.HOME_FAVORITES, null);

const writeCache = (favorites: Bookmark[]): void => {
  localStorageService.set(STORAGE_KEYS.HOME_FAVORITES, { favorites, timestamp: Date.now() } as FavoritesCache);
};

const isCacheFresh = (cache: FavoritesCache | null): boolean =>
  !!cache?.favorites && Date.now() - cache.timestamp < CACHE_EXPIRY;

// 首页网站导航收藏夹 Hook（三端共用）：登录态检查 + 收藏拉取 + 本地缓存
export const useHomeFavorites = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('unknown');
  // 首屏先用缓存渲染，回到首页不会闪一次空列表
  const [favorites, setFavorites] = useState<Bookmark[]>(() => readCache()?.favorites || []);

  useEffect(() => {
    let alive = true;

    void supabase.auth.getUser()
      .then(({ data }) => {
        if (alive) setAuthStatus(data.user ? 'authenticated' : 'anonymous');
      })
      .catch(() => {
        if (alive) setAuthStatus('anonymous');
      });

    return () => { alive = false; };
  }, []);

  useEffect(() => {
    // 登录态未确认前保持现状：不清缓存、不发起请求
    if (authStatus === 'unknown') return;

    if (authStatus === 'anonymous') {
      // 归零标记，使本次会话内重新登录后能再次拉取
      hasFetchedThisSession = false;
      localStorageService.remove(STORAGE_KEYS.HOME_FAVORITES);
      setFavorites([]);
      return;
    }

    // 本次页面会话已拉取过且缓存未过期：切换导航回来直接沿用，不再打网络、不闪空
    if (hasFetchedThisSession && isCacheFresh(readCache())) return;

    let alive = true;

    void websiteService.getFavorites()
      .then(userFavorites => {
        if (!alive) return;
        hasFetchedThisSession = true;
        writeCache(userFavorites);
        setFavorites(userFavorites);
      })
      .catch(() => {
        // 拉取失败时保留当前展示（缓存或上次结果），不置空
      });

    return () => { alive = false; };
  }, [authStatus]);

  const handleFavoritesReorder = useCallback((reorderedFavorites: Bookmark[]) => {
    setFavorites(reorderedFavorites);
    writeCache(reorderedFavorites);
  }, []);

  return {
    favorites,
    handleFavoritesReorder,
  };
};
