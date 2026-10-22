export type AIThinkingMode = 'follow' | 'on' | 'off';

export interface AIModel {
  id: string;
  api_format: 'openai_chat_completions';
  base_url: string;
  use_complete_url: boolean;
  model_id: string;
  display_name: string;
  api_key: string;
  thinking_mode: AIThinkingMode;
  temperature: number | null;
  top_p: number | null;
  top_k: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/** 新增 / 编辑时的输入，id 与时间戳由 store 生成 */
export type AIModelInput = Omit<AIModel, 'id' | 'is_default' | 'created_at' | 'updated_at'>;

export interface AIConfig {
  models: AIModel[];
  default_model_id: string | null;
  auto_match_enabled: boolean;
  auto_archive_enabled: boolean;
  updated_at: string;
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIChatOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number | null;
  /** 指定模型 id；不传则走自动匹配 */
  modelId?: string;
  timeoutMs?: number;
}

/** 对外只读模型信息，不含 api_key */
export interface AIModelPublic {
  id: string;
  display_name: string;
  model_id: string;
  base_url: string;
  is_default: boolean;
}
