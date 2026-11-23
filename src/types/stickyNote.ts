/** 便签数据模型：与主进程 stickyNotesService.cjs 的存储结构保持一致 */

export type StickyNoteColor = 'amber' | 'blue' | 'green' | 'gray' | 'rose' | 'purple' | 'cyan' | 'orange';

export interface StickyNoteBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  displayId?: number;
}

export interface StickyNote {
  id: string;
  title: string;
  content: string;
  color: StickyNoteColor;
  pinned: boolean;
  /** 仅 pinned 时有值，用于重启恢复位置与尺寸 */
  bounds: StickyNoteBounds | null;
  createdAt: number;
  updatedAt: number;
}

export interface StickyNoteCreateInput {
  content: string;
  title?: string;
  color?: StickyNoteColor;
}

export interface StickyNoteUpdateInput {
  id: string;
  title?: string;
  content?: string;
  color?: StickyNoteColor;
  /** 渲染层客户端标识，用于广播时忽略自己的回声 */
  clientId?: string;
  /** P1-5 乐观并发：调用方已知的 updatedAt，与主进程不一致时返回 conflict=true */
  updatedAt?: number;
}

export interface StickyNoteChangedPayload {
  action: 'created' | 'updated' | 'removed' | 'pinned-changed';
  id: string;
  clientId?: string;
}

export interface StickyNoteResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}
