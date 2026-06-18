import { supabase } from './supabase';
import { getUserAgnesConfig } from './AgnesService';

const AGNES_API_BASE_URL = 'https://apihub.agnes-ai.com/v1';

interface GenerateImageOptions {
  negative_prompt?: string;
  seed?: number;
  images?: string[];
}

export async function generateImage(
  prompt: string,
  model: string = 'agnes-image-2.1-flash',
  size: string = '1024x1024',
  options: GenerateImageOptions = {}
): Promise<{ url: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('请先登录');
  }

  const config = await getUserAgnesConfig(userId);
  const apiKey = config?.api_key || import.meta.env.VITE_AGNES_API_KEY;

  if (!apiKey) {
    throw new Error('请先在设置中配置 Agnes API Key');
  }

  const payload: Record<string, unknown> = {
    model,
    prompt,
    size,
    extra_body: {
      response_format: 'url',
    }
  };

  if (options.negative_prompt) {
    payload.extra_body = {
      ...payload.extra_body as Record<string, unknown>,
      negative_prompt: options.negative_prompt
    };
  }

  if (options.seed) {
    payload.seed = options.seed;
  }

  if (options.images && options.images.length > 0) {
    payload.tags = ['img2img'];
    payload.extra_body = {
      ...payload.extra_body as Record<string, unknown>,
      image: options.images
    };
  }

  const response = await fetch(`${AGNES_API_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Image generation failed');
  }

  const result = await response.json();
  return { url: result.data[0].url };
}

export async function createChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options: {
    model?: string;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    enable_thinking?: boolean;
  } = {}
): Promise<Response> {
  const {
    model = 'agnes-2.0-flash',
    stream = true,
    temperature = 0.7,
    max_tokens = 4096,
    enable_thinking = false
  } = options;

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('请先登录');
  }

  const config = await getUserAgnesConfig(userId);
  const apiKey = config?.api_key || import.meta.env.VITE_AGNES_API_KEY;

  if (!apiKey) {
    throw new Error('请先在设置中配置 Agnes API Key');
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    stream,
    temperature,
    max_tokens,
  };

  if (enable_thinking) {
    body.chat_template_kwargs = { enable_thinking: true };
  }

  return fetch(`${AGNES_API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
}

export async function createVideoTask(
  prompt: string,
  model: string = 'agnes-video-v2.0',
  options: Record<string, unknown> = {}
): Promise<{ task_id: string; status: string; progress: number; size?: string; seconds?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('请先登录');
  }

  const config = await getUserAgnesConfig(userId);
  const apiKey = config?.api_key || import.meta.env.VITE_AGNES_API_KEY;

  if (!apiKey) {
    throw new Error('请先在设置中配置 Agnes API Key');
  }

  const payload: Record<string, unknown> = {
    model,
    prompt,
    height: options.height || 768,
    width: options.width || 1152,
    num_frames: options.num_frames || 121,
    frame_rate: options.frame_rate || 24,
  };

  if (options.negative_prompt) {
    payload.negative_prompt = options.negative_prompt;
  }

  if (options.seed) {
    payload.seed = options.seed;
  }

  if (options.image) {
    payload.image = options.image;
  }

  if (options.extra_body) {
    payload.extra_body = options.extra_body;
  }

  const response = await fetch(`${AGNES_API_BASE_URL}/videos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  return {
    task_id: result.task_id || result.id,
    status: result.status || 'queued',
    progress: result.progress || 0,
    size: result.size,
    seconds: result.seconds,
  };
}

export async function getVideoTaskStatus(taskId: string): Promise<{ status: string; progress: number; video_url?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('请先登录');
  }

  const config = await getUserAgnesConfig(userId);
  const apiKey = config?.api_key || import.meta.env.VITE_AGNES_API_KEY;

  if (!apiKey) {
    throw new Error('请先在设置中配置 Agnes API Key');
  }

  const response = await fetch(`${AGNES_API_BASE_URL}/videos/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  const result = await response.json();
  return {
    status: result.status || 'unknown',
    progress: result.progress || 0,
    video_url: result.video_url || result.data?.url
  };
}

export async function cancelVideoTask(taskId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('请先登录');
  }

  const config = await getUserAgnesConfig(userId);
  const apiKey = config?.api_key || import.meta.env.VITE_AGNES_API_KEY;

  if (!apiKey) {
    throw new Error('请先在设置中配置 Agnes API Key');
  }

  const response = await fetch(`${AGNES_API_BASE_URL}/videos/${taskId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to cancel video task' }));
    throw new Error(error.error || `Failed to cancel task: ${response.status}`);
  }
}