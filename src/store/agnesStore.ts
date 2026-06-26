import { create } from 'zustand';
import type { Conversation, ImageResult, VideoTask, Message, RolePreset, FontGenerationTask } from '../types/agnes';
import { agnesLocalStorage } from '../services/agnesLocalStorage';
import { logError, logInfo } from '../services/loggerService';
import {
  deleteMessage,
  deleteConversation,
  deleteImageTask,
  deleteVideoTask,
  deleteFontTask,
  deleteRolePreset,
  getUserConversations,
  getRolePresets,
  getUserImageHistory,
  getUserVideoTasks,
  getUserFontTasks,
  getConversationMessages,
} from '../services/AgnesService';

const defaultRolePresets: RolePreset[] = [
  {
    id: 'copywriter',
    user_id: undefined,
    preset_id: 'copywriter',
    name: '文案助手',
    description: '专业的文案创作助手，帮助您撰写高质量的营销文案、产品描述和广告文案',
    system_prompt: '您是一名专业的文案策划师，擅长撰写各种类型的营销文案。请根据用户的需求，创作出吸引人、有说服力的文案内容。',
    icon: '✍️',
    is_system: true,
    is_default: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'translator',
    user_id: undefined,
    preset_id: 'translator',
    name: '翻译助手',
    description: '多语言翻译专家，支持多种语言互译，准确传达原文含义',
    system_prompt: '您是一名专业的翻译专家，精通多种语言。请准确翻译用户提供的内容，保持原文含义不变，并确保译文流畅自然。',
    icon: '🌍',
    is_system: true,
    is_default: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'xiaohongshu',
    user_id: undefined,
    preset_id: 'xiaohongshu',
    name: '小红书助手',
    description: '小红书风格内容创作专家，帮助您撰写吸睛的种草笔记',
    system_prompt: '您是一名小红书内容创作专家，精通小红书平台的内容风格和热门话题。请根据用户提供的产品或主题，创作出符合小红书风格的种草笔记。',
    icon: '📕',
    is_system: true,
    is_default: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'social-title',
    user_id: undefined,
    preset_id: 'social-title',
    name: '社媒标题助手',
    description: '社交媒体标题创作专家，帮您打造高点击率的标题',
    system_prompt: '您是一名社交媒体运营专家，擅长创作吸引人的标题。请根据用户提供的内容主题，生成多个吸引人的社交媒体标题选项。',
    icon: '📣',
    is_system: true,
    is_default: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

interface AgnesState {
  conversations: Conversation[];
  activeConversationId: string | null;
  rolePresets: RolePreset[];
  activeRolePresetId: string | null;
  imageGeneration: {
    isGenerating: boolean;
    result: ImageResult | null;
    history: ImageResult[];
  };
  videoGeneration: {
    tasks: VideoTask[];
  };
  fontGeneration: {
    tasks: FontGenerationTask[];
  };

  addConversation: (conversation: Conversation) => void;
  selectConversation: (id: string | null) => void;
  updateConversationId: (oldId: string, newId: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, content: string, thinking?: string) => void;
  updateConversationTitle: (conversationId: string, title: string) => void;
  deleteMessage: (conversationId: string, messageId: string, userId?: string) => Promise<void>;
  deleteConversation: (id: string, userId?: string) => Promise<void>;

  setImageGenerating: (isGenerating: boolean) => void;
  addImageToHistory: (image: ImageResult) => void;
  setImageHistory: (history: ImageResult[]) => void;
  removeImage: (imageId: string, userId?: string) => Promise<void>;

  addVideoTask: (task: VideoTask) => void;
  updateVideoTask: (taskId: string, updates: Partial<VideoTask>) => void;
  removeVideoTask: (taskId: string, userId?: string) => Promise<void>;

  setFontTasks: (tasks: FontGenerationTask[]) => void;
  addFontTask: (task: FontGenerationTask) => void;
  removeFontTask: (taskId: string, userId?: string) => Promise<void>;

  addRolePreset: (preset: RolePreset) => void;
  updateRolePreset: (id: string, updates: Partial<RolePreset>) => void;
  deleteRolePreset: (id: string, userId?: string) => Promise<void>;
  selectRolePreset: (id: string | null) => void;

  loadFromDatabase: (userId: string) => Promise<void>;
}

export const useAgnesStore = create<AgnesState>((set) => ({
  conversations: [],
  activeConversationId: null,
  rolePresets: defaultRolePresets,
  activeRolePresetId: null,
  imageGeneration: {
    isGenerating: false,
    result: null,
    history: [],
  },
  videoGeneration: {
    tasks: [],
  },
  fontGeneration: {
    tasks: [],
  },

  addConversation: (conversation) => {
    set((state) => ({
      conversations: [...state.conversations, conversation],
      activeConversationId: conversation.id,
    }));
  },

  selectConversation: (id) => {
    set((state) => {
      const conv = state.conversations.find((c) => c.id === id);
      if (conv) {
        return {
          activeConversationId: id,
          activeRolePresetId: conv.role_preset_id || null,
        };
      }
      return {
        activeConversationId: id,
      };
    });
  },

  updateConversationId: (oldId, newId) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === oldId ? { ...conv, id: newId } : conv
      ),
      activeConversationId: state.activeConversationId === oldId ? newId : state.activeConversationId,
    }));
  },

  addMessage: (conversationId, message) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: [...conv.messages, message],
              updated_at: new Date().toISOString(),
            }
          : conv
      ),
    }));
  },

  updateMessage: (conversationId: string, messageId: string, content: string, thinking?: string) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === messageId ? { ...msg, content, thinking } : msg
              ),
            }
          : conv
      ),
    }));
  },

  updateConversationTitle: (conversationId, title) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, title } : conv
      ),
    }));
  },

  deleteMessage: async (conversationId, messageId, userId?: string) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.filter((msg) => msg.id !== messageId),
              updated_at: new Date().toISOString(),
            }
          : conv
      ),
    }));

    if (userId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(messageId)) {
        return;
      }
      try {
        await deleteMessage(userId, messageId);
        logInfo(`消息已同步删除: ${messageId}`, 'agnesStore');
      } catch (error) {
        logError('删除消息失败:', 'agnesStore', error as Error);
      }
    }
  },

  deleteConversation: async (id, userId?: string) => {
    set((state) => ({
      conversations: state.conversations.filter((conv) => conv.id !== id),
      activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
    }));

    if (userId) {
      agnesLocalStorage.deleteConversation(userId, id);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return;
      }
      try {
        await deleteConversation(userId, id);
        logInfo(`对话已同步删除: ${id}`, 'agnesStore');
      } catch (error) {
        logError('删除对话失败', 'agnesStore', error as Error);
        agnesLocalStorage.addPendingOperation(userId, {
          type: 'delete',
          entityType: 'conversation',
          entityId: id,
        });
      }
    }
  },

  setImageGenerating: (isGenerating) => {
    set((state) => ({
      imageGeneration: { ...state.imageGeneration, isGenerating },
    }));
  },

  addImageToHistory: (image) => {
    set((state) => ({
      imageGeneration: {
        ...state.imageGeneration,
        history: [image, ...state.imageGeneration.history],
      },
    }));
  },

  setImageHistory: (history) => {
    set((state) => ({
      imageGeneration: {
        ...state.imageGeneration,
        history,
      },
    }));
  },

  addVideoTask: (task) => {
    set((state) => ({
      videoGeneration: {
        ...state.videoGeneration,
        tasks: [task, ...state.videoGeneration.tasks.filter((t) => t.id !== task.id)],
      },
    }));
  },

  removeImage: async (imageId, userId?: string) => {
    set((state) => ({
      imageGeneration: {
        ...state.imageGeneration,
        history: state.imageGeneration.history.filter((img) => img.id !== imageId),
      },
    }));

    if (userId) {
      agnesLocalStorage.deleteImage(userId, imageId);
      try {
        await deleteImageTask(userId, imageId);
        logInfo(`图片任务已同步删除: ${imageId}`, 'agnesStore');
      } catch (error) {
        logError('删除图片任务失败', 'agnesStore', error as Error);
        agnesLocalStorage.addPendingOperation(userId, {
          type: 'delete',
          entityType: 'image',
          entityId: imageId,
        });
      }
    }
  },

  updateVideoTask: (taskId, updates) => {
    set((state) => ({
      videoGeneration: {
        ...state.videoGeneration,
        tasks: state.videoGeneration.tasks.map((task) =>
          task.id === taskId ? { ...task, ...updates } : task
        ),
      },
    }));
  },

  removeVideoTask: async (taskId, userId?: string) => {
    set((state) => ({
      videoGeneration: {
        ...state.videoGeneration,
        tasks: state.videoGeneration.tasks.filter((task) => task.id !== taskId),
      },
    }));

    if (userId) {
      agnesLocalStorage.deleteVideoTask(userId, taskId);
      try {
        await deleteVideoTask(userId, taskId);
        logInfo(`视频任务已同步删除: ${taskId}`, 'agnesStore');
      } catch (error) {
        logError('删除视频任务失败', 'agnesStore', error as Error);
        agnesLocalStorage.addPendingOperation(userId, {
          type: 'delete',
          entityType: 'video',
          entityId: taskId,
        });
      }
    }
  },

  setFontTasks: (tasks) => {
    set((state) => ({
      fontGeneration: {
        ...state.fontGeneration,
        tasks,
      },
    }));
  },

  addFontTask: (task) => {
    set((state) => ({
      fontGeneration: {
        ...state.fontGeneration,
        tasks: [task, ...state.fontGeneration.tasks],
      },
    }));
  },

  removeFontTask: async (taskId, userId?: string) => {
    set((state) => ({
      fontGeneration: {
        ...state.fontGeneration,
        tasks: state.fontGeneration.tasks.filter((task) => task.id !== taskId),
      },
    }));

    if (userId) {
      agnesLocalStorage.deleteFontTask(userId, taskId);
      try {
        await deleteFontTask(userId, taskId);
        logInfo(`字体任务已同步删除: ${taskId}`, 'agnesStore');
      } catch (error) {
        logError('删除字体任务失败', 'agnesStore', error as Error);
        agnesLocalStorage.addPendingOperation(userId, {
          type: 'delete',
          entityType: 'font',
          entityId: taskId,
        });
      }
    }
  },

  addRolePreset: (preset) => {
    set((state) => ({
      rolePresets: [...state.rolePresets, preset],
    }));
  },

  updateRolePreset: (id, updates) => {
    set((state) => ({
      rolePresets: state.rolePresets.map((preset) =>
        preset.id === id ? { ...preset, ...updates } : preset
      ),
    }));
  },

  deleteRolePreset: async (id, userId?: string) => {
    set((state) => ({
      rolePresets: state.rolePresets.filter((preset) => preset.id !== id),
      activeRolePresetId: state.activeRolePresetId === id ? null : state.activeRolePresetId,
    }));

    if (userId) {
      try {
        await deleteRolePreset(userId, id);
        logInfo(`角色预设已同步删除: ${id}`, 'agnesStore');
      } catch (error) {
        logError('删除角色预设失败', 'agnesStore', error as Error);
        agnesLocalStorage.addPendingOperation(userId, {
          type: 'delete',
          entityType: 'rolePreset',
          entityId: id,
        });
      }
    }
  },

  selectRolePreset: (id) => {
    set({ activeRolePresetId: id });
  },

  loadFromDatabase: async (userId: string) => {
    // 优先从本地存储读取数据
    const localConversations = agnesLocalStorage.getConversations(userId);
    const localImageHistory = agnesLocalStorage.getImageHistory(userId);
    const localVideoTasks = agnesLocalStorage.getVideoTasks(userId);
    const localFontTasks = agnesLocalStorage.getFontTasks(userId);
    const localRolePresets = agnesLocalStorage.getRolePresets(userId);

    // 如果本地有数据，先使用本地数据
    if (localConversations.length > 0 || localImageHistory.length > 0 || localVideoTasks.length > 0) {
      logInfo('使用本地存储数据初始化 Agnes Store', 'agnesStore');
      set({
        conversations: localConversations,
        rolePresets: [...defaultRolePresets, ...localRolePresets.filter(p => !defaultRolePresets.some(dp => dp.id === p.id))],
        imageGeneration: {
          isGenerating: false,
          result: null,
          history: localImageHistory,
        },
        videoGeneration: {
          tasks: localVideoTasks,
        },
        fontGeneration: {
          tasks: localFontTasks,
        },
      });
    }

    // 异步从数据库同步数据
    try {
      const conversations = await getUserConversations(userId);
      const presets = await getRolePresets(userId);
      const imageHistory = await getUserImageHistory(userId);
      const videoTasks = await getUserVideoTasks(userId);
      const fontTasks = await getUserFontTasks(userId);

      // 加载每个对话的消息
      const conversationsWithMessages = await Promise.all(
        conversations.map(async (conv) => {
          const messages = await getConversationMessages(conv.id);
          return { ...conv, messages };
        })
      );

      // 合并本地和数据库数据（数据库数据优先，但保留本地临时数据）
      const localConvIds = new Set(localConversations.map(c => c.id));
      const mergedConversations = [
        ...conversationsWithMessages,
        ...localConversations.filter(c => !localConvIds.has(c.id) && !conversationsWithMessages.some(db => db.id === c.id))
      ];

      const localImgIds = new Set(localImageHistory.map(img => img.id));
      const mergedImageHistory = [
        ...imageHistory,
        ...localImageHistory.filter(img => !localImgIds.has(img.id) && !imageHistory.some(db => db.id === img.id))
      ];

      const localVideoIds = new Set(localVideoTasks.map(t => t.id));
      const mergedVideoTasks = [
        ...videoTasks,
        ...localVideoTasks.filter(t => !localVideoIds.has(t.id) && !videoTasks.some(db => db.id === t.id))
      ];

      const localFontIds = new Set(localFontTasks.map(t => t.id));
      const mergedFontTasks = [
        ...fontTasks,
        ...localFontTasks.filter(t => !localFontIds.has(t.id) && !fontTasks.some(db => db.id === t.id))
      ];

      // 更新本地存储
      agnesLocalStorage.saveConversations(userId, mergedConversations);
      agnesLocalStorage.saveImageHistory(userId, mergedImageHistory);
      agnesLocalStorage.saveVideoTasks(userId, mergedVideoTasks);
      agnesLocalStorage.saveFontTasks(userId, mergedFontTasks);
      agnesLocalStorage.saveRolePresets(userId, presets);
      agnesLocalStorage.updateLastSyncTime(userId);

      set({
        conversations: mergedConversations,
        rolePresets: [...defaultRolePresets, ...presets.filter(p => !defaultRolePresets.some(dp => dp.id === p.id))],
        imageGeneration: {
          isGenerating: false,
          result: null,
          history: mergedImageHistory,
        },
        videoGeneration: {
          tasks: mergedVideoTasks,
        },
        fontGeneration: {
          tasks: mergedFontTasks,
        },
      });

      logInfo('Agnes 数据同步完成', 'agnesStore');
    } catch (error) {
      logError('加载Agnes数据失败', 'agnesStore', error as Error);
      // 如果数据库加载失败，确保本地数据已加载
      if (localConversations.length === 0 && localImageHistory.length === 0) {
        set({ rolePresets: defaultRolePresets });
      }
    }
  },
}));