import { logInfo } from './loggerService';
import { localStorageService } from './localStorageService';
import type { Conversation, ImageResult, VideoTask, FontGenerationTask, RolePreset } from '../types/agnes';

const STORAGE_KEYS = {
  CONVERSATIONS: 'agnes_conversations',
  IMAGE_HISTORY: 'agnes_image_history',
  VIDEO_TASKS: 'agnes_video_tasks',
  FONT_TASKS: 'agnes_font_tasks',
  ROLE_PRESETS: 'agnes_role_presets',
  SYNC_STATUS: 'agnes_sync_status',
};

interface SyncStatus {
  lastSyncTime: string;
  pendingOperations: PendingOperation[];
}

interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'conversation' | 'message' | 'image' | 'video' | 'font' | 'rolePreset';
  data?: unknown;
  entityId: string;
  createdAt: string;
}

function getStorageKey(userId: string, key: string): string {
  return `${key}_${userId}`;
}

export const agnesLocalStorage = {
  saveConversations(userId: string, conversations: Conversation[]): void {
    localStorageService.set(getStorageKey(userId, STORAGE_KEYS.CONVERSATIONS), conversations);
  },

  getConversations(userId: string): Conversation[] {
    return localStorageService.get<Conversation[]>(getStorageKey(userId, STORAGE_KEYS.CONVERSATIONS), []);
  },

  saveImageHistory(userId: string, history: ImageResult[]): void {
    localStorageService.set(getStorageKey(userId, STORAGE_KEYS.IMAGE_HISTORY), history);
  },

  getImageHistory(userId: string): ImageResult[] {
    return localStorageService.get<ImageResult[]>(getStorageKey(userId, STORAGE_KEYS.IMAGE_HISTORY), []);
  },

  saveVideoTasks(userId: string, tasks: VideoTask[]): void {
    localStorageService.set(getStorageKey(userId, STORAGE_KEYS.VIDEO_TASKS), tasks);
  },

  getVideoTasks(userId: string): VideoTask[] {
    return localStorageService.get<VideoTask[]>(getStorageKey(userId, STORAGE_KEYS.VIDEO_TASKS), []);
  },

  saveFontTasks(userId: string, tasks: FontGenerationTask[]): void {
    localStorageService.set(getStorageKey(userId, STORAGE_KEYS.FONT_TASKS), tasks);
  },

  getFontTasks(userId: string): FontGenerationTask[] {
    return localStorageService.get<FontGenerationTask[]>(getStorageKey(userId, STORAGE_KEYS.FONT_TASKS), []);
  },

  saveRolePresets(userId: string, presets: RolePreset[]): void {
    localStorageService.set(getStorageKey(userId, STORAGE_KEYS.ROLE_PRESETS), presets);
  },

  getRolePresets(userId: string): RolePreset[] {
    return localStorageService.get<RolePreset[]>(getStorageKey(userId, STORAGE_KEYS.ROLE_PRESETS), []);
  },

  saveSyncStatus(userId: string, status: SyncStatus): void {
    localStorageService.set(getStorageKey(userId, STORAGE_KEYS.SYNC_STATUS), status);
  },

  getSyncStatus(userId: string): SyncStatus {
    return localStorageService.get<SyncStatus>(getStorageKey(userId, STORAGE_KEYS.SYNC_STATUS), { lastSyncTime: '', pendingOperations: [] });
  },

  // 添加待同步操作
  addPendingOperation(userId: string, operation: Omit<PendingOperation, 'id' | 'createdAt'>): void {
    const status = this.getSyncStatus(userId);
    const pendingOp: PendingOperation = {
      ...operation,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    status.pendingOperations.push(pendingOp);
    this.saveSyncStatus(userId, status);
    logInfo(`添加待同步操作: ${operation.type} ${operation.entityType}`, 'agnesLocalStorage');
  },

  // 移除待同步操作
  removePendingOperation(userId: string, operationId: string): void {
    const status = this.getSyncStatus(userId);
    status.pendingOperations = status.pendingOperations.filter(op => op.id !== operationId);
    this.saveSyncStatus(userId, status);
  },

  // 获取待同步操作
  getPendingOperations(userId: string): PendingOperation[] {
    return this.getSyncStatus(userId).pendingOperations;
  },

  // 更新最后同步时间
  updateLastSyncTime(userId: string): void {
    const status = this.getSyncStatus(userId);
    status.lastSyncTime = new Date().toISOString();
    this.saveSyncStatus(userId, status);
  },

  clearUserData(userId: string): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorageService.remove(getStorageKey(userId, key));
    });
    logInfo(`已清除用户 ${userId} 的 Agnes 本地数据`, 'agnesLocalStorage');
  },

  // 添加单个对话到本地存储
  addConversation(userId: string, conversation: Conversation): void {
    const conversations = this.getConversations(userId);
    const existingIndex = conversations.findIndex(c => c.id === conversation.id);
    if (existingIndex >= 0) {
      conversations[existingIndex] = conversation;
    } else {
      conversations.unshift(conversation);
    }
    this.saveConversations(userId, conversations);
  },

  // 更新对话
  updateConversation(userId: string, conversationId: string, updates: Partial<Conversation>): void {
    const conversations = this.getConversations(userId);
    const index = conversations.findIndex(c => c.id === conversationId);
    if (index >= 0) {
      conversations[index] = { ...conversations[index], ...updates, updated_at: new Date().toISOString() };
      this.saveConversations(userId, conversations);
    }
  },

  // 删除对话
  deleteConversation(userId: string, conversationId: string): void {
    const conversations = this.getConversations(userId);
    const filtered = conversations.filter(c => c.id !== conversationId);
    this.saveConversations(userId, filtered);
  },

  // 添加图片到历史
  addImageToHistory(userId: string, image: ImageResult): void {
    const history = this.getImageHistory(userId);
    const existingIndex = history.findIndex(img => img.id === image.id);
    if (existingIndex >= 0) {
      history[existingIndex] = image;
    } else {
      history.unshift(image);
    }
    this.saveImageHistory(userId, history);
  },

  // 删除图片
  deleteImage(userId: string, imageId: string): void {
    const history = this.getImageHistory(userId);
    const filtered = history.filter(img => img.id !== imageId);
    this.saveImageHistory(userId, filtered);
  },

  // 添加视频任务
  addVideoTask(userId: string, task: VideoTask): void {
    const tasks = this.getVideoTasks(userId);
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.unshift(task);
    }
    this.saveVideoTasks(userId, tasks);
  },

  // 更新视频任务
  updateVideoTask(userId: string, taskId: string, updates: Partial<VideoTask>): void {
    const tasks = this.getVideoTasks(userId);
    const index = tasks.findIndex(t => t.id === taskId);
    if (index >= 0) {
      tasks[index] = { ...tasks[index], ...updates, updated_at: new Date().toISOString() };
      this.saveVideoTasks(userId, tasks);
    }
  },

  // 删除视频任务
  deleteVideoTask(userId: string, taskId: string): void {
    const tasks = this.getVideoTasks(userId);
    const filtered = tasks.filter(t => t.id !== taskId);
    this.saveVideoTasks(userId, filtered);
  },

  // 添加字体任务
  addFontTask(userId: string, task: FontGenerationTask): void {
    const tasks = this.getFontTasks(userId);
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.unshift(task);
    }
    this.saveFontTasks(userId, tasks);
  },

  // 删除字体任务
  deleteFontTask(userId: string, taskId: string): void {
    const tasks = this.getFontTasks(userId);
    const filtered = tasks.filter(t => t.id !== taskId);
    this.saveFontTasks(userId, filtered);
  },
};