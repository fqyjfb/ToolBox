import { create } from 'zustand';
import { localStorageService, STORAGE_KEYS } from '../services/localStorageService';
import {
  DEFAULT_TRANSLATE_CONFIG,
  TranslateConfig,
  TranslateProviderId,
  TranslateProviderState,
} from '../types/translate';

const PROVIDER_IDS: TranslateProviderId[] = ['online', 'ai'];

const normalizeProviders = (raw: unknown): TranslateProviderState[] => {
  const list = Array.isArray(raw) ? raw : [];
  return PROVIDER_IDS.map((id, index) => {
    const saved = list.find((item) => item && typeof item === 'object' && item.id === id);
    return {
      id,
      enabled: saved ? saved.enabled === true : DEFAULT_TRANSLATE_CONFIG.providers[index].enabled,
      order: saved && Number.isFinite(saved.order) ? saved.order : index,
    };
  }).sort((a, b) => a.order - b.order);
};

function normalizeTranslateConfig(raw: unknown): TranslateConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_TRANSLATE_CONFIG };
  const source = raw as Partial<TranslateConfig>;
  const primary =
    source.primary_provider && PROVIDER_IDS.includes(source.primary_provider)
      ? source.primary_provider
      : DEFAULT_TRANSLATE_CONFIG.primary_provider;

  return {
    providers: normalizeProviders(source.providers),
    primary_provider: primary,
    show_all_providers: source.show_all_providers === true,
    ai_model_id: typeof source.ai_model_id === 'string' && source.ai_model_id ? source.ai_model_id : null,
    ai_system_prompt: typeof source.ai_system_prompt === 'string' ? source.ai_system_prompt : '',
    source_lang: typeof source.source_lang === 'string' && source.source_lang ? source.source_lang : 'auto',
    target_lang: typeof source.target_lang === 'string' && source.target_lang ? source.target_lang : 'auto',
    auto_translate_on_input: source.auto_translate_on_input === true,
    updated_at: typeof source.updated_at === 'string' ? source.updated_at : '',
  };
}

function readConfig(): TranslateConfig {
  return normalizeTranslateConfig(localStorageService.get<unknown>(STORAGE_KEYS.TRANSLATE_CONFIG, null));
}

interface TranslateConfigState {
  config: TranslateConfig;
  update: (patch: Partial<TranslateConfig>) => void;
  setProviderEnabled: (id: TranslateProviderId, enabled: boolean) => void;
  /** 重新读取 localStorage：浮层常驻隐藏，设置页改动后需要重新同步 */
  reload: () => void;
}

export const useTranslateConfigStore = create<TranslateConfigState>((set, get) => ({
  config: readConfig(),

  update: (patch) => {
    const next: TranslateConfig = {
      ...get().config,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    localStorageService.set(STORAGE_KEYS.TRANSLATE_CONFIG, next);
    set({ config: next });
  },

  setProviderEnabled: (id, enabled) => {
    const current = get().config;
    const providers = current.providers.map((provider) =>
      provider.id === id ? { ...provider, enabled } : provider,
    );
    // 至少保留一个可用翻译源，否则翻译请求无处可发
    if (providers.every((provider) => !provider.enabled)) return;
    const next: TranslateConfig = {
      ...current,
      providers,
      updated_at: new Date().toISOString(),
    };
    localStorageService.set(STORAGE_KEYS.TRANSLATE_CONFIG, next);
    set({ config: next });
  },

  reload: () => {
    set({ config: readConfig() });
  },
}));
