import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';

// 首页统一网格的卡片顺序持久化。
// 只存 id 数组，渲染时再与实时数据源对账（过滤已删除项 + 追加新增项），
// 因此缓存清理无需处理该键。
// 历史卡片 id 映射：天气卡原先是首页写死的 'weather'，现在由工具列表生成 'tool-weather'
const LEGACY_CARD_ID_ALIAS: Record<string, string> = { weather: 'tool-weather' };

export const loadHomeCardOrder = (): string[] => {
  const saved = localStorageService.get<unknown>(STORAGE_KEYS.HOME_CARD_ORDER, []);
  if (!Array.isArray(saved)) return [];
  return saved
    .filter((id): id is string => typeof id === 'string')
    .map(id => LEGACY_CARD_ID_ALIAS[id] ?? id);
};

export const saveHomeCardOrder = (order: string[]): void => {
  localStorageService.set(STORAGE_KEYS.HOME_CARD_ORDER, order);
};
