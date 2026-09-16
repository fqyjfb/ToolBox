import { create } from 'zustand';
import type { Bookmark } from '../types/website';

// 网址导航页（/nav）的跨路由状态：PageTransition 按 pathname 强制重挂载，组件内 state
// 每次切回都会归零；提升到 store 后切回直接复用上次结果，不再重新拉取。
export interface NavStore {
  activeMainCategoryId: string | null;
  activeSubCategoryIds: Record<string, string>;
  favoritesView: boolean;
  favorites: Bookmark[];
  favoritesLoaded: boolean;
  setActiveMainCategory: (id: string) => void;
  setActiveSubCategory: (mainId: string, subId: string) => void;
  setFavoritesView: (on: boolean) => void;
  setFavorites: (list: Bookmark[]) => void;
  resetFavorites: () => void;
  applyFavorite: (id: string, bookmark: Bookmark | undefined, on: boolean) => void;
}

export const useNavStore = create<NavStore>((set) => ({
  activeMainCategoryId: null,
  activeSubCategoryIds: {},
  favoritesView: false,
  favorites: [],
  favoritesLoaded: false,

  setActiveMainCategory: (id) => set({ activeMainCategoryId: id }),

  setActiveSubCategory: (mainId, subId) =>
    set((s) => ({ activeSubCategoryIds: { ...s.activeSubCategoryIds, [mainId]: subId } })),

  setFavoritesView: (on) => set({ favoritesView: on }),

  setFavorites: (list) => set({ favorites: list, favoritesLoaded: true }),

  resetFavorites: () => set({ favorites: [], favoritesLoaded: false }),

  applyFavorite: (id, bookmark, on) =>
    set((s) => {
      if (!on) return { favorites: s.favorites.filter((f) => f.id !== id) };
      if (!bookmark || s.favorites.some((f) => f.id === id)) return s;
      return { favorites: [...s.favorites, bookmark] };
    }),
}));
