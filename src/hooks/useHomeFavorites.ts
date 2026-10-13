import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/AuthStore';
import { websiteFavoritesQuery } from '../services/websiteQueries';
import { queryKeys } from '../queries/keys';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';
import type { Bookmark } from '../types/website';

type FavoritesCache = { favorites: Bookmark[]; timestamp: number };

// 本地缓存只用于整页刷新后的首帧占位：此时 React Query 缓存为空，
// 先渲染上次结果，避免回到首页时收藏栏闪一次空列表。
// 缓存、失效、重试一律交给 React Query，不再自建 TTL 与「本次会话已拉取」标记。
const readCache = (): FavoritesCache | null =>
  localStorageService.get<FavoritesCache | null>(STORAGE_KEYS.HOME_FAVORITES, null);

const writeCache = (favorites: Bookmark[]): void => {
  localStorageService.set(STORAGE_KEYS.HOME_FAVORITES, { favorites, timestamp: Date.now() } as FavoritesCache);
};

// 首页网站导航收藏夹 Hook（三端共用）
export const useHomeFavorites = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  // 与网站导航页的收藏视图共用同一份缓存（websiteFavoritesQuery），
  // 任一侧收藏 / 取消收藏后两侧同时生效。
  const { data: favorites = [] } = useQuery({
    ...websiteFavoritesQuery,
    enabled: isAuthenticated,
    placeholderData: () => (isAuthenticated ? readCache()?.favorites : undefined),
  });

  // 未登录时清掉占位，避免下个账号首帧看到上个账号的收藏
  useEffect(() => {
    if (!isAuthenticated) localStorageService.remove(STORAGE_KEYS.HOME_FAVORITES);
  }, [isAuthenticated]);

  // 拖拽排序只改展示顺序（服务端没有该字段），同步进查询缓存与占位，刷新后仍保留
  const handleFavoritesReorder = useCallback((reorderedFavorites: Bookmark[]) => {
    queryClient.setQueryData(queryKeys.website.favorites(), reorderedFavorites);
    writeCache(reorderedFavorites);
  }, [queryClient]);

  return {
    favorites,
    handleFavoritesReorder,
  };
};
