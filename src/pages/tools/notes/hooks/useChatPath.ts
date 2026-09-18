// 对话路径 + 对话整理树；loadChatOrganizeTree 由 useNotesTree 通过依赖注入调用

import { useState, useCallback, useEffect } from 'react';
import localStorageService, { STORAGE_KEYS } from '../../../../services/localStorageService';
import { CHAT_ORGANIZE_FOLDER } from '../constants/paths';
import { logError } from '../../../../services/loggerService';
import type { FileTreeNode } from '../types';

export interface UseChatPathReturn {
  chatPath: string | null;
  chatOrganizeTree: FileTreeNode[];
  setChatPath: () => Promise<boolean>;
  loadChatOrganizeTree: (basePath: string | null) => Promise<void>;
}

// 模块级缓存：NotesPage 卸载（切换导航）后重新挂载时直接复用上次的对话整理树，
// 侧边栏「对话整理」区块不闪空；app 重启后缓存为空，由 init 全量扫描重新加载。
let memoryChatTree: FileTreeNode[] | null = null;

export function useChatPath(): UseChatPathReturn {
  const [chatPath, setChatPathState] = useState<string | null>(() => {
    return localStorageService.getString(STORAGE_KEYS.NOTES_CHAT_PATH) || null;
  });
  const [chatOrganizeTree, setChatOrganizeTree] = useState<FileTreeNode[]>(() => memoryChatTree ?? []);

  // 渲染后同步模块缓存（卸载不清理：供下次挂载即时恢复用）
  useEffect(() => {
    memoryChatTree = chatOrganizeTree;
  }, [chatOrganizeTree]);

  // 挂载时把对话根同步给主进程做越界放行（重启 / 缓存清理后主进程可能丢失该设置）。
  // 对话根只参与门控，与主根、当前固定目录互不影响。
  useEffect(() => {
    void window.electron?.notes?.setChatRootPath?.(chatPath).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 用显式路径取对话整理树：不写主进程的任何 root 设置、不扫描当前固定目录，
  // 因此对话树加载与下方文件列表完全独立，并发扫描也不会互相串树。
  const loadChatOrganizeTree = useCallback(async (basePath: string | null) => {
    if (!basePath || !window.electron?.notes) {
      setChatOrganizeTree([]);
      return;
    }
    try {
      const tree = await window.electron.notes.getFileTreeAsync(basePath);
      const sep = basePath.includes('\\') ? '\\' : '/';
      const organizePath = `${basePath}${sep}${CHAT_ORGANIZE_FOLDER}`;
      const findOrganize = (nodes: FileTreeNode[]): FileTreeNode | null => {
        for (const node of nodes) {
          if (node.path === organizePath) return node;
          if (node.children) {
            const found = findOrganize(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      const organizeNode = findOrganize(tree);
      setChatOrganizeTree(organizeNode ? [organizeNode] : []);
    } catch (err) {
      logError('加载对话整理树失败', 'useChatPath', err as Error);
      setChatOrganizeTree([]);
    }
  }, []);

  const setChatPath = useCallback(async (): Promise<boolean> => {
    if (!window.electron?.notes) return false;
    try {
      const result = await window.electron.notes.selectFolder();
      if (result.canceled || result.filePaths.length === 0) return false;

      const folderPath = result.filePaths[0];
      // 先注册主进程对话根（门控放行），再更新本地状态与对话整理树
      await window.electron.notes.setChatRootPath(folderPath);
      setChatPathState(folderPath);
      localStorageService.setString(STORAGE_KEYS.NOTES_CHAT_PATH, folderPath);
      await loadChatOrganizeTree(folderPath);
      return true;
    } catch {
      return false;
    }
  }, [loadChatOrganizeTree]);

  return {
    chatPath,
    chatOrganizeTree,
    setChatPath,
    loadChatOrganizeTree,
  };
}
