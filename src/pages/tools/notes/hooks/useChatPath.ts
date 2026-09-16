// 对话路径 + 对话整理树；loadChatOrganizeTree 由 useNotesTree 通过依赖注入调用

import { useState, useCallback } from 'react';
import localStorageService, { STORAGE_KEYS } from '../../../../services/localStorageService';
import { CHAT_ORGANIZE_FOLDER } from '../constants/paths';
import type { FileTreeNode } from '../types';

export interface UseChatPathReturn {
  chatPath: string | null;
  chatOrganizeTree: FileTreeNode[];
  setChatPath: () => Promise<boolean>;
  loadChatOrganizeTree: (basePath: string | null) => Promise<void>;
}

export function useChatPath(): UseChatPathReturn {
  const [chatPath, setChatPathState] = useState<string | null>(() => {
    return localStorageService.getString(STORAGE_KEYS.NOTES_CHAT_PATH) || null;
  });
  const [chatOrganizeTree, setChatOrganizeTree] = useState<FileTreeNode[]>([]);

  const loadChatOrganizeTree = useCallback(async (basePath: string | null) => {
    if (!basePath || !window.electron) {
      setChatOrganizeTree([]);
      return;
    }
    try {
      await window.electron.notes.setRootPath(basePath);
      await window.electron.notes.scanFolder(basePath);
      const tree = await window.electron.notes.getFileTree();
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
    } catch {
      setChatOrganizeTree([]);
    }
  }, []);

  const setChatPath = useCallback(async (): Promise<boolean> => {
    if (!window.electron) return false;
    try {
      const result = await window.electron.notes.selectFolder();
      if (result.canceled || result.filePaths.length === 0) return false;

      const folderPath = result.filePaths[0];
      setChatPathState(folderPath);
      localStorageService.setString(STORAGE_KEYS.NOTES_CHAT_PATH, folderPath);
      loadChatOrganizeTree(folderPath);
      return true;
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    chatPath,
    chatOrganizeTree,
    setChatPath,
    loadChatOrganizeTree,
  };
}