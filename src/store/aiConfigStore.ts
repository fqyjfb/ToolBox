import { create } from 'zustand';
import { localStorageService, STORAGE_KEYS } from '../services/localStorageService';
import type { AIConfig, AIModel, AIModelInput } from '../types/ai';

export const createEmptyModelInput = (): AIModelInput => ({
  api_format: 'openai_chat_completions',
  base_url: '',
  use_complete_url: false,
  model_id: '',
  display_name: '',
  api_key: '',
  thinking_mode: 'follow',
  temperature: null,
  top_p: null,
  top_k: null,
});

function createEmptyConfig(): AIConfig {
  return {
    models: [],
    default_model_id: null,
    auto_match_enabled: true,
    auto_archive_enabled: false,
    updated_at: new Date().toISOString(),
  };
}

function generateModelId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeModel(raw: unknown, index: number): AIModel | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<AIModel>;
  const baseUrl = typeof item.base_url === 'string' ? item.base_url.trim() : '';
  const modelId = typeof item.model_id === 'string' ? item.model_id.trim() : '';
  if (!baseUrl || !modelId) return null;

  const now = new Date().toISOString();

  return {
    id: typeof item.id === 'string' && item.id ? item.id : `model_${index}_${generateModelId()}`,
    api_format: 'openai_chat_completions',
    base_url: baseUrl,
    use_complete_url: item.use_complete_url === true,
    model_id: modelId,
    display_name:
      typeof item.display_name === 'string' && item.display_name.trim()
        ? item.display_name.trim()
        : modelId,
    api_key: typeof item.api_key === 'string' ? item.api_key : '',
    thinking_mode:
      item.thinking_mode === 'on' || item.thinking_mode === 'off' ? item.thinking_mode : 'follow',
    temperature: typeof item.temperature === 'number' ? item.temperature : null,
    top_p: typeof item.top_p === 'number' ? item.top_p : null,
    top_k: typeof item.top_k === 'number' ? item.top_k : null,
    is_default: Boolean(item.is_default),
    created_at: typeof item.created_at === 'string' ? item.created_at : now,
    updated_at: typeof item.updated_at === 'string' ? item.updated_at : now,
  };
}

export function normalizeAIConfig(raw: unknown): AIConfig {
  if (!raw || typeof raw !== 'object') return createEmptyConfig();

  const source = raw as Partial<AIConfig>;
  const models = Array.isArray(source.models)
    ? source.models
        .map((item, index) => normalizeModel(item, index))
        .filter((item): item is AIModel => item !== null)
    : [];

  const defaultId = models.some((model) => model.id === source.default_model_id)
    ? (source.default_model_id as string)
    : (models[0]?.id ?? null);

  return {
    models: models.map((model) => ({ ...model, is_default: model.id === defaultId })),
    default_model_id: defaultId,
    auto_match_enabled: source.auto_match_enabled !== false,
    auto_archive_enabled: source.auto_archive_enabled === true,
    updated_at:
      typeof source.updated_at === 'string' ? source.updated_at : new Date().toISOString(),
  };
}

function readConfig(): AIConfig {
  return normalizeAIConfig(localStorageService.get<unknown>(STORAGE_KEYS.AI_CONFIG, null));
}

function persistConfig(config: AIConfig): AIConfig {
  const next = { ...config, updated_at: new Date().toISOString() };
  localStorageService.set(STORAGE_KEYS.AI_CONFIG, next);
  return next;
}

export function resolveActiveModel(config: AIConfig): AIModel | null {
  const { models, default_model_id, auto_match_enabled } = config;
  if (models.length === 0) return null;
  if (auto_match_enabled) return models[0];
  return models.find((model) => model.id === default_model_id) ?? models[0];
}

interface AIConfigState {
  config: AIConfig;
  addModel: (input: AIModelInput) => AIModel;
  updateModel: (id: string, input: AIModelInput) => void;
  deleteModel: (id: string) => boolean;
  setDefaultModel: (id: string) => void;
  setAutoMatchEnabled: (enabled: boolean) => void;
  setAutoArchiveEnabled: (enabled: boolean) => void;
}

export const useAIConfigStore = create<AIConfigState>((set, get) => ({
  config: readConfig(),

  addModel: (input) => {
    const current = get().config;
    const now = new Date().toISOString();
    const model: AIModel = {
      ...input,
      id: generateModelId(),
      is_default: current.models.length === 0,
      created_at: now,
      updated_at: now,
    };

    set({
      config: persistConfig({
        ...current,
        models: [...current.models, model],
        default_model_id: current.default_model_id ?? model.id,
      }),
    });

    return model;
  },

  updateModel: (id, input) => {
    const current = get().config;
    set({
      config: persistConfig({
        ...current,
        models: current.models.map((model) =>
          model.id === id ? { ...model, ...input, id: model.id, updated_at: new Date().toISOString() } : model
        ),
      }),
    });
  },

  deleteModel: (id) => {
    const current = get().config;
    if (current.models.length <= 1) return false;

    const models = current.models.filter((model) => model.id !== id);
    const defaultId =
      current.default_model_id === id ? models[0].id : current.default_model_id;

    set({
      config: persistConfig({
        ...current,
        models: models.map((model) => ({ ...model, is_default: model.id === defaultId })),
        default_model_id: defaultId,
      }),
    });

    return true;
  },

  setDefaultModel: (id) => {
    const current = get().config;
    if (!current.models.some((model) => model.id === id)) return;

    set({
      config: persistConfig({
        ...current,
        default_model_id: id,
        models: current.models.map((model) => ({ ...model, is_default: model.id === id })),
      }),
    });
  },

  setAutoMatchEnabled: (enabled) => {
    const current = get().config;
    set({ config: persistConfig({ ...current, auto_match_enabled: enabled }) });
  },

  setAutoArchiveEnabled: (enabled) => {
    const current = get().config;
    set({ config: persistConfig({ ...current, auto_archive_enabled: enabled }) });
  },
}));
