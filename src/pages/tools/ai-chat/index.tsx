import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgnesStore } from '../../../store/agnesStore';
import { createChatCompletion, generateImage, createVideoTask } from '../../../services/agnesApi';
import { createConversation, addMessage as addMessageToDb, createImageTask, createVideoTask as createVideoTaskRecord } from '../../../services/AgnesService';
import { agnesLocalStorage } from '../../../services/agnesLocalStorage';
import type { Message, Conversation, VideoTask, ImageResult } from '../../../types/agnes';
import { Send, ImageIcon, Video, RefreshCw, Plus, X, Wand2, Sparkles, Layers, Film, Trash2, Copy, Download, History, Edit3, FileText, Link2, Check } from 'lucide-react';
import { useAuthStore } from '../../../store/AuthStore';
import { useToastStore } from '../../../store/toastStore';
import { isElectron } from '../../../utils/environment';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function getTitleFromContent(content: string): string {
  const firstLine = content.split('\n')[0];
  return firstLine.substring(0, 12);
}

const MODEL_OPTIONS = [
  { value: 'agnes-image-2.0-flash', label: 'Agnes Image 2.0 Flash' },
  { value: 'agnes-image-2.1-flash', label: 'Agnes Image 2.1 Flash' },
];

const SIZE_OPTIONS = [
  { value: '512x512', label: '512 × 512' },
  { value: '1024x1024', label: '1024 × 1024' },
  { value: '1024x768', label: '1024 × 768' },
  { value: '768x1024', label: '768 × 1024' },
  { value: '1024x1536', label: '1024 × 1536' },
  { value: '1536x1024', label: '1536 × 1024' },
  { value: '1080x1920', label: '1080 × 1920' },
  { value: '1920x1080', label: '1920 × 1080' },
];

const RESOLUTION_OPTIONS = [
  { value: '1152x768', label: '1152 × 768' },
  { value: '768x1152', label: '768 × 1152' },
  { value: '512x512', label: '512 × 512' },
];

const FRAME_RATE_OPTIONS = [
  { value: 24, label: '24 FPS' },
  { value: 30, label: '30 FPS' },
  { value: 60, label: '60 FPS' },
];

const FRAME_COUNT_OPTIONS = [
  { value: 81, label: '81 帧' },
  { value: 121, label: '121 帧' },
  { value: 161, label: '161 帧' },
  { value: 241, label: '241 帧' },
  { value: 441, label: '441 帧' },
];

const MODE_OPTIONS = [
  { value: 'text2vid', label: '文生视频', icon: Sparkles },
  { value: 'image2vid', label: '图生视频', icon: ImageIcon },
  { value: 'multi-image', label: '多图视频', icon: Layers },
  { value: 'keyframes', label: '关键帧动画', icon: Film },
];

const NEGATIVE_TAGS = [
  '模糊', '低质量', '像素化', '水印', '文字', '变形', '不自然',
  '恐怖', '血腥', '暴力', '色情', '卡通', '3D渲染', '动漫', '手绘',
];

const CHAT_PRESETS = [
  { id: 'creative', name: '创意', temperature: 0.9, top_p: 0.9, max_tokens: 4096, thinking: false },
  { id: 'balanced', name: '平衡', temperature: 0.7, top_p: 0.8, max_tokens: 4096, thinking: false },
  { id: 'precise', name: '精准', temperature: 0.3, top_p: 0.5, max_tokens: 2048, thinking: false },
  { id: 'coding', name: '编程', temperature: 0.2, top_p: 0.4, max_tokens: 8192, thinking: true },
  { id: 'reasoning', name: '推理', temperature: 0.1, top_p: 0.3, max_tokens: 4096, thinking: true },
];

const MAX_TOKENS_OPTIONS = [
  { value: 512, label: '512' },
  { value: 1024, label: '1K' },
  { value: 2048, label: '2K' },
  { value: 4096, label: '4K' },
  { value: 8192, label: '8K' },
];

type ToolType = 'chat' | 'image' | 'video';

interface ToolOptions {
  imageModel: string;
  imageSize: string;
  imageSeed: string;
  negativePrompt: string;
  videoModel: string;
  videoResolution: string;
  videoFrameRate: number;
  videoFrameCount: number;
  videoSeed: string;
  videoMode: string;
}

const MAX_REFERENCE_IMAGES = 4;
const MAX_VIDEO_REFERENCE_IMAGES = 4;

export default function AIChatPage() {
  const admin = useAuthStore((state) => state.admin);
  const addToast = useToastStore((state) => state.addToast);
  const navigate = useNavigate();

  const {
    conversations,
    activeConversationId,
    rolePresets,
    activeRolePresetId,
    selectRolePreset,
    addConversation,
    selectConversation,
    updateConversationId,
    addMessage,
    updateMessage,
    deleteMessage,
    deleteConversation,
    setImageGenerating,
    addImageToHistory,
    addVideoTask,
    loadFromDatabase,
  } = useAgnesStore();

  const [isLoading, setIsLoading] = useState(false);
  const [chatOptions, setChatOptions] = useState({
    temperature: 0.7,
    top_p: 1.0,
    max_tokens: 4096,
    enable_thinking: false,
  });
  const [activePreset, setActivePreset] = useState<string | null>('balanced');
  const [activeTool, setActiveTool] = useState<ToolType>('chat');
  const [showToolPanel, setShowToolPanel] = useState(false);
  const [negativePromptExpanded, setNegativePromptExpanded] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, { type: 'text' | 'markdown' | 'url'; value: boolean }>>({});
  const [showImageModal, setShowImageModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const [toolOptions, setToolOptions] = useState<ToolOptions>({
    imageModel: 'agnes-image-2.1-flash',
    imageSize: '1024x1024',
    imageSeed: '',
    negativePrompt: '',
    videoModel: 'agnes-video-v2.0',
    videoResolution: '1152x768',
    videoFrameRate: 24,
    videoFrameCount: 121,
    videoSeed: '',
    videoMode: 'text2vid',
  });

  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [videoReferenceImages, setVideoReferenceImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [videoImageUrlInput, setVideoImageUrlInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  useEffect(() => {
    if (admin) {
      loadFromDatabase(admin.id);
    }
  }, [admin, loadFromDatabase]);

  const handleNewConversation = () => {
    selectConversation(null);
    setEditingContent('');
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !admin || isLoading) return;

    setIsLoading(true);

    let conversationId = activeConversationId;
    let isNewConversation = false;
    let dbConversationId: string | null = null;

    if (!conversationId) {
      conversationId = generateId();
      isNewConversation = true;
    } else {
      isNewConversation = !conversations.some((c) => c.id === conversationId);
    }

    if (isNewConversation) {
      const title = getTitleFromContent(content);
      const newConversation: Conversation = {
        id: conversationId,
        user_id: admin.id,
        title,
        role_preset_id: activeRolePresetId || null,
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      addConversation(newConversation);

      // 同步保存到本地存储
      agnesLocalStorage.addConversation(admin.id, newConversation);

      try {
        const createdConversation = await createConversation(admin.id, title, activeRolePresetId || undefined);
        if (createdConversation && createdConversation.id) {
          dbConversationId = createdConversation.id;
          updateConversationId(conversationId, dbConversationId);
          // 更新本地存储中的对话ID
          agnesLocalStorage.updateConversation(admin.id, conversationId, { id: dbConversationId });
        }
      } catch (error) {
        console.error('创建对话失败:', error);
        // 添加待同步操作
        agnesLocalStorage.addPendingOperation(admin.id, {
          type: 'create',
          entityType: 'conversation',
          entityId: conversationId,
          data: newConversation,
        });
      }
    } else {
      dbConversationId = conversationId;
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    addMessage(conversationId, userMessage);
    setEditingContent('');
    scrollToBottom();

    setIsLoading(true);

    if (dbConversationId) {
      addMessageToDb(admin.id, dbConversationId, 'user', content).catch((error) => {
        console.error('保存用户消息失败:', error);
      });
    }

    try {
      let resultContent = '';

      switch (activeTool) {
        case 'image':
          resultContent = await handleImageGeneration(content);
          const imageMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: resultContent,
            created_at: new Date().toISOString(),
          };
          addMessage(conversationId, imageMessage);
          if (dbConversationId) {
            try {
              await addMessageToDb(admin.id, dbConversationId, 'assistant', resultContent);
            } catch (error) {
              console.error('保存消息失败:', error);
            }
          }
          break;
        case 'video':
          resultContent = await handleVideoGeneration(content);
          const videoMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: resultContent,
            created_at: new Date().toISOString(),
          };
          addMessage(conversationId, videoMessage);
          if (dbConversationId) {
            try {
              await addMessageToDb(admin.id, dbConversationId, 'assistant', resultContent);
            } catch (error) {
              console.error('保存消息失败:', error);
            }
          }
          break;
        default:
          await handleChatCompletion(conversationId, content, userMessage, dbConversationId);
          break;
      }
    } catch (error) {
      console.error('Error:', error);
      addToast({ type: 'error', message: '请求失败，请稍后重试' });
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: '抱歉，请求失败，请稍后重试。',
        created_at: new Date().toISOString(),
      };
      addMessage(conversationId, errorMessage);
    } finally {
      setIsLoading(false);
      setShowToolPanel(false);
      setReferenceImages([]);
      setVideoReferenceImages([]);
    }
  };

  const handleChatCompletion = async (conversationId: string, _content: string, userMessage: Message, dbConversationId?: string | null): Promise<string> => {
    const conv = conversations.find((c) => c.id === conversationId);
    const activePresetData = rolePresets.find((p) => p.id === activeRolePresetId);

    let messagesWithUser: Array<{ role: string; content: string }> = conv
      ? [...conv.messages.map(m => ({ role: m.role, content: m.content })), { role: userMessage.role, content: userMessage.content }]
      : [{ role: userMessage.role, content: userMessage.content }];

    if (activePresetData && activePresetData.system_prompt && !conv?.messages.some((m) => m.role === 'system')) {
      messagesWithUser = [{ role: 'system', content: activePresetData.system_prompt }, ...messagesWithUser];
    }

    const response = await createChatCompletion(messagesWithUser, chatOptions);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorBody}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    let contentResult = '';
    let thinkingResult = '';
    let buffer = '';

    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      thinking: '',
      created_at: new Date().toISOString(),
    };
    addMessage(conversationId, assistantMessage);

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const text = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
            const thinking = parsed.choices?.[0]?.delta?.reasoning_content || parsed.choices?.[0]?.message?.reasoning_content || '';
            if (text) {
              contentResult += text;
              updateMessage(conversationId, assistantMessage.id, contentResult, thinkingResult);
              scrollToBottom();
            }
            if (thinking) {
              thinkingResult += thinking;
              updateMessage(conversationId, assistantMessage.id, contentResult, thinkingResult);
              scrollToBottom();
            }
          } catch {
            // Skip incomplete JSON
          }
        }
      }
      buffer = lines[lines.length - 1] || '';
    }

    if (!thinkingResult.trim()) {
      updateMessage(conversationId, assistantMessage.id, contentResult, undefined);
    }

    if (dbConversationId) {
      try {
        await addMessageToDb(admin!.id, dbConversationId, 'assistant', contentResult, thinkingResult || undefined);
      } catch (error) {
        console.error('保存消息失败:', error);
      }
    }

    return contentResult;
  };

  const handleImageGeneration = async (prompt: string): Promise<string> => {
    setImageGenerating(true);

    try {
      const extraBody: Record<string, unknown> = {};
      if (toolOptions.negativePrompt) {
        extraBody.negative_prompt = toolOptions.negativePrompt;
      }
      if (toolOptions.imageSeed) {
        extraBody.seed = parseInt(toolOptions.imageSeed, 10);
      }
      if (referenceImages.length > 0) {
        extraBody.images = referenceImages;
      }

      const result = await generateImage(prompt, toolOptions.imageModel, toolOptions.imageSize, extraBody);

      const imageResult: ImageResult = {
        id: generateId(),
        url: result.url,
        prompt,
        size: toolOptions.imageSize,
        model: toolOptions.imageModel,
        seed: toolOptions.imageSeed ? parseInt(toolOptions.imageSeed, 10) : undefined,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        createdAt: Date.now(),
      };

      // 先添加到本地状态
      addImageToHistory(imageResult);

      // 同步保存到本地存储
      if (admin) {
        agnesLocalStorage.addImageToHistory(admin.id, imageResult);
      }

      // 异步同步到数据库
      try {
        await createImageTask(admin!.id, {
          prompt,
          model: toolOptions.imageModel,
          size: toolOptions.imageSize,
          seed: imageResult.seed,
          negative_prompt: toolOptions.negativePrompt,
          reference_images: referenceImages,
          image_url: result.url,
          source: 'chat',
          status: 'completed',
        });
      } catch (error) {
        console.error('保存图片任务失败:', error);
        // 添加待同步操作
        if (admin) {
          agnesLocalStorage.addPendingOperation(admin.id, {
            type: 'create',
            entityType: 'image',
            entityId: imageResult.id,
            data: imageResult,
          });
        }
      }

      return `![生成的图像](${result.url})\n\n**提示词**: ${prompt}\n**尺寸**: ${toolOptions.imageSize}\n**模型**: ${MODEL_OPTIONS.find(m => m.value === toolOptions.imageModel)?.label}`;
    } finally {
      setImageGenerating(false);
    }
  };

  const handleVideoGeneration = async (prompt: string): Promise<string> => {
    const [width, height] = toolOptions.videoResolution.split('x').map(Number);
    const payload: Record<string, unknown> = {
      width,
      height,
      num_frames: toolOptions.videoFrameCount,
      frame_rate: toolOptions.videoFrameRate,
    };

    if (toolOptions.negativePrompt) {
      payload.negative_prompt = toolOptions.negativePrompt;
    }
    if (toolOptions.videoSeed) {
      payload.seed = parseInt(toolOptions.videoSeed, 10);
    }
    if (videoReferenceImages.length > 0) {
      if (toolOptions.videoMode === 'image2vid') {
        payload.image = videoReferenceImages[0];
      } else if (toolOptions.videoMode === 'multi-image' || toolOptions.videoMode === 'keyframes') {
        payload.extra_body = {
          image: videoReferenceImages,
          ...(toolOptions.videoMode === 'keyframes' ? { mode: 'keyframes' } : {}),
        };
      }
    }

    const result = await createVideoTask(prompt, toolOptions.videoModel, payload);

    const task: VideoTask = {
      id: result.task_id,
      user_id: admin!.id,
      task_id: result.task_id,
      prompt,
      status: result.status as VideoTask['status'],
      progress: result.progress,
      size: result.size,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 先添加到本地状态
    addVideoTask(task);

    // 同步保存到本地存储
    if (admin) {
      agnesLocalStorage.addVideoTask(admin.id, task);
    }

    // 异步同步到数据库
    try {
      await createVideoTaskRecord(admin!.id, {
        task_id: result.task_id,
        prompt,
        model: toolOptions.videoModel,
        width,
        height,
        num_frames: toolOptions.videoFrameCount,
        frame_rate: toolOptions.videoFrameRate,
        seed: toolOptions.videoSeed ? parseInt(toolOptions.videoSeed, 10) : undefined,
        negative_prompt: toolOptions.negativePrompt,
        status: result.status as VideoTask['status'],
        progress: result.progress,
      });
    } catch (error) {
      console.error('保存视频任务失败:', error);
      // 添加待同步操作
      if (admin) {
        agnesLocalStorage.addPendingOperation(admin.id, {
          type: 'create',
          entityType: 'video',
          entityId: task.id,
          data: task,
        });
      }
    }

    const duration = (toolOptions.videoFrameCount / toolOptions.videoFrameRate).toFixed(1);
    return `🎬 **视频任务已创建**\n\n**提示词**: ${prompt}\n**状态**: ${task.status === 'queued' ? '排队中' : '处理中'}\n**分辨率**: ${toolOptions.videoResolution}\n**预计时长**: ${duration} 秒\n**帧数**: ${toolOptions.videoFrameCount}\n**帧率**: ${toolOptions.videoFrameRate} FPS`;
  };

  const handleRegenerate = async (messageId: string) => {
    if (!activeConversationId || !admin) return;

    const conv = conversations.find((c) => c.id === activeConversationId);
    if (!conv) return;

    const messageIndex = conv.messages.findIndex((m) => m.id === messageId);
    if (messageIndex <= 0) return;

    const userMessage = conv.messages[messageIndex - 1];
    if (!userMessage || userMessage.role !== 'user') return;

    deleteMessage(activeConversationId, messageId, admin.id);

    setIsLoading(true);

    try {
      await handleSendMessage(userMessage.content);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeConversationId || !admin) return;
    await deleteMessage(activeConversationId, messageId, admin.id);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    const fileArray = Array.from(files).slice(0, MAX_REFERENCE_IMAGES - referenceImages.length);

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        newImages.push(event.target?.result as string);
        if (newImages.length === fileArray.length) {
          setReferenceImages((prev) => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    const limit = toolOptions.videoMode === 'keyframes' || toolOptions.videoMode === 'multi-image' ? 4 : 1;
    const fileArray = Array.from(files).slice(0, limit - videoReferenceImages.length);

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        newImages.push(event.target?.result as string);
        if (newImages.length === fileArray.length) {
          setVideoReferenceImages((prev) => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeVideoReferenceImage = (index: number) => {
    setVideoReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddImageUrl = () => {
    const trimmedUrl = imageUrlInput.trim();
    if (!trimmedUrl) return;
    if (referenceImages.length >= MAX_REFERENCE_IMAGES) {
      addToast({ type: 'error', message: `最多只能添加${MAX_REFERENCE_IMAGES}张参考图片` });
      return;
    }
    setReferenceImages((prev) => [...prev, trimmedUrl]);
    setImageUrlInput('');
  };

  const handleAddVideoImageUrl = () => {
    const trimmedUrl = videoImageUrlInput.trim();
    if (!trimmedUrl) return;
    const limit = toolOptions.videoMode === 'keyframes' || toolOptions.videoMode === 'multi-image' ? MAX_VIDEO_REFERENCE_IMAGES : 1;
    if (videoReferenceImages.length >= limit) {
      addToast({ type: 'error', message: `最多只能添加${limit}张参考图片` });
      return;
    }
    setVideoReferenceImages((prev) => [...prev, trimmedUrl]);
    setVideoImageUrlInput('');
  };

  const handlePresetSelect = (preset: typeof CHAT_PRESETS[0]) => {
    setChatOptions({
      temperature: preset.temperature,
      top_p: preset.top_p,
      max_tokens: preset.max_tokens,
      enable_thinking: preset.thinking,
    });
    setActivePreset(preset.id);
  };

  const handleToggleThinking = () => {
    setChatOptions((prev) => ({
      ...prev,
      enable_thinking: !prev.enable_thinking,
    }));
    setActivePreset(null);
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      addToast({ type: 'success', message: '下载成功' });
    } catch {
      addToast({ type: 'error', message: '下载失败' });
    }
  };

  const removeMarkdown = (text: string): string => {
    return text
      .replace(/```(\w*)\n([\s\S]*?)```/g, '$2')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/!\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/---/g, '')
      .replace(/>>>\s*/g, '')
      .replace(/>\s*/g, '')
      .replace(/^\s*\n/gm, '')
      .trim();
  };

  const handleCopy = async (messageId: string, content: string) => {
    const plainText = removeMarkdown(content);
    try {
      await navigator.clipboard.writeText(plainText);
      setCopiedStates((prev) => ({ ...prev, [messageId]: { type: 'text', value: true } }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [messageId]: { type: 'text', value: false } }));
      }, 2000);
    } catch {
      addToast({ type: 'error', message: '复制失败' });
    }
  };

  const handleCopyMarkdown = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedStates((prev) => ({ ...prev, [messageId]: { type: 'markdown', value: true } }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [messageId]: { type: 'markdown', value: false } }));
      }, 2000);
    } catch {
      addToast({ type: 'error', message: '复制失败' });
    }
  };

  const handleCopyUrl = async (messageId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedStates((prev) => ({ ...prev, [messageId]: { type: 'url', value: true } }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [messageId]: { type: 'url', value: false } }));
      }, 2000);
    } catch {
      addToast({ type: 'error', message: '复制失败' });
    }
  };

  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessage(messageId);
    setEditingContent(content);
  };

  const handleSaveEdit = () => {
    if (editingMessage && editingContent.trim() && activeConversationId) {
      updateMessage(activeConversationId, editingMessage, editingContent);
      setEditingMessage(null);
      setEditingContent('');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditingContent('');
  };

  return (
    <div className={`flex ${isElectron() ? 'h-full' : 'h-[calc(100vh-120px)] md:h-[calc(100vh-100px)]'} overflow-hidden bg-gray-50 dark:bg-gray-900`}>
      <div className={`flex flex-col bg-white dark:bg-gray-800 transition-all duration-300 min-h-0 overflow-hidden flex-shrink-0 ${
        sidebarCollapsed ? 'w-14' : 'w-[180px] md:w-[200px]'
      }`}>
        <div className="p-3 flex items-center justify-between">
          {!sidebarCollapsed && (
            <>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">对话</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigate('/tools/ai-chat/history')}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                  title="历史记录"
                >
                  <History className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/tools/ai-chat/roles')}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                  title="角色预设"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNewConversation}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                  title="新对话"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
          {sidebarCollapsed && (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => navigate('/tools/ai-chat/history')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                title="历史记录"
              >
                <History className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/tools/ai-chat/roles')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                title="角色预设"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                onClick={handleNewConversation}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                title="新对话"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {conversations.length === 0 ? (
            <div className={`p-4 text-center ${sidebarCollapsed ? 'hidden' : ''}`}>
              <p className="text-gray-500 dark:text-gray-400">暂无对话</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`relative cursor-pointer transition-colors group ${
                    activeConversationId === conv.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  } ${sidebarCollapsed ? 'p-2 flex justify-center' : 'p-3'}`}
                  title={sidebarCollapsed ? conv.title : undefined}
                >
                  {sidebarCollapsed ? (
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-medium truncate">
                      {conv.title.charAt(0)}
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{conv.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].content.substring(0, 30) : '无消息'}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id, admin?.id);
                        }}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="删除对话"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
          title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}>
          {sidebarCollapsed ? (
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 min-w-0 min-h-0 overflow-hidden">
        {(activeConversation || activeConversationId) ? (
          <>
            <div className="flex-1 overflow-y-auto p-3 scrollbar-hide">
              <div className="max-w-4xl mx-auto">
                {activeConversation?.messages.map((message) => {
                  const mediaUrlMatch = message.content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
                  const mediaUrl = mediaUrlMatch ? mediaUrlMatch[1] : undefined;
                  const isUser = message.role === 'user';
                  const copiedState = copiedStates[message.id];

                  if (isUser) {
                    return (
                      <div key={message.id} className="flex justify-end mb-3">
                        <div className="max-w-[75%]">
                          {editingMessage === message.id ? (
                            <div className="px-3 py-2 rounded-xl shadow-sm bg-primary rounded-tr-md">
                              <textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                className="w-full bg-transparent text-white text-sm resize-none outline-none"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-3 py-1 text-xs text-white/70 hover:text-white"
                                >
                                  取消
                                </button>
                                <button
                                  onClick={handleSaveEdit}
                                  className="px-3 py-1 text-xs bg-white/20 rounded hover:bg-white/30 text-white"
                                >
                                  保存
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="px-3 py-2 rounded-xl shadow-sm bg-primary text-white rounded-tr-md break-words">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {message.content}
                              </p>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1 justify-end">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(message.created_at || Date.now()).toLocaleTimeString('zh-CN')}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleCopy(message.id, message.content)}
                                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 ${
                                  copiedState?.type === 'text' && copiedState.value
                                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                                title="复制"
                              >
                                {copiedState?.type === 'text' && copiedState.value ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleEditMessage(message.id, message.content)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
                                title="修改"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={message.id} className="flex justify-start mb-3">
                      <div className="w-full">
                        <div className="px-3 py-2 rounded-xl shadow-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-md break-words">
                          {message.thinking && (
                            <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <button
                                onClick={() => setThinkingExpanded(!thinkingExpanded)}
                                className="flex items-center gap-2 w-full mb-2"
                              >
                                <div className="w-2 h-2 rounded-full bg-primary"></div>
                                <span className="text-xs font-medium text-primary">思考</span>
                                <svg
                                  className={`ml-auto w-3 h-3 text-primary transition-transform duration-200 ${thinkingExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              <div className={`overflow-hidden transition-all duration-200 ${thinkingExpanded ? 'max-h-[200px] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0'}`}>
                                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap">
                                  {message.thinking}
                                </p>
                              </div>
                            </div>
                          )}
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => (
                                <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-semibold text-gray-800 dark:text-gray-200">{children}</strong>
                              ),
                              em: ({ children }) => <em className="italic">{children}</em>,
                              code: ({ className, children }) => {
                                const content = String(children);
                                const isBlock = className !== undefined || content.includes('\n');
                                if (isBlock) {
                                  return (
                                    <div className="overflow-x-auto">
                                      <div className="relative bg-gray-900 rounded-lg my-2">
                                        <button
                                          onClick={() => navigator.clipboard.writeText(content)}
                                          className="absolute top-2 right-2 flex items-center justify-center rounded transition-all text-gray-500 hover:text-white"
                                          title="复制代码"
                                        >
                                          <Copy className="w-4 h-4" />
                                        </button>
                                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm break-all whitespace-pre-wrap">
                                          <code>{children}</code>
                                        </pre>
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-sm font-mono break-all">
                                    {children}
                                  </code>
                                );
                              },
                              a: ({ href, children }) => (
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  {children}
                                </a>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc list-inside mb-2 space-y-1 break-words">{children}</ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal list-inside mb-2 space-y-1 break-words">{children}</ol>
                              ),
                              li: ({ children }) => <li className="text-sm break-words">{children}</li>,
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-4 border-primary pl-4 italic text-gray-600 dark:text-gray-400 my-2 break-words">
                                  {children}
                                </blockquote>
                              ),
                              h1: ({ children }) => (
                                <h1 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-200">{children}</h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-lg font-bold mb-2 text-gray-800 dark:text-gray-200">{children}</h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-base font-bold mb-2 text-gray-800 dark:text-gray-200">{children}</h3>
                              ),
                              hr: () => <hr className="border-gray-200 dark:border-gray-700 my-4" />,
                              img: ({ src, alt }) => (
                                <span className="inline-block my-2 cursor-pointer">
                                  <img
                                    src={src}
                                    alt={alt}
                                    className="max-w-xs max-h-[200px] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 object-contain hover:opacity-90 transition-opacity cursor-pointer"
                                    onClick={() => {
                                      setPreviewImageUrl(src || '');
                                      setShowImageModal(true);
                                    }}
                                  />
                                </span>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 justify-start">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(message.created_at || Date.now()).toLocaleTimeString('zh-CN')}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCopyMarkdown(message.id, message.content)}
                              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 ${
                                copiedState?.type === 'markdown' && copiedState.value
                                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              title="复制Markdown"
                            >
                              {copiedState?.type === 'markdown' && copiedState.value ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleCopy(message.id, message.content)}
                              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 ${
                                copiedState?.type === 'text' && copiedState.value
                                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              title="复制文本"
                            >
                              {copiedState?.type === 'text' && copiedState.value ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            {mediaUrl && (
                              <>
                                <button
                                  onClick={() => handleCopyUrl(message.id, mediaUrl)}
                                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 ${
                                    copiedState?.type === 'url' && copiedState.value
                                      ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                  title="复制链接"
                                >
                                  {copiedState?.type === 'url' && copiedState.value ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <Link2 className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDownload(mediaUrl)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
                                  title="下载"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleRegenerate(message.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
                              title="重新生成"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(message.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              {showImageModal && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                  onClick={() => setShowImageModal(false)}
                >
                  <button
                    className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                    onClick={() => setShowImageModal(false)}
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <img
                    src={previewImageUrl}
                    alt="Preview"
                    className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </div>

            {showToolPanel && (activeTool === 'image' || activeTool === 'video') && (
              <div className="bg-white dark:bg-gray-800">
                <button
                  onClick={() => setNegativePromptExpanded(!negativePromptExpanded)}
                  className="w-full flex items-center justify-center py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${negativePromptExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {negativePromptExpanded && (
                  <div className="p-4">
                    <div className="max-w-4xl mx-auto">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {NEGATIVE_TAGS.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => {
                              setToolOptions((prev) => ({
                                ...prev,
                                negativePrompt: prev.negativePrompt.includes(tag)
                                  ? prev.negativePrompt.replace(tag, '').replace(/,\s*/g, ',').replace(/^,|,$/g, '').trim()
                                  : prev.negativePrompt
                                    ? `${prev.negativePrompt}, ${tag}`
                                    : tag
                              }));
                            }}
                            className={`px-2 py-1 rounded-md text-xs transition-all ${
                              toolOptions.negativePrompt.includes(tag)
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={toolOptions.negativePrompt}
                          onChange={(e) => setToolOptions((prev) => ({ ...prev, negativePrompt: e.target.value }))}
                          placeholder="输入不想要的内容..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 pr-8"
                        />
                        {toolOptions.negativePrompt && (
                          <button
                            onClick={() => setToolOptions((prev) => ({ ...prev, negativePrompt: '' }))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-2 bg-white dark:bg-gray-800">
              <div className="max-w-4xl mx-auto">
                <div className="rounded-xl bg-gray-100 dark:bg-gray-700 shadow-sm">
                  {(activeTool === 'image' && referenceImages.length > 0) && (
                    <div className="flex items-center gap-2 px-3 pt-3">
                      {referenceImages.map((img, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={img}
                            alt={`参考图 ${index + 1}`}
                            className="w-10 h-10 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                          />
                          <button
                            onClick={() => removeReferenceImage(index)}
                            className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-2 h-2" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(activeTool === 'video' && (toolOptions.videoMode === 'image2vid' || toolOptions.videoMode === 'multi-image' || toolOptions.videoMode === 'keyframes') && videoReferenceImages.length > 0) && (
                    <div className="flex items-center gap-2 px-3 pt-3">
                      {videoReferenceImages.map((img, index) => {
                        const isKeyframesMode = toolOptions.videoMode === 'keyframes';
                        let label = '';
                        if (isKeyframesMode) {
                          if (index === 0) label = '首帧';
                          else if (index === videoReferenceImages.length - 1) label = '尾帧';
                          else label = `参考图${index}`;
                        } else {
                          label = `参考图${index + 1}`;
                        }
                        return (
                          <div key={index} className="relative group">
                            <img
                              src={img}
                              alt={label}
                              className="w-10 h-10 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                            />
                            {isKeyframesMode && (
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary/90 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
                                {index === 0 ? '首帧' : index === videoReferenceImages.length - 1 ? '尾帧' : '参考'}
                              </div>
                            )}
                            <button
                              onClick={() => removeVideoReferenceImage(index)}
                              className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-2 h-2" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-1 px-3 py-1">
                    <button
                      onClick={() => {
                        setActiveTool('chat');
                        setShowToolPanel(false);
                        setNegativePromptExpanded(false);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        activeTool === 'chat'
                          ? 'bg-primary text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Send className="w-3 h-3" />
                      <span>聊天</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTool('image');
                        setShowToolPanel(true);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        activeTool === 'image'
                          ? 'bg-primary text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <ImageIcon className="w-3 h-3" />
                      <span>图像</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTool('video');
                        setShowToolPanel(true);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        activeTool === 'video'
                          ? 'bg-primary text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Video className="w-3 h-3" />
                      <span>视频</span>
                    </button>
                  </div>

                  <textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(editingContent);
                      }
                    }}
                    placeholder={
                      activeTool === 'image'
                        ? '输入图像描述...'
                        : activeTool === 'video'
                        ? '输入视频描述...'
                        : '输入消息...'
                    }
                    disabled={isLoading}
                    className="w-full px-4 py-3 resize-none focus:outline-none text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 bg-transparent min-h-[48px] max-h-[140px]"
                  />

                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                      {activeTool === 'chat' && (
                        <>
                          {CHAT_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => handlePresetSelect(preset)}
                              className={`px-2 py-1 rounded-md text-xs transition-all flex-shrink-0 ${
                                activePreset === preset.id
                                  ? 'bg-primary text-white'
                                  : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                              }`}
                            >
                              {preset.name}
                            </button>
                          ))}
                          <button
                            onClick={handleToggleThinking}
                            disabled={isLoading}
                            className={`w-7 h-7 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${
                              chatOptions.enable_thinking
                                ? 'bg-primary/10 text-primary'
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                            title="思考模式"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                          </button>
                          <select
                            value={chatOptions.max_tokens}
                            onChange={(e) => {
                              setChatOptions((prev) => ({ ...prev, max_tokens: parseInt(e.target.value) }));
                              setActivePreset(null);
                            }}
                            className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-primary flex-shrink-0"
                          >
                            {MAX_TOKENS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                      {activeTool === 'image' && (
                        <>
                          <label className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex-shrink-0">
                            <Plus className="w-4 h-4" />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                              multiple
                            />
                          </label>
                          <input
                            type="text"
                            value={imageUrlInput}
                            onChange={(e) => setImageUrlInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddImageUrl()}
                            placeholder="URL"
                            className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-primary w-20 flex-shrink-0"
                          />
                          <select
                            value={toolOptions.imageModel}
                            onChange={(e) => setToolOptions((prev) => ({ ...prev, imageModel: e.target.value }))}
                            className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-primary flex-shrink-0"
                          >
                            {MODEL_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={toolOptions.imageSize}
                            onChange={(e) => setToolOptions((prev) => ({ ...prev, imageSize: e.target.value }))}
                            className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-primary flex-shrink-0"
                          >
                            {SIZE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={toolOptions.imageSeed}
                            onChange={(e) => setToolOptions((prev) => ({ ...prev, imageSeed: e.target.value }))}
                            placeholder="种子"
                            className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-primary w-16 flex-shrink-0"
                          />
                        </>
                      )}
                      {activeTool === 'video' && (
                        <>
                          {(toolOptions.videoMode === 'image2vid' || toolOptions.videoMode === 'multi-image' || toolOptions.videoMode === 'keyframes') && videoReferenceImages.length < (toolOptions.videoMode === 'keyframes' || toolOptions.videoMode === 'multi-image' ? 4 : 1) && (
                            <>
                              <label className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex-shrink-0">
                                <Plus className="w-4 h-4" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleVideoImageUpload}
                                  className="hidden"
                                  multiple
                                />
                              </label>
                              <input
                                type="text"
                                value={videoImageUrlInput}
                                onChange={(e) => setVideoImageUrlInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddVideoImageUrl()}
                                placeholder="URL"
                                className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-primary w-20 flex-shrink-0"
                              />
                            </>
                          )}
                          {MODE_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const isSelected = toolOptions.videoMode === option.value;
                            return (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setToolOptions((prev) => ({ ...prev, videoMode: option.value }));
                                  setVideoReferenceImages([]);
                                }}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all flex-shrink-0 ${
                                  isSelected
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                                }`}
                              >
                                <Icon className="w-3 h-3" />
                                <span>{option.label}</span>
                              </button>
                            );
                          })}
                          <select
                            value={toolOptions.videoResolution}
                            onChange={(e) => setToolOptions((prev) => ({ ...prev, videoResolution: e.target.value }))}
                            className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-primary flex-shrink-0"
                          >
                            {RESOLUTION_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={toolOptions.videoFrameCount}
                            onChange={(e) => setToolOptions((prev) => ({ ...prev, videoFrameCount: Number(e.target.value) }))}
                            className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-primary flex-shrink-0"
                          >
                            {FRAME_COUNT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={toolOptions.videoFrameRate}
                            onChange={(e) => setToolOptions((prev) => ({ ...prev, videoFrameRate: Number(e.target.value) }))}
                            className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-primary flex-shrink-0"
                          >
                            {FRAME_RATE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={toolOptions.videoSeed}
                            onChange={(e) => setToolOptions((prev) => ({ ...prev, videoSeed: e.target.value }))}
                            placeholder="种子"
                            className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-primary w-16 flex-shrink-0"
                          />
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => handleSendMessage(editingContent)}
                      disabled={isLoading || !editingContent.trim()}
                      className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all ml-2"
                      title="发送"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">💬</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
              欢迎使用 Agnes AI
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
              选择一个角色开始对话
            </p>

            <div className="w-full max-w-2xl">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
                {rolePresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      selectRolePreset(preset.id);
                      const newId = generateId();
                      selectConversation(newId);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all hover:shadow-sm ${
                      activeRolePresetId === preset.id
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-200 dark:border-gray-600 hover:border-primary/50'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center text-base ${
                      activeRolePresetId === preset.id ? 'bg-primary/20' : 'bg-gray-100 dark:bg-gray-600'
                    }`}>
                      {preset.icon}
                    </div>
                    <span className="font-medium text-gray-800 dark:text-gray-200 text-sm whitespace-nowrap">{preset.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    selectRolePreset(null);
                    const newId = generateId();
                    selectConversation(newId);
                  }}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  不使用角色预设
                </button>
                <button
                  onClick={() => {
                    const newId = generateId();
                    selectConversation(newId);
                  }}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  开始对话
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}