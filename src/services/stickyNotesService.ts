import type {
  StickyNote,
  StickyNoteChangedPayload,
  StickyNoteCreateInput,
  StickyNoteResult,
  StickyNoteUpdateInput,
} from '../types/stickyNote';

/** 渲染层客户端标识：广播回声过滤用，页面/钉窗各持一个 */
export const createStickyClientId = () =>
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const UNAVAILABLE = '便签仅支持桌面端';

const getBridge = () => window.electron?.stickyNotes;

const toError = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const stickyNotesService = {
  async list(): Promise<StickyNoteResult<StickyNote[]>> {
    const bridge = getBridge();
    if (!bridge) return { ok: false, error: UNAVAILABLE };
    try {
      const result = await bridge.list();
      if (!result?.ok) return { ok: false, error: result?.error || '读取便签失败' };
      return { ok: true, data: result.notes || [] };
    } catch (error) {
      return { ok: false, error: toError(error, '读取便签失败') };
    }
  },

  async create(input: StickyNoteCreateInput): Promise<StickyNoteResult<StickyNote>> {
    const bridge = getBridge();
    if (!bridge) return { ok: false, error: UNAVAILABLE };
    try {
      const result = await bridge.create(input);
      return result?.ok
        ? { ok: true, data: result.note }
        : { ok: false, error: result?.error || '创建便签失败' };
    } catch (error) {
      return { ok: false, error: toError(error, '创建便签失败') };
    }
  },

  async update(input: StickyNoteUpdateInput): Promise<StickyNoteResult<StickyNote>> {
    const bridge = getBridge();
    if (!bridge) return { ok: false, error: UNAVAILABLE };
    try {
      const result = await bridge.update(input);
      return result?.ok
        ? { ok: true, data: result.note }
        : { ok: false, error: result?.error || '保存便签失败' };
    } catch (error) {
      return { ok: false, error: toError(error, '保存便签失败') };
    }
  },

  async remove(id: string): Promise<StickyNoteResult> {
    const bridge = getBridge();
    if (!bridge) return { ok: false, error: UNAVAILABLE };
    try {
      const result = await bridge.remove(id);
      return result?.ok ? { ok: true } : { ok: false, error: result?.error || '删除便签失败' };
    } catch (error) {
      return { ok: false, error: toError(error, '删除便签失败') };
    }
  },

  async setPinned(id: string, pinned: boolean): Promise<StickyNoteResult<StickyNote>> {
    const bridge = getBridge();
    if (!bridge) return { ok: false, error: UNAVAILABLE };
    try {
      const result = await bridge.setPinned(id, pinned);
      return result?.ok
        ? { ok: true, data: result.note }
        : { ok: false, error: result?.error || '更新钉住状态失败' };
    } catch (error) {
      return { ok: false, error: toError(error, '更新钉住状态失败') };
    }
  },

  onChanged(callback: (payload: StickyNoteChangedPayload) => void): () => void {
    const bridge = getBridge();
    if (!bridge) return () => {};
    return bridge.onChanged(callback);
  },
};
