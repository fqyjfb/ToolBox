import type { AIChatMessage, AIChatOptions, AIModelPublic } from '../types/ai';
import { resolveActiveModel, useAIConfigStore } from '../store/aiConfigStore';
import { requestChat } from './aiClient';

export interface ToolboxAI {
  /** 是否已有可用模型（地址与 model_id 均非空） */
  isConfigured(): boolean;

  /** 当前生效模型（不含 api_key） */
  getActiveModel(): AIModelPublic | null;

  /** 通用对话；失败时抛出可读错误 */
  chat(messages: AIChatMessage[], options?: AIChatOptions): Promise<string>;
}

export const toolboxAI: ToolboxAI = {
  isConfigured() {
    return resolveActiveModel(useAIConfigStore.getState().config) !== null;
  },

  getActiveModel() {
    const model = resolveActiveModel(useAIConfigStore.getState().config);
    if (!model) return null;
    return {
      id: model.id,
      display_name: model.display_name || model.model_id,
      model_id: model.model_id,
      base_url: model.base_url,
      is_default: model.is_default,
    };
  },

  async chat(messages, options = {}) {
    const { config } = useAIConfigStore.getState();
    const model = options.modelId
      ? config.models.find((item) => item.id === options.modelId) ?? resolveActiveModel(config)
      : resolveActiveModel(config);

    if (!model) {
      throw new Error('尚未配置 AI 模型，请前往 设置 → AI 设置 添加模型');
    }

    return requestChat(model, messages, options);
  },
};

declare global {
  interface Window {
    toolboxAI?: ToolboxAI;
  }
}

window.toolboxAI = toolboxAI;
