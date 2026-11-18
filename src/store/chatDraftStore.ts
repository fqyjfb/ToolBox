// chatDraftStore —— 记事本对话输入框未发送文本的跨路由状态
//
// 根因：NotesPage 由 React.lazy + React Router 按 pathname 强制重挂载（见 navStore.ts 注释），
// ChatInput 的 useState 每次切回归零。提升到 store 后切回直接复用上次输入。
// localStorage 持久化覆盖"窗口意外关闭后重开"的兜底场景。

import { create } from 'zustand';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';

interface ChatDraftStore {
  text: string;
  /** 新值或基于上一值的函数 */
  setText: (next: string | ((prev: string) => string)) => void;
  /** 发送 / 存笔记 / 存待办 / 存便签成功后清空 */
  clear: () => void;
}

const STORAGE_KEY = STORAGE_KEYS.CHAT_DRAFT;

const initial = localStorageService.getString(STORAGE_KEY) ?? '';

export const useChatDraftStore = create<ChatDraftStore>((set) => ({
  text: initial,
  setText: (next) => {
    set((state) => {
      const value = typeof next === 'function' ? next(state.text) : next;
      // localStorage 写入失败静默处理（体量通常 ≤ 4KB）
      try {
        localStorageService.setString(STORAGE_KEY, value);
      } catch {
        /* ignore */
      }
      return { text: value };
    });
  },
  clear: () => {
    try {
      localStorageService.remove(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    set({ text: '' });
  },
}));
