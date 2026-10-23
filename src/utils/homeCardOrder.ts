import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';

// 首页卡片顺序已升级为坐标布局（见 utils/homeCardLayout），这里只保留老存档的读取，
// 用作「首次升级时按老顺序打包出初始坐标」的迁移输入，不再写回。
// 历史卡片 id 映射：天气卡原先是首页写死的 'weather'，现在由工具列表生成 'tool-weather'
const LEGACY_CARD_ID_ALIAS: Record<string, string> = { weather: 'tool-weather' };

export const loadHomeCardOrder = (): string[] => {
  const saved = localStorageService.get<unknown>(STORAGE_KEYS.HOME_CARD_ORDER, []);
  if (!Array.isArray(saved)) return [];
  return saved
    .filter((id): id is string => typeof id === 'string')
    .map(id => LEGACY_CARD_ID_ALIAS[id] ?? id);
};
