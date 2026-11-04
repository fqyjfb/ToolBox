/** 翻译源标识 */
export type TranslateProviderId = 'online' | 'ai';

export type TranslateTrigger = 'selection' | 'screenshot' | 'manual';

/** 翻译源展示名：设置页与翻译浮层共用 */
export const PROVIDER_LABELS: Record<TranslateProviderId, string> = {
  online: '在线翻译',
  ai: 'AI 翻译',
};

export interface TranslateProviderState {
  id: TranslateProviderId;
  enabled: boolean;
  order: number;
}

export interface TranslateConfig {
  providers: TranslateProviderState[];
  primary_provider: TranslateProviderId;
  /** 同时显示所有已启用源的结果（对齐 TTime 多源同显） */
  show_all_providers: boolean;
  /** null = 跟随「AI 设置」默认模型 */
  ai_model_id: string | null;
  /** 空 = 使用内置 prompt */
  ai_system_prompt: string;
  source_lang: string;
  target_lang: string;
  auto_translate_on_input: boolean;
  updated_at: string;
}

export const DEFAULT_TRANSLATE_CONFIG: TranslateConfig = {
  providers: [
    { id: 'online', enabled: true, order: 0 },
    { id: 'ai', enabled: false, order: 1 },
  ],
  primary_provider: 'online',
  show_all_providers: false,
  ai_model_id: null,
  ai_system_prompt: '',
  source_lang: 'auto',
  target_lang: 'auto',
  auto_translate_on_input: false,
  updated_at: '',
};

export interface TranslateRecordResult {
  provider: TranslateProviderId;
  /** 在线源固定 'online'；AI 源记录模型 id */
  provider_ref: string;
  status: 'pending' | 'success' | 'failed';
  text?: string;
  pronounce?: string;
  explains?: string[];
  error?: string;
  elapsed_ms?: number;
}

export interface TranslateRecord {
  id: string;
  source_text: string;
  source_language: string;
  source_language_name: string;
  target_language: string;
  target_language_name: string;
  trigger: TranslateTrigger;
  created_at: number;
  updated_at: number;
  results: TranslateRecordResult[];
}
