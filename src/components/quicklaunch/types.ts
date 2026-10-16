import { QuickLaunchCategory, QuickLaunchItem } from '../../utils/quickLaunch';

/** 图标尺寸：与页面工具栏开关一致 */
export type AppTileSize = 'small' | 'medium';

export type DesktopTile =
  | { kind: 'folder'; category: QuickLaunchCategory; apps: QuickLaunchItem[] }
  | { kind: 'app'; app: QuickLaunchItem };

/**
 * dnd-kit 的布尔 disabled 只禁用 draggable、保留 droppable（兼容旧行为）。
 * 弹层打开时必须连 droppable 一起禁用，否则被遮罩挡住的桌面磁贴仍会被 pointerWithin 命中。
 */
export const SORTABLE_DISABLED = { draggable: true, droppable: true } as const;
