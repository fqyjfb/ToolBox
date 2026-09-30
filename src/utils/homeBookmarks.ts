import { localStorageService, STORAGE_KEYS } from '../services/localStorageService';

// 首页网址区域与「网址收藏夹」插件（plugin-favorite）互通：
// 数据仍存放在插件自身的存储中，主应用只读写插件数据里的首页展示标记与排序号
const FAVORITE_PLUGIN_ID = 'plugin-favorite';
const PLUGIN_DATA_KEY = 'data';

export interface HomeBookmark {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  // 是否在首页显示（由插件右键菜单「首页显示」设置）
  showOnHome?: boolean;
  // 首页内的展示顺序（拖拽排序回写）
  homeOrder?: number;
}

interface FavoritePluginData {
  version?: string;
  bookmarks?: HomeBookmark[];
  categories?: unknown[];
  settings?: Record<string, unknown>;
}

const getUserId = (): string =>
  localStorageService.get<{ id?: string } | null>(STORAGE_KEYS.USER, null)?.id || 'default';

const readPluginData = async (): Promise<FavoritePluginData | null> => {
  try {
    const data = await window.electron?.plugin?.storage.get<FavoritePluginData>(
      FAVORITE_PLUGIN_ID,
      getUserId(),
      PLUGIN_DATA_KEY
    );
    return data?.bookmarks ? data : null;
  } catch {
    return null;
  }
};

const writePluginData = async (data: FavoritePluginData): Promise<void> => {
  try {
    await window.electron?.plugin?.storage.set(
      FAVORITE_PLUGIN_ID,
      getUserId(),
      PLUGIN_DATA_KEY,
      data
    );
  } catch {
    // 写入失败不影响首页展示
  }
};

// 首页展示的网址：插件中标记为「首页显示」的书签，按 homeOrder 排序
export const loadHomeBookmarks = async (): Promise<HomeBookmark[]> => {
  const data = await readPluginData();
  if (!data) return [];

  return data.bookmarks!
    .filter(bookmark => bookmark.showOnHome)
    .sort((a, b) => (a.homeOrder ?? 0) - (b.homeOrder ?? 0));
};

// 拖拽排序：按首页中的顺序回写 homeOrder
export const saveHomeBookmarkOrder = async (orderedIds: string[]): Promise<void> => {
  const data = await readPluginData();
  if (!data) return;

  const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
  data.bookmarks = data.bookmarks!.map(bookmark =>
    orderMap.has(bookmark.id)
      ? { ...bookmark, homeOrder: orderMap.get(bookmark.id)! }
      : bookmark
  );
  await writePluginData(data);
};

// 从首页移除：只取消首页显示标记，插件中的书签保留
export const removeHomeBookmark = async (id: string): Promise<void> => {
  const data = await readPluginData();
  if (!data) return;

  data.bookmarks = data.bookmarks!.map(bookmark =>
    bookmark.id === id ? { ...bookmark, showOnHome: false } : bookmark
  );
  await writePluginData(data);
};

// 图标：优先用书签自带图标，缺失时回退到公共 favicon 服务
export const getHomeBookmarkIcon = (bookmark: HomeBookmark): string => {
  if (bookmark.favicon) return bookmark.favicon;
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=64`;
  } catch {
    return '';
  }
};
