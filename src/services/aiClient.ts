import type { AIChatMessage, AIChatOptions, AIModel } from '../types/ai';

export function isModelConfigured(model: AIModel | null | undefined): model is AIModel {
  return Boolean(model && model.base_url.trim() && model.model_id.trim());
}

export function buildChatUrl(model: AIModel): string {
  if (model.use_complete_url) return model.base_url.trim();
  return `${model.base_url.trim().replace(/\/$/, '')}/chat/completions`;
}

export async function requestChat(
  model: AIModel,
  messages: AIChatMessage[],
  options: AIChatOptions = {}
): Promise<string> {
  const url = buildChatUrl(model);
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('接口地址需以 http:// 或 https:// 开头');
  }
  if (!window.electron?.ai) {
    throw new Error('当前环境不支持 AI 请求');
  }

  const body: Record<string, unknown> = {
    model: model.model_id,
    messages: options.systemPrompt
      ? [{ role: 'system' as const, content: options.systemPrompt }, ...messages]
      : messages,
    stream: false,
  };

  const temperature = options.temperature !== undefined ? options.temperature : model.temperature;
  if (temperature !== null && temperature !== undefined) body.temperature = temperature;
  if (model.top_p !== null) body.top_p = model.top_p;
  if (model.top_k !== null) body.top_k = model.top_k;
  if (model.thinking_mode === 'on') body.chat_template_kwargs = { enable_thinking: true };
  if (model.thinking_mode === 'off') body.chat_template_kwargs = { enable_thinking: false };
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

  const result = await window.electron.ai.chat({
    url,
    apiKey: model.api_key,
    body,
    timeoutMs: options.timeoutMs ?? 60000,
  });

  if (!result.success || !result.content) {
    throw new Error(result.error || 'AI 请求失败');
  }

  return result.content;
}

export async function checkModelConnectivity(
  model: AIModel
): Promise<{ valid: boolean; message: string }> {
  if (!isModelConfigured(model)) {
    return { valid: false, message: '请填写模型 ID 与 API 地址' };
  }

  try {
    const url = buildChatUrl(model);
    const body = {
      model: model.model_id,
      messages: [{ role: 'user', content: 'ping' }],
      stream: false,
      max_tokens: 8,
    };

    const result = await window.electron?.ai.chat({ url, apiKey: model.api_key, body, timeoutMs: 15000 });
    if (!result) return { valid: false, message: '当前环境不支持 AI 请求' };
    if (result.success) return { valid: true, message: '连接成功' };
    return { valid: false, message: result.error || '连接失败' };
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error ? error.message : '连接失败',
    };
  }
}
