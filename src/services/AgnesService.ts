import { supabase } from './supabase';
import { BaseService } from './baseService';
import { logError, logInfo } from './loggerService';
import type {
  FontGenerationTask,
  AIConversation,
  AIMessage,
  RolePreset,
  ImageGenerationTask,
  VideoGenerationTask,
  AgnesConfig,
  ImageResult,
  VideoTask,
  Conversation,
  Message,
} from '../types/agnes';

// 用户数据服务（使用BaseService，需要用户隔离）
export const fontTaskService = new BaseService<FontGenerationTask>('font_generation_tasks', 'FontTaskService');
export const aiConversationService = new BaseService<AIConversation>('ai_conversations', 'AIConversationService');
export const aiMessageService = new BaseService<AIMessage>('ai_messages', 'AIMessageService');
// rolePresetService 不使用 BaseService，因为 RolePreset 的 user_id 是可选的（系统预设没有 user_id）
export const imageTaskService = new BaseService<ImageGenerationTask>('image_generation_tasks', 'ImageTaskService');
export const videoTaskService = new BaseService<VideoGenerationTask>('video_generation_tasks', 'VideoTaskService');
export const agnesConfigService = new BaseService<AgnesConfig>('agnes_config', 'AgnesConfigService');

// 获取角色预设列表（包含系统预设）
export async function getRolePresets(userId: string): Promise<RolePreset[]> {
  const { data, error } = await supabase
    .from('role_presets')
    .select('*')
    .or(`user_id.eq.${userId},is_system.eq.true`)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    logError('获取角色预设失败', 'RolePresetService', error);
    throw error;
  }
  return data || [];
}

// 创建字体生成任务
export async function createFontTask(userId: string, task: Omit<FontGenerationTask, 'id' | 'user_id' | 'task_id' | 'created_at' | 'updated_at' | 'status'>) {
  const taskId = Date.now().toString(36) + Math.random().toString(36).substring(2);

  const { data, error } = await supabase
    .from('font_generation_tasks')
    .insert({
      user_id: userId,
      task_id: taskId,
      ...task,
      status: 'completed'
    })
    .select()
    .single();

  if (error) {
    logError('创建字体生成任务失败', 'FontTaskService', error);
    throw error;
  }
  return data;
}

// 获取用户Agnes配置
export async function getUserAgnesConfig(userId: string): Promise<AgnesConfig | null> {
  const { data, error } = await supabase
    .from('agnes_config')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    logError('获取Agnes配置失败', 'AgnesConfigService', error);
    throw error;
  }
  return data || null;
}

// 保存用户Agnes配置
export async function saveUserAgnesConfig(userId: string, config: Partial<Pick<AgnesConfig, 'api_key' | 'theme' | 'api_base_url'>>) {
  const existing = await getUserAgnesConfig(userId);

  if (existing) {
    const { data, error } = await supabase
      .from('agnes_config')
      .update({ ...config })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      logError('更新Agnes配置失败', 'AgnesConfigService', error);
      throw error;
    }
    return data;
  } else {
    const { data, error } = await supabase
      .from('agnes_config')
      .insert({
        user_id: userId,
        theme: 'light',
        api_base_url: 'https://apihub.agnes-ai.com/v1',
        ...config
      })
      .select()
      .single();

    if (error) {
      logError('创建Agnes配置失败', 'AgnesConfigService', error);
      throw error;
    }
    return data;
  }
}

// 获取用户对话列表
export async function getUserConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    logError('获取对话列表失败', 'AIConversationService', error);
    throw error;
  }

  // 转换为前端展示格式
  const conversations: Conversation[] = (data || []).map(conv => ({
    id: conv.id,
    user_id: conv.user_id,
    title: conv.title,
    role_preset_id: conv.role_preset_id,
    messages: [],
    created_at: conv.created_at,
    updated_at: conv.updated_at,
  }));

  return conversations;
}

// 获取对话消息
export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    logError('获取对话消息失败', 'AIMessageService', error);
    throw error;
  }

  // 转换为前端展示格式
  const messages: Message[] = (data || []).map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    thinking: msg.thinking,
    created_at: msg.created_at,
  }));

  return messages;
}

// 创建对话
export async function createConversation(userId: string, title: string, rolePresetId?: string): Promise<AIConversation> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      user_id: userId,
      title,
      role_preset_id: rolePresetId
    })
    .select()
    .single();

  if (error) {
    logError('创建对话失败', 'AIConversationService', error);
    throw error;
  }
  return data;
}

// 添加消息
export async function addMessage(userId: string, conversationId: string, role: AIMessage['role'], content: string, thinking?: string): Promise<AIMessage> {
  const { data, error } = await supabase
    .from('ai_messages')
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      role,
      content,
      thinking
    })
    .select()
    .single();

  if (error) {
    logError('添加消息失败', 'AIMessageService', error);
    throw error;
  }
  return data;
}

// 删除消息
export async function deleteMessage(userId: string, messageId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_messages')
    .delete()
    .eq('id', messageId)
    .eq('user_id', userId);

  if (error) {
    logError('删除消息失败', 'AIMessageService', error);
    throw error;
  }
}

// 删除对话（级联删除关联消息）
export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  // 先删除关联的消息
  const { error: messageError } = await supabase
    .from('ai_messages')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  if (messageError) {
    logError('删除对话消息失败', 'AIConversationService', messageError);
    throw messageError;
  }

  // 再删除对话
  const { error: convError } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (convError) {
    logError('删除对话失败', 'AIConversationService', convError);
    throw convError;
  }

  logInfo('删除对话成功', 'AIConversationService');
}

// 删除角色预设
export async function deleteRolePreset(userId: string, presetId: string): Promise<void> {
  const { error } = await supabase
    .from('role_presets')
    .delete()
    .eq('id', presetId)
    .eq('user_id', userId);

  if (error) {
    logError('删除角色预设失败', 'RolePresetService', error);
    throw error;
  }
}

// 删除字体生成任务
export async function deleteFontTask(userId: string, taskId: string): Promise<void> {
  const { error } = await supabase
    .from('font_generation_tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId);

  if (error) {
    logError('删除字体生成任务失败', 'FontTaskService', error);
    throw error;
  }
}

// 删除图片生成任务
export async function deleteImageTask(userId: string, taskId: string): Promise<void> {
  const { error } = await supabase
    .from('image_generation_tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId);

  if (error) {
    logError('删除图片生成任务失败', 'ImageTaskService', error);
    throw error;
  }
}

// 删除视频生成任务
export async function deleteVideoTask(userId: string, taskId: string): Promise<void> {
  const { error } = await supabase
    .from('video_generation_tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId);

  if (error) {
    logError('删除视频生成任务失败', 'VideoTaskService', error);
    throw error;
  }
}

// 获取用户图片历史
export async function getUserImageHistory(userId: string): Promise<ImageResult[]> {
  const { data, error } = await supabase
    .from('image_generation_tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    logError('获取图片历史失败', 'ImageTaskService', error);
    throw error;
  }

  return (data || []).map(item => ({
    id: item.id,
    url: item.image_url || '',
    prompt: item.prompt,
    size: item.size,
    model: item.model,
    seed: item.seed,
    referenceImages: item.reference_images,
    createdAt: new Date(item.created_at).getTime(),
  }));
}

// 获取用户视频任务
export async function getUserVideoTasks(userId: string): Promise<VideoTask[]> {
  const { data, error } = await supabase
    .from('video_generation_tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    logError('获取视频任务失败', 'VideoTaskService', error);
    throw error;
  }

  return (data || []).map(item => ({
    id: item.id,
    user_id: item.user_id,
    task_id: item.task_id,
    prompt: item.prompt,
    status: item.status,
    progress: item.progress,
    video_url: item.video_url,
    size: `${item.width}x${item.height}`,
    error_message: item.error_message,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

export async function getUserFontTasks(userId: string): Promise<FontGenerationTask[]> {
  const { data, error } = await supabase
    .from('font_generation_tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    logError('获取字体生成任务失败', 'FontTaskService', error);
    throw error;
  }

  return data || [];
}

// 创建图像生成任务记录
export async function createImageTask(userId: string, task: Omit<ImageGenerationTask, 'id' | 'user_id' | 'task_id' | 'created_at' | 'updated_at'>) {
  const taskId = Date.now().toString(36) + Math.random().toString(36).substring(2);

  const { data, error } = await supabase
    .from('image_generation_tasks')
    .insert({
      user_id: userId,
      task_id: taskId,
      ...task,
    })
    .select()
    .single();

  if (error) {
    logError('创建图片生成任务失败', 'ImageTaskService', error);
    throw error;
  }
  return data;
}

// 创建视频生成任务记录
export async function createVideoTask(userId: string, task: Omit<VideoGenerationTask, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('video_generation_tasks')
    .insert({
      user_id: userId,
      ...task,
    })
    .select()
    .single();

  if (error) {
    logError('创建视频生成任务失败', 'VideoTaskService', error);
    throw error;
  }
  return data;
}

// 更新视频任务状态
export async function updateVideoTaskStatus(userId: string, taskId: string, updates: Partial<VideoGenerationTask>) {
  const { error } = await supabase
    .from('video_generation_tasks')
    .update(updates)
    .eq('task_id', taskId)
    .eq('user_id', userId);

  if (error) {
    logError('更新视频任务状态失败', 'VideoTaskService', error);
    throw error;
  }
}

// 保存角色预设
export async function saveRolePreset(userId: string, preset: Omit<RolePreset, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('role_presets')
    .insert({
      user_id: userId,
      ...preset,
    })
    .select()
    .single();

  if (error) {
    logError('保存角色预设失败', 'RolePresetService', error);
    throw error;
  }
  return data;
}

// 更新对话标题
export async function updateConversationTitle(userId: string, conversationId: string, title: string) {
  const { error } = await supabase
    .from('ai_conversations')
    .update({ title })
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) {
    logError('更新对话标题失败', 'AIConversationService', error);
    throw error;
  }
}