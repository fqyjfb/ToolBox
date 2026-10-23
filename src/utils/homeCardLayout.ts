import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';

/** 网格单元坐标：0-based 的左上角单元格 */
export interface Cell {
  col: number;
  row: number;
}

/** 首页统一网格的卡片坐标布局：cardId -> 左上角单元格 */
export type HomeCardLayout = Record<string, Cell>;

/** 参与排布的卡片几何描述（HomeCard 的子集，span 不落盘，永远以实时数据为准） */
interface CardSize {
  id: string;
  colSpan: number;
  rowSpan: number;
}

interface Slot extends Cell, CardSize {}

const cellKey = (row: number, col: number): string => `${row}:${col}`;

const area = (slot: Slot): number => slot.colSpan * slot.rowSpan;

const covers = (slot: Slot): string[] => {
  const keys: string[] = [];
  for (let row = slot.row; row < slot.row + slot.rowSpan; row += 1) {
    for (let col = slot.col; col < slot.col + slot.colSpan; col += 1) {
      keys.push(cellKey(row, col));
    }
  }
  return keys;
};

const intersects = (a: Slot, b: Slot): boolean =>
  a.col < b.col + b.colSpan &&
  b.col < a.col + a.colSpan &&
  a.row < b.row + b.rowSpan &&
  b.row < a.row + a.rowSpan;

const fits = (slot: Slot, occupied: Set<string>, columns: number): boolean => {
  if (slot.col < 0 || slot.row < 0 || slot.col + slot.colSpan > columns) return false;
  return covers(slot).every(key => !occupied.has(key));
};

const occupy = (slot: Slot, occupied: Set<string>): void => {
  for (const key of covers(slot)) occupied.add(key);
};

const occupancy = (slots: Slot[], excludeId?: string): Set<string> => {
  const occupied = new Set<string>();
  for (const slot of slots) {
    if (slot.id === excludeId) continue;
    occupy(slot, occupied);
  }
  return occupied;
};

const bottomRow = (slots: Slot[]): number =>
  slots.reduce((max, slot) => Math.max(max, slot.row + slot.rowSpan), 0);

const toLayout = (slots: Slot[]): HomeCardLayout => {
  const layout: HomeCardLayout = {};
  for (const slot of slots) layout[slot.id] = { col: slot.col, row: slot.row };
  return layout;
};

/** 行优先枚举所有能容纳 slot 的空位 */
const freeCells = (slot: Slot, occupied: Set<string>, columns: number, maxRow: number): Cell[] => {
  const cells: Cell[] = [];
  for (let row = 0; row <= maxRow; row += 1) {
    for (let col = 0; col + slot.colSpan <= columns; col += 1) {
      const cell = { row, col };
      if (fits({ ...slot, ...cell }, occupied, columns)) cells.push(cell);
    }
  }
  return cells;
};

/** 第一个空位（行优先），用于新增卡片补位 —— 等价于老版本自动排布的顺序 */
const firstFreeCell = (slot: Slot, occupied: Set<string>, columns: number, maxRow: number): Cell =>
  freeCells(slot, occupied, columns, maxRow)[0] ?? { row: maxRow + 1, col: 0 };

/** 离原位最近的空位（曼哈顿距离优先，同行同距再按行优先），用于让位 */
const nearestFreeCell = (slot: Slot, occupied: Set<string>, columns: number, maxRow: number): Cell => {
  const cells = freeCells(slot, occupied, columns, maxRow);
  if (cells.length === 0) return { row: maxRow + 1, col: 0 };

  const distance = (cell: Cell): number => Math.abs(cell.row - slot.row) + Math.abs(cell.col - slot.col);
  return cells.reduce((best, cell) => {
    const gap = distance(cell) - distance(best);
    if (gap < 0) return cell;
    if (gap > 0) return best;
    return cell.row < best.row || (cell.row === best.row && cell.col < best.col) ? cell : best;
  });
};

const clampCell = (cell: Cell, slot: Slot, columns: number): Cell => ({
  col: Math.min(Math.max(cell.col, 0), Math.max(0, columns - slot.colSpan)),
  row: Math.max(cell.row, 0),
});

/**
 * 把「持久化坐标 + 当前卡片集合 + 当前列数」收敛成一份可直接渲染的完整布局：
 * 剔除失效 id、夹紧越界列、新增卡片补位、冲突就近让位。纯函数，结果可复现，
 * 因此窗口缩放导致的列数收敛只影响渲染值，不必写回存档。
 */
export const reconcileLayout = (
  cards: CardSize[],
  legacyOrder: string[],
  saved: HomeCardLayout,
  columns: number,
): HomeCardLayout => {
  // 迁移序：老顺序（剔除失效 id）在前，未记录的卡片按数据源顺序追加
  const byId = new Map(cards.map(card => [card.id, card]));
  const ordered: CardSize[] = [];
  const seen = new Set<string>();
  const push = (card: CardSize | undefined): void => {
    if (!card || seen.has(card.id)) return;
    seen.add(card.id);
    ordered.push(card);
  };
  for (const id of legacyOrder) push(byId.get(id));
  for (const card of cards) push(card);

  const slots: Slot[] = ordered.map(card => ({
    id: card.id,
    colSpan: Math.max(1, Math.min(card.colSpan, columns)),
    rowSpan: Math.max(1, card.rowSpan),
    col: 0,
    row: 0,
  }));
  const orderIndex = new Map(ordered.map((card, index) => [card.id, index]));
  const maxRowSpan = slots.reduce((max, slot) => Math.max(max, slot.rowSpan), 1);

  const occupied = new Set<string>();
  const placed: Slot[] = [];
  // 空位搜索的行上界：已用行数 + 一个最高卡片，避免误拖撑出大片空白
  const searchLimit = (): number => bottomRow(placed) + maxRowSpan;
  const commit = (slot: Slot): void => {
    placed.push(slot);
    occupy(slot, occupied);
  };

  // 1) 有存档坐标的卡片：按 (row, col, 迁移序) 依次落位，列夹紧后冲突则就近让位
  const positioned = slots
    .filter(slot => saved[slot.id])
    .map(slot => ({ ...slot, ...clampCell(saved[slot.id], slot, columns) }))
    .sort((a, b) => a.row - b.row || a.col - b.col ||
      (orderIndex.get(a.id) ?? ordered.length) - (orderIndex.get(b.id) ?? ordered.length));

  for (const slot of positioned) {
    commit(fits(slot, occupied, columns)
      ? slot
      : { ...slot, ...nearestFreeCell(slot, occupied, columns, searchLimit()) });
  }

  // 2) 新增卡片：按迁移序、行优先找第一个空位
  for (const slot of slots) {
    if (saved[slot.id]) continue;
    commit({ ...slot, ...firstFreeCell(slot, occupied, columns, searchLimit()) });
  }

  return toLayout(placed);
};

/**
 * 把拖拽卡落到 target 单元，并让被占用的卡片就近让位，返回一份不重叠的布局。
 *
 * - R0 大卡排斥：目标格压住更大的卡片时，大卡不动，拖拽卡改为落到最近空位
 * - R1 同尺寸互换：目标格被一张同尺寸卡片完全占据时，两者直接互换
 * - R2 小卡让位：其余被占用的卡片按「行优先、再按序」重定位到最近空位
 *
 * 未受影响的卡片坐标原地不变 —— 卡片之间可以留出空洞，不再被自动回填。
 */
export const applyMove = (
  base: HomeCardLayout,
  cards: CardSize[],
  sequence: string[],
  movingId: string,
  target: Cell,
  columns: number,
): HomeCardLayout => {
  const slots: Slot[] = cards
    .filter(card => base[card.id])
    .map(card => ({
      id: card.id,
      colSpan: Math.max(1, Math.min(card.colSpan, columns)),
      rowSpan: Math.max(1, card.rowSpan),
      ...base[card.id],
    }));

  const moving = slots.find(slot => slot.id === movingId);
  if (!moving) return base;

  const maxRowSpan = slots.reduce((max, slot) => Math.max(max, slot.rowSpan), 1);
  const movingRect: Slot = { ...moving, ...target };
  const blocked = slots.some(slot =>
    slot.id !== movingId && area(slot) > area(moving) && intersects(movingRect, slot));
  const destination = blocked
    ? nearestFreeCell(movingRect, occupancy(slots, movingId), columns, bottomRow(slots) + maxRowSpan)
    : target;

  const occupant = slots.find(slot =>
    slot.id !== movingId &&
    slot.colSpan === moving.colSpan &&
    slot.rowSpan === moving.rowSpan &&
    slot.col === destination.col &&
    slot.row === destination.row);

  // 落点没变且没有可互换的卡片：本次移动不需要产生新布局
  if (!occupant && destination.col === moving.col && destination.row === moving.row) return base;

  const placed: Slot[] = [];
  const occupied = new Set<string>();
  const commit = (slot: Slot): void => {
    placed.push(slot);
    occupy(slot, occupied);
  };

  commit({ ...moving, ...destination });
  if (occupant) commit({ ...occupant, col: moving.col, row: moving.row });

  const orderIndex = new Map(sequence.map((id, index) => [id, index]));
  const rest = slots
    .filter(slot => slot.id !== movingId && slot.id !== occupant?.id)
    .sort((a, b) => a.row - b.row || a.col - b.col ||
      (orderIndex.get(a.id) ?? sequence.length) - (orderIndex.get(b.id) ?? sequence.length));

  for (const slot of rest) {
    commit(fits(slot, occupied, columns)
      ? slot
      : { ...slot, ...nearestFreeCell(slot, occupied, columns, bottomRow(placed) + maxRowSpan) });
  }

  return toLayout(placed);
};

/** 按坐标行优先排序，用于 DOM 顺序（Tab 焦点顺序与视觉阅读顺序保持一致） */
export const sortIdsByPosition = (layout: HomeCardLayout): string[] =>
  Object.keys(layout).sort((a, b) =>
    layout[a].row - layout[b].row || layout[a].col - layout[b].col || a.localeCompare(b));

export const loadHomeCardLayout = (): HomeCardLayout => {
  const saved = localStorageService.get<unknown>(STORAGE_KEYS.HOME_CARD_LAYOUT, {});
  if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return {};

  const layout: HomeCardLayout = {};
  for (const [id, value] of Object.entries(saved as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const { col, row } = value as Partial<Cell>;
    const colValue = Number(col);
    const rowValue = Number(row);
    if (!Number.isFinite(colValue) || !Number.isFinite(rowValue)) continue;
    layout[id] = { col: Math.trunc(colValue), row: Math.trunc(rowValue) };
  }
  return layout;
};

export const saveHomeCardLayout = (layout: HomeCardLayout): void => {
  localStorageService.set(STORAGE_KEYS.HOME_CARD_LAYOUT, layout);
};
