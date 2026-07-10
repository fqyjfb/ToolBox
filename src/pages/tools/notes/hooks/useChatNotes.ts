import { useState, useCallback, useMemo } from 'react';
import { useCallbackRef } from '../../../../hooks/useCallbackRef';
import { ChatMessage, ChatTarget } from '../types/chat';
import { CHAT_FILENAME, LATER_FILENAME, READ_FILENAME, WATCH_FILENAME, SHOP_FILENAME, JOURNAL_FOLDER, ARCHIVE_FOLDER } from '../constants/paths';
import { parseChatContent, generateChatContent, generateTimestamp, generateTodayHeader, generateJournalFilename } from '../utils/chatParser';
import { DISPLAY_LIMITS } from '../../../../constants/timers';

export interface UseChatNotesProps {
  rootPath: string | null;
  onRefreshFileTree?: () => void;
}

export interface UseChatNotesReturn {
  isChatMode: boolean;
  setIsChatMode: (value: boolean) => void;
  messages: ChatMessage[];
  selectedMessages: string[];
  sendMessage: (text: string) => Promise<void>;
  toggleMessageDone: (messageId: string) => Promise<void>;
  toggleMessageSelection: (messageId: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
  moveMessages: (target: ChatTarget | string) => Promise<void>;
  refreshMessages: () => Promise<void>;
}

export function useChatNotes({ rootPath, onRefreshFileTree }: UseChatNotesProps): UseChatNotesReturn {
  const [isChatMode, setIsChatMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);

  const chatFilePath = useMemo(() => {
    if (!rootPath) return '';
    return `${rootPath}/${CHAT_FILENAME}`;
  }, [rootPath]);

  const refreshMessages = useCallback(async () => {
    if (!rootPath) return;
    
    try {
      const result = await (window.electron?.notes.readFile(chatFilePath) || Promise.resolve({ success: false }));
      if (result.success && result.content) {
        setMessages(parseChatContent(result.content));
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  }, [rootPath, chatFilePath]);

  const sendMessage = useCallback(async (text: string) => {
    if (!rootPath || !text.trim()) return;

    const timestamp = generateTimestamp();

    const currentContent = await (window.electron?.notes.readFile(chatFilePath) || Promise.resolve({ success: false }));
    let content = currentContent.success && currentContent.content ? currentContent.content : '';

    const todayHeader = `#### ${generateTodayHeader()}`;
    const lines = text.trim().split('\n');
    const formattedContent = `- [ ] \`${timestamp}\` ${lines[0]}\n${lines.slice(1).map(l => `  ${l}`).join('\n')}\n`;

    if (!content.includes(todayHeader)) {
      if (content) content += '\n\n';
      content += `${todayHeader}\n`;
    }

    if (!content.endsWith('\n')) content += '\n';
    content += formattedContent;

    await window.electron?.notes.saveFile(chatFilePath, content);
    await refreshMessages();
  }, [rootPath, chatFilePath, refreshMessages]);

  const toggleMessageDone = useCallback(async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !rootPath) return;

    const updatedMessages = messages.map(m => 
      m.id === messageId ? { ...m, done: !m.done } : m
    );

    const content = generateChatContent(updatedMessages);
    await window.electron?.notes.saveFile(chatFilePath, content);
    setMessages(updatedMessages);
  }, [messages, rootPath, chatFilePath]);

  const toggleMessageSelection = useCallback((messageId: string, multiSelect = false) => {
    if (!messageId) {
      setSelectedMessages([]);
      return;
    }
    setSelectedMessages(prev => {
      if (multiSelect) {
        if (prev.includes(messageId)) {
          return prev.filter(id => id !== messageId);
        }
        return [...prev, messageId];
      }
      return [messageId];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedMessages([]);
  }, []);

  const getMessagesToMove = useCallback(() => {
    if (selectedMessages.length > 0) {
      return messages.filter(m => selectedMessages.includes(m.id));
    }
    return messages;
  }, [messages, selectedMessages]);

  const ensureFolderExists = useCallbackRef(async (folderPath: string) => {
    try {
      const result = await (window.electron?.notes.createFolder(null, folderPath) || Promise.resolve({ success: true }));
      return result.success;
    } catch {
      return true;
    }
  }, []);

  const appendToFile = useCallbackRef(async (filePath: string, header: string, content: string) => {
    const result = await (window.electron?.notes.readFile(filePath) || Promise.resolve({ success: false }));
    let fileContent = result.success && result.content ? result.content : '';

    if (header && !fileContent.includes(header)) {
      if (fileContent) fileContent += '\n\n';
      fileContent += `${header}\n`;
    }
    if (fileContent && !fileContent.endsWith('\n')) fileContent += '\n';
    fileContent += `${content}\n`;

    await window.electron?.notes.saveFile(filePath, fileContent);
  }, []);

  const moveMessages = useCallback(async (target: ChatTarget | string) => {
    if (!rootPath) return;

    const messagesToMove = getMessagesToMove();
    if (messagesToMove.length === 0) return;

    switch (target) {
      case 'journal': {
        const journalFilename = generateJournalFilename();
        const destinationPath = `${rootPath}/${JOURNAL_FOLDER}/${journalFilename}`;
        const header = `## ${generateTodayHeader()}`;
        const contentToAppend = messagesToMove.map(m => `- ${m.text}`).join('\n');
        await ensureFolderExists(`${rootPath}/${JOURNAL_FOLDER}`);
        await appendToFile(destinationPath, header, contentToAppend);
        break;
      }
      case 'later':
      case 'read':
      case 'watch':
      case 'shop': {
        const filenameMap: Record<string, string> = {
          later: LATER_FILENAME,
          read: READ_FILENAME,
          watch: WATCH_FILENAME,
          shop: SHOP_FILENAME,
        };
        const destinationPath = `${rootPath}/${filenameMap[target]}`;
        const header = `#### ${generateTodayHeader()}`;
        const contentToAppend = messagesToMove.map(m => `- [ ] ${m.text}`).join('\n');
        await appendToFile(destinationPath, header, contentToAppend);
        break;
      }
      case 'archive': {
        for (const msg of messagesToMove) {
          const header = msg.text.slice(0, DISPLAY_LIMITS.CHAT_HEADER_LENGTH);
          const archiveFilename = `${header.replace(/[^\w\s]/g, '_')}.md`;
          const destinationPath = `${rootPath}/${ARCHIVE_FOLDER}/${archiveFilename}`;
          await ensureFolderExists(`${rootPath}/${ARCHIVE_FOLDER}`);
          await appendToFile(destinationPath, `# ${header}`, msg.text);
        }
        break;
      }
      default: {
        const destinationPath = target;
        const contentToAppend = messagesToMove.map(m => `- ${m.text}`).join('\n');
        await appendToFile(destinationPath, '', contentToAppend);
      }
    }

    const remainingMessages = messages.filter(m => !selectedMessages.includes(m.id));
    const content = generateChatContent(remainingMessages);
    await window.electron?.notes.saveFile(chatFilePath, content);
    
    setMessages(remainingMessages);
    setSelectedMessages([]);

    if (onRefreshFileTree) {
      onRefreshFileTree();
    }
  }, [rootPath, getMessagesToMove, messages, selectedMessages, chatFilePath, onRefreshFileTree, ensureFolderExists, appendToFile]);

  return {
    isChatMode,
    setIsChatMode,
    messages,
    selectedMessages,
    sendMessage,
    toggleMessageDone,
    toggleMessageSelection,
    clearSelection,
    moveMessages,
    refreshMessages,
  };
}