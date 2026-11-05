/** QuickLaunch 拖拽相关常量与纯函数（从 QuickLaunch.tsx 提取，保持行为完全一致） */
import type { ClientRect } from '@dnd-kit/core';
import type { QuickLaunchItem, QuickLaunchCategory } from '../../../utils/quickLaunch';

/**
 * 文件夹磁贴中心区域内缩比例：磁贴中心区域松手=归入文件夹；
 * 边缘区域松手=把应用插入到该文件夹相邻的桌面槽位（可落在两个文件夹之间）。
 */
export const FOLDER_CORE_INSET_RATIO = 0.25;

export type FolderDropIntent = 'group' | 'insert-before' | 'insert-after';

/**
 * 取拖拽中的指针坐标：activatorEvent 是按下时的初始位置，叠加累计 delta 得到当前位置。
 * 键盘拖拽等无坐标输入返回 null（此时按归入处理，保持原有行为）。
 */
export const getDragPointer = (
  activatorEvent: Event,
  delta: { x: number; y: number }
): { x: number; y: number } | null => {
  if (!('clientX' in activatorEvent)) return null;
  const { clientX, clientY } = activatorEvent as MouseEvent;
  return { x: clientX + delta.x, y: clientY + delta.y };
};

/**
 * 判定应用落在文件夹磁贴上的意图：
 * 指针处于磁贴中心区域 → 归入；处于边缘 → 按最近的一条边插入到该文件夹前/后。
 */
export const resolveFolderDropIntent = (
  pointer: { x: number; y: number } | null,
  rect: ClientRect
): FolderDropIntent => {
  if (!pointer) return 'group';
  const insetX = rect.width * FOLDER_CORE_INSET_RATIO;
  const insetY = rect.height * FOLDER_CORE_INSET_RATIO;
  const inCore =
    pointer.x >= rect.left + insetX &&
    pointer.x <= rect.right - insetX &&
    pointer.y >= rect.top + insetY &&
    pointer.y <= rect.bottom - insetY;
  if (inCore) return 'group';
  const dLeft = pointer.x - rect.left;
  const dRight = rect.right - pointer.x;
  const dTop = pointer.y - rect.top;
  const dBottom = rect.bottom - pointer.y;
  return Math.min(dLeft, dTop) <= Math.min(dRight, dBottom) ? 'insert-before' : 'insert-after';
};

/** 当前展开的文件夹信息 */
export interface OpenFolderInfo {
  key: string;
  title: string;
  apps: QuickLaunchItem[];
  category: QuickLaunchCategory;
}
