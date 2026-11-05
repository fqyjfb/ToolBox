// 自动拆分自 src/vite-env.d.ts（ambient 全局声明，勿加 import/export）
// 划词翻译浮层接口

interface TranslatePopupPayload {
  visible: boolean;
  text?: string;
  autoTranslate?: boolean;
  trigger?: import('./types/translate').TranslateTrigger;
  fallback?: boolean;
  error?: string;
  pinned?: boolean;
}

interface TranslateThemeSnapshot {
  isDark: boolean;
  snapshot: import('./types/theme').CustomThemeColorSnapshot | null;
}

interface TranslateHistoryAPI {
  list: (payload?: { limit?: number; offset?: number }) => Promise<import('./types/translate').TranslateRecord[]>;
  save: (record: import('./types/translate').TranslateRecord) => Promise<{ success?: boolean; skipped?: boolean }>;
  remove: (id: string) => Promise<{ success?: boolean }>;
  clear: () => Promise<{ success?: boolean }>;
}

/** 翻译浮层专用窄权限桥（translate-preload.cjs 暴露） */
interface TranslateAPI {
  close: () => Promise<{ success: boolean }>;
  resize: (height: number, historyOpen?: boolean) => Promise<{ success: boolean }>;
  copy: (text: string) => Promise<{ success: boolean }>;
  setPinned: (pinned: boolean) => Promise<{ success: boolean; pinned: boolean }>;
  getThemeSnapshot: () => Promise<TranslateThemeSnapshot>;
  getAIConfig: () => Promise<import('./types/ai').AIConfig | null>;
  onThemeChanged: (callback: (payload: TranslateThemeSnapshot) => void) => () => void;
  onAIConfigChanged: (callback: (payload: import('./types/ai').AIConfig | null) => void) => () => void;
  onVisible: (callback: (payload: TranslatePopupPayload) => void) => () => void;
  history: TranslateHistoryAPI;
  /** 截图翻译错误态：打开主窗口 OCR 设置页 */
  openOcrSettings: () => Promise<{ success: boolean; error?: string }>;
}
