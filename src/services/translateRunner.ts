/**
 * 翻译执行唯一入口：在线源（apiService）与 AI 源（toolboxAI）在这里收敛。
 * 两段式写入通过 hooks 暴露：onRecordCreated 写占位，onResult 回填单源结果。
 */
import { apiService } from './api';
import { toolboxAI } from './aiApi';
import { getLanguageLabel } from '../constants/languages';
import {
  TranslateConfig,
  TranslateProviderId,
  TranslateRecord,
  TranslateRecordResult,
  TranslateTrigger,
} from '../types/translate';

export interface RunInput {
  text: string;
  sourceLang: string;
  targetLang: string;
  trigger: TranslateTrigger;
  config: TranslateConfig;
}

export type RunResult = TranslateRecordResult & { status: 'success' | 'failed' };

export interface RunHooks {
  onRecordCreated?: (record: TranslateRecord) => void;
  onResult?: (provider: TranslateProviderId, result: RunResult) => void;
}

const DEFAULT_AI_PROMPT =
  '你是一名专业翻译引擎。请把用户提供的文本翻译为目标语言，只输出译文，' +
  '不要解释、不要添加原文；保留段落结构、数字、代码与专有名词。';

/** 目标语言为 auto 时与在线源保持同一规则：中文译英文，其它译中文 */
const resolveTargetHint = (targetLang: string) =>
  targetLang === 'auto' ? '若源文本为中文则译为英文，否则译为简体中文' : getLanguageLabel(targetLang);

const generateRecordId = () => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let index = 0; index < 32; index += 1) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
};

const runOnline = async (input: RunInput): Promise<RunResult> => {
  const startedAt = Date.now();
  try {
    const data = await apiService.translate(input.text, input.sourceLang, input.targetLang);
    return {
      provider: 'online',
      provider_ref: 'online',
      status: 'success',
      text: data.target?.text || '',
      pronounce: data.target?.pronounce || '',
      explains: data.target?.type_desc ? [data.target.type_desc] : [],
      elapsed_ms: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      provider: 'online',
      provider_ref: 'online',
      status: 'failed',
      error: error instanceof Error ? error.message : '在线翻译失败',
      elapsed_ms: Date.now() - startedAt,
    };
  }
};

const runAI = async (input: RunInput): Promise<RunResult> => {
  const startedAt = Date.now();
  const modelId = input.config.ai_model_id || undefined;
  try {
    const targetName = getLanguageLabel(input.targetLang);
    const sourceName = getLanguageLabel(input.sourceLang);
    const basePrompt = input.config.ai_system_prompt.trim() || DEFAULT_AI_PROMPT;
    const result = await toolboxAI.chat(
      [{ role: 'user', content: input.text }],
      {
        modelId,
        systemPrompt: `${basePrompt}\n目标语言：${resolveTargetHint(input.targetLang)}。`,
        timeoutMs: 60000,
      },
    );
    return {
      provider: 'ai',
      provider_ref: modelId || toolboxAI.getActiveModel()?.id || 'ai',
      status: 'success',
      text: result.trim(),
      explains: [`${sourceName} → ${targetName}`],
      elapsed_ms: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      provider: 'ai',
      provider_ref: modelId || 'ai',
      status: 'failed',
      error: error instanceof Error ? error.message : 'AI 翻译失败',
      elapsed_ms: Date.now() - startedAt,
    };
  }
};

const RUNNERS: Record<TranslateProviderId, (input: RunInput) => Promise<RunResult>> = {
  online: runOnline,
  ai: runAI,
};

const pickProviders = (config: TranslateConfig): TranslateProviderId[] => {
  const enabled = config.providers.filter((provider) => provider.enabled);
  if (enabled.length === 0) return ['online'];
  if (!config.show_all_providers) {
    const primary = enabled.find((provider) => provider.id === config.primary_provider);
    return [(primary ?? enabled[0]).id];
  }
  return enabled.map((provider) => provider.id);
};

const buildRecord = (input: RunInput, providers: TranslateProviderId[]): TranslateRecord => {
  const now = Date.now();
  return {
    id: generateRecordId(),
    source_text: input.text,
    source_language: input.sourceLang,
    source_language_name: getLanguageLabel(input.sourceLang),
    target_language: input.targetLang,
    target_language_name: getLanguageLabel(input.targetLang),
    trigger: input.trigger,
    created_at: now,
    updated_at: now,
    results: providers.map((provider) => ({
      provider,
      provider_ref: provider,
      status: 'pending',
    })),
  };
};

export async function runTranslate(
  input: RunInput,
  hooks?: RunHooks,
): Promise<{ record: TranslateRecord; results: RunResult[] }> {
  const providers = pickProviders(input.config);
  const record = buildRecord(input, providers);
  hooks?.onRecordCreated?.(record);

  const results = await Promise.all(
    providers.map(async (provider) => {
      const result = await RUNNERS[provider]({ ...input });
      hooks?.onResult?.(provider, result);
      return result;
    }),
  );

  const merged: TranslateRecord = {
    ...record,
    updated_at: Date.now(),
    results: record.results.map((item) => {
      const result = results.find((entry) => entry.provider === item.provider);
      return result ? { ...item, ...result } : item;
    }),
  };

  return { record: merged, results };
}
