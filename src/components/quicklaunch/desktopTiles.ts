import {
  QuickLaunchCategory,
  QuickLaunchItem,
  QuickLaunchSortMode,
  sortAppsByMode,
} from '../../utils/quickLaunch';
import { DesktopTile } from './types';

/**
 * 桌面磁贴构建（custom 与非 custom 共用一条路径）：
 * 位置由 ordered 决定（文件夹位置恒定、始终可拖动），未分类应用按排序模式填充到应用槽位。
 * 已归入文件夹的应用其 app: 键保留在 ordered 中但隐藏（拖出时可回到原位）。
 *
 * @returns tiles 实际渲染的磁贴；slotKeys 与 tiles 一一对应的顺序键
 */
export const buildDesktopTiles = (
  ordered: string[],
  categories: QuickLaunchCategory[],
  apps: QuickLaunchItem[],
  sortMode: QuickLaunchSortMode
): { tiles: DesktopTile[]; slotKeys: string[] } => {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const byId = new Map(apps.map((a) => [a.id, a]));
  const looseIds = new Set(apps.filter((a) => !a.categoryId).map((a) => a.id));

  // 槽位内的未分类应用：custom 时即用户拖拽顺序，其他模式按其排序后再回填
  const looseInSlots = ordered
    .filter((key) => key.startsWith('app:'))
    .map((key) => byId.get(key.slice(4)))
    .filter((app): app is QuickLaunchItem => !!app && looseIds.has(app.id));

  const fill = sortMode === 'custom' ? looseInSlots : sortAppsByMode(looseInSlots, sortMode);

  const tiles: DesktopTile[] = [];
  const slotKeys: string[] = [];
  let cursor = 0;

  for (const key of ordered) {
    if (key.startsWith('cat:')) {
      const category = catById.get(key.slice(4));
      if (!category) continue;
      slotKeys.push(key);
      tiles.push({
        kind: 'folder',
        category,
        apps: apps.filter((app) => app.categoryId === category.id),
      });
      continue;
    }
    // 该应用已归入文件夹 → 槽位隐藏，不渲染也不占用 fill
    if (!looseIds.has(key.slice(4))) continue;
    const app = fill[cursor++];
    if (!app) continue;
    slotKeys.push(key);
    tiles.push({ kind: 'app', app });
  }

  return { tiles, slotKeys };
};

/**
 * 把新的渲染槽位顺序写回 ordered，保留其中隐藏键的位置与内容。
 * 直接覆盖 ordered 会丢失已归入文件夹的应用槽位。
 */
export const writeBackSlots = (
  ordered: string[],
  slotKeys: string[],
  nextSlotKeys: string[]
): string[] => {
  const isSlot = new Set(slotKeys);
  let cursor = 0;
  return ordered.map((key) => (isSlot.has(key) ? nextSlotKeys[cursor++] ?? key : key));
};

/** 把 key 移动到 anchorKey 之前（anchorKey 为空则追加到末尾） */
export const repositionKey = (
  ordered: string[],
  key: string,
  anchorKey: string | null
): string[] => {
  const without = ordered.filter((item) => item !== key);
  if (!anchorKey) return [...without, key];
  const index = without.indexOf(anchorKey);
  if (index === -1) return [...without, key];
  return [...without.slice(0, index), key, ...without.slice(index)];
};
