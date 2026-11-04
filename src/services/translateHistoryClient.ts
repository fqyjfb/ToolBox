/**
 * 翻译记录调用封装：浮层（window.translateAPI）与主窗口 / 设置页（window.electron.translate）共用，
 * 避免两处各写一份 IPC 调用。非 Electron 环境（Web 构建）静默返回空结果。
 */
import type { TranslateRecord } from '../types/translate';

interface TranslateHistoryBridge {
  list: (payload?: { limit?: number; offset?: number }) => Promise<TranslateRecord[]>;
  save: (record: TranslateRecord) => Promise<{ success?: boolean; skipped?: boolean }>;
  remove: (id: string) => Promise<{ success?: boolean }>;
  clear: () => Promise<{ success?: boolean }>;
}

const getBridge = (): TranslateHistoryBridge | null =>
  window.translateAPI?.history ?? window.electron?.translate?.history ?? null;

export const listTranslateHistory = async (
  payload?: { limit?: number; offset?: number },
): Promise<TranslateRecord[]> => {
  const bridge = getBridge();
  if (!bridge) return [];
  try {
    return (await bridge.list(payload)) || [];
  } catch {
    return [];
  }
};

export const saveTranslateHistory = async (record: TranslateRecord): Promise<void> => {
  const bridge = getBridge();
  if (!bridge) return;
  try {
    await bridge.save(record);
  } catch (error) {
    console.error('[TranslateHistory] 保存失败:', error);
  }
};

export const removeTranslateHistory = async (id: string): Promise<void> => {
  const bridge = getBridge();
  if (!bridge) return;
  try {
    await bridge.remove(id);
  } catch (error) {
    console.error('[TranslateHistory] 删除失败:', error);
  }
};

export const clearTranslateHistory = async (): Promise<void> => {
  const bridge = getBridge();
  if (!bridge) return;
  try {
    await bridge.clear();
  } catch (error) {
    console.error('[TranslateHistory] 清空失败:', error);
  }
};
