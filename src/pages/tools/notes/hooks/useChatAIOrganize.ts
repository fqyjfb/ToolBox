import { useCallback, useRef, useState } from 'react';
import { useToastStore } from '../../../../store/toastStore';
import { toolboxAI } from '../../../../services/aiApi';
import { CHAT_ORGANIZE_FOLDER } from '../constants/paths';
import type { ChatMessage } from '../types/chat';
import { buildOrganizeFileName, buildOrganizePrompt, normalizeAIMarkdown } from '../utils/aiOrganize';

const MAX_ORGANIZE_SOURCE_CHARS = 20000;

export interface UseChatAIOrganizeProps {
  chatPath: string | null;
  messages: ChatMessage[];
  selectedMessages: string[];
  onRefreshFileTree?: () => void;
  autoArchiveEnabled?: boolean;
  onMoveMessages?: (target: string) => Promise<void>;
}

export interface UseChatAIOrganizeReturn {
  aiOrganizing: boolean;
  handleAIOrganize: () => Promise<void>;
}

export function useChatAIOrganize({
  chatPath,
  messages,
  selectedMessages,
  onRefreshFileTree,
  autoArchiveEnabled = false,
  onMoveMessages,
}: UseChatAIOrganizeProps): UseChatAIOrganizeReturn {
  const addToast = useToastStore((state) => state.addToast);
  const [aiOrganizing, setAiOrganizing] = useState(false);
  const organizingRef = useRef(false);

  const handleAIOrganize = useCallback(async () => {
    if (organizingRef.current) return;

    if (!chatPath) {
      addToast({ type: 'warning', message: '请先设置对话目录' });
      return;
    }

    const selected = messages.filter((message) => selectedMessages.includes(message.id));
    if (selected.length === 0) {
      addToast({ type: 'info', message: '请先勾选要整理的想法' });
      return;
    }

    const sourceChars = selected.reduce((sum, message) => sum + message.text.length, 0);
    if (sourceChars > MAX_ORGANIZE_SOURCE_CHARS) {
      addToast({
        type: 'warning',
        message: `勾选内容过长（${sourceChars} 字），请减少到 ${MAX_ORGANIZE_SOURCE_CHARS} 字以内`,
      });
      return;
    }

    organizingRef.current = true;
    setAiOrganizing(true);
    try {
      const { system, user } = buildOrganizePrompt(selected);
      const raw = await toolboxAI.chat([{ role: 'user', content: user }], {
        systemPrompt: system,
        temperature: 0.3,
        timeoutMs: 90000,
      });

      const markdown = normalizeAIMarkdown(raw);
      const sep = chatPath.includes('\\') ? '\\' : '/';
      const organizeFolder = `${chatPath}${sep}${CHAT_ORGANIZE_FOLDER}`;

      await window.electron?.notes.createFolder(chatPath, CHAT_ORGANIZE_FOLDER);

      const result = await window.electron?.notes.createNoteForce(
        organizeFolder,
        buildOrganizeFileName(),
        'copy',
        markdown
      );

      if (!result?.success) {
        throw new Error(result?.error || '保存整理文档失败');
      }

      onRefreshFileTree?.();

      if (autoArchiveEnabled && selectedMessages.length > 0) {
        try {
          await onMoveMessages?.('archive');
          addToast({ type: 'success', message: 'AI 整理完成并已归档原消息' });
        } catch (_archiveError) {
          addToast({
            type: 'warning',
            message: '归档失败，请手动移动',
          });
        }
      } else {
        addToast({ type: 'success', message: 'AI 整理完成，已保存到「对话整理」' });
      }
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'AI 整理失败，请稍后重试',
      });
    } finally {
      organizingRef.current = false;
      setAiOrganizing(false);
    }
  }, [chatPath, messages, selectedMessages, onRefreshFileTree, autoArchiveEnabled, onMoveMessages, addToast]);

  return { aiOrganizing, handleAIOrganize };
}
