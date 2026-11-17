import type { StickyNoteColor } from '../../../types/stickyNote';

/** 便签配色清单：主窗口取色器与桌面便签右键菜单共用，顺序即展示顺序 */
export const STICKY_NOTE_COLORS: Array<{ value: StickyNoteColor; label: string }> = [
  { value: 'amber', label: '琥珀' },
  { value: 'blue', label: '蓝色' },
  { value: 'green', label: '绿色' },
  { value: 'gray', label: '灰色' },
  { value: 'rose', label: '粉色' },
  { value: 'purple', label: '紫色' },
  { value: 'cyan', label: '青色' },
  { value: 'orange', label: '橙色' },
];
