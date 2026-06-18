// 注意：FontStyleCategory 和 FontStyle 类型已移至 src/constants/fontStyles.ts
// 这些类型是软件自带的预置数据

export interface FontGenerationTask {
  id: string;
  user_id: string;
  task_id: string;
  font_style_id?: string;
  text_content: string;
  prompt: string;
  size: string;
  background_color: string;
  seed?: number;
  negative_prompt?: string;
  image_url?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// AI对话相关类型
export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  role_preset_id?: string;
  messages?: AIMessage[];
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  user_id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  created_at: string;
  updated_at: string;
}

export interface RolePreset {
  id: string;
  user_id?: string;
  preset_id: string;
  name: string;
  description?: string;
  system_prompt: string;
  format?: string;
  icon?: string;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

// 图片/视频生成任务类型
export interface ImageGenerationTask {
  id: string;
  user_id: string;
  task_id: string;
  prompt: string;
  model: string;
  size: string;
  seed?: number;
  negative_prompt?: string;
  reference_images?: string[];
  image_url?: string;
  source: 'chat' | 'font' | 'video';
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface VideoGenerationTask {
  id: string;
  user_id: string;
  task_id: string;
  prompt: string;
  model: string;
  width: number;
  height: number;
  num_frames: number;
  frame_rate: number;
  seed?: number;
  negative_prompt?: string;
  reference_images?: string[];
  video_url?: string;
  status: 'pending' | 'queued' | 'running' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// Agnes配置类型
export interface AgnesConfig {
  id: string;
  user_id: string;
  api_key?: string;
  theme: 'light' | 'dark';
  api_base_url: string;
  created_at: string;
  updated_at: string;
}

export interface ImageResult {
  id: string;
  url: string;
  prompt: string;
  size: string;
  model: string;
  seed?: number;
  referenceImages?: string[];
  createdAt: number;
}

export interface ChatCompletionOptions {
  temperature: number;
  top_p: number;
  max_tokens: number;
  enable_thinking: boolean;
}

// 用于前端展示的简化类型
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  role_preset_id?: string | null;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface VideoTask {
  id: string;
  user_id: string;
  task_id: string;
  prompt: string;
  status: VideoGenerationTask['status'];
  progress: number;
  video_url?: string;
  size?: string;
  seconds?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}