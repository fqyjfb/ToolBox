import { create } from 'zustand';

// 网址导航页（/nav）的跨路由状态：PageTransition 按 pathname 强制重挂载，组件内 state
// 每次切回都会归零；提升到 store 后切回直接复用上次结果。
// 收藏列表不在此处：它是服务端数据，统一由 websiteFavoritesQuery 缓存，
// 与首页收藏栏共用同一份，避免两份收藏各拉各的。
export interface NavStore {
  activeMainCategoryId: string | null;
  activeSubCategoryIds: Record<string, string>;
  favoritesView: boolean;
  setActiveMainCategory: (id: string) => void;
  setActiveSubCategory: (mainId: string, subId: string) => void;
  setFavoritesView: (on: boolean) => void;
}

export const useNavStore = create<NavStore>((set) => ({
  activeMainCategoryId: null,
  activeSubCategoryIds: {},
  favoritesView: false,

  setActiveMainCategory: (id) => set({ activeMainCategoryId: id }),

  setActiveSubCategory: (mainId, subId) =>
    set((s) => ({ activeSubCategoryIds: { ...s.activeSubCategoryIds, [mainId]: subId } })),

  setFavoritesView: (on) => set({ favoritesView: on }),
}));
