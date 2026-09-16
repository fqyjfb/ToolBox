// 收藏 hook：主进程（notes_settings.json）是真相源，渲染层 state 仅作缓存与订阅


import { useCallback, useEffect, useState } from 'react';
import { logError } from '../../../../services/loggerService';
import type { NotesFavoritePath } from '../types';

export interface UseNotesFavoritesReturn {
  favorites: NotesFavoritePath[];
  favoritePaths: NotesFavoritePath[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggle: (absolutePath: NotesFavoritePath) => Promise<boolean>;
  setAll: (next: NotesFavoritePath[]) => Promise<void>;
  isFavorite: (absolutePath: NotesFavoritePath) => boolean;
}

export function useNotesFavorites(): UseNotesFavoritesReturn {
  const [favorites, setFavorites] = useState<NotesFavoritePath[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!window.electron) return;
    setIsLoading(true);
    try {
      const res = await window.electron.notes.getFavorites();
      if (res.success) {
        setFavorites(res.favorites);
        setError(null);
      } else {
        setError(res.error || '读取收藏失败');
      }
    } catch (err) {
      logError('读取收藏失败', 'useNotesFavorites', err as Error);
      setError(err instanceof Error ? err.message : '读取收藏失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 返回值：toggle 后是否被加入收藏（true=新加入，false=已移除）
  const toggle = useCallback(async (absolutePath: NotesFavoritePath): Promise<boolean> => {
    if (!window.electron) return false;
    try {
      const res = await window.electron.notes.toggleFavorite(absolutePath);
      if (res.success) {
        setFavorites(res.favorites);
        setError(null);
        return res.toggled;
      }
      setError(res.error || '切换收藏失败');
      return false;
    } catch (err) {
      logError('切换收藏失败', 'useNotesFavorites', err as Error);
      setError(err instanceof Error ? err.message : '切换收藏失败');
      return false;
    }
  }, []);

  const setAll = useCallback(async (next: NotesFavoritePath[]) => {
    if (!window.electron) return;
    try {
      const res = await window.electron.notes.setFavorites(next);
      if (res.success) {
        setFavorites(res.favorites);
        setError(null);
      } else {
        setError(res.error || '保存收藏失败');
      }
    } catch (err) {
      logError('保存收藏失败', 'useNotesFavorites', err as Error);
      setError(err instanceof Error ? err.message : '保存收藏失败');
    }
  }, []);

  // mount 时从主进程拉一次
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isFavorite = useCallback(
    (absolutePath: NotesFavoritePath) => favorites.includes(absolutePath),
    [favorites]
  );

  return {
    favorites,
    favoritePaths: favorites,
    isLoading,
    error,
    refresh,
    toggle,
    setAll,
    isFavorite,
  };
}
