// useNotesTree —— 文件树/根目录/加载/错误；跨 hook 依赖由参数注入，避免循环依赖。

import { useState, useCallback, useEffect, useRef } from 'react';
import { logError } from '../../../../services/loggerService';
import type { FileTreeNode, PinnedFolder } from '../types';

export interface UseNotesTreeDeps {
  currentViewPath: string | null;
  setCurrentViewPath: (path: string | null) => void;
  pinnedFolders: PinnedFolder[];
  chatPath: string | null;
  loadChatOrganizeTree: (basePath: string | null) => Promise<void>;
}

export interface UseNotesTreeReturn {
  hasRootPath: boolean;
  rootPath: string | null;
  fileTree: FileTreeNode[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  selectRootFolder: () => Promise<boolean>;
  setRootPath: (path: string) => Promise<void>;
  refreshFileTree: () => Promise<void>;
  toggleFolderExpand: (folderPath: string) => void;
  switchToFolder: (folderPath: string) => Promise<void>;
  rebuildIndex: () => Promise<void>;
  clearError: () => void;
  scanFolderAsync: (rootPath: string) => Promise<{ success: boolean; fileCount: number; folderCount: number; tree: FileTreeNode[]; error?: string }>;
  getFileTreeAsync: (rootPath: string) => Promise<FileTreeNode[]>;
  init: () => Promise<void>;
  findFileInTree: (filePath: string, nodes: FileTreeNode[]) => FileTreeNode | null;
  getParentFolders: (filePath: string, rootPath: string) => string[];
  expandTree: (nodes: FileTreeNode[]) => FileTreeNode[];
  setHasRootPath: (v: boolean) => void;
  setRootPathState: (v: string | null) => void;
  setFileTree: (v: FileTreeNode[]) => void;
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}

let memoryTree: FileTreeNode[] | null = null;
let memoryRoot: string | null = null;
let memoryExpanded: Set<string> | null = null;
let memoryView: string | null = null;

export function useNotesTree(deps: UseNotesTreeDeps): UseNotesTreeReturn {
  const [hasRootPath, setHasRootPath] = useState(false);
  const [rootPath, setRootPathState] = useState<string | null>(() => memoryRoot);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>(() => memoryTree ?? []);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(memoryExpanded ?? []));
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    memoryTree = fileTree;
    memoryRoot = rootPath;
    memoryExpanded = expandedFolders;
    memoryView = deps.currentViewPath;
  }, [fileTree, rootPath, expandedFolders, deps.currentViewPath]);

  const currentViewPathRef = useRef<string | null>(null);
  currentViewPathRef.current = deps.currentViewPath;

  // 当前 fileTree 所对应的视图（null = 无视图，列表为空）。树与视图是两份独立状态，靠它
  // 识别"视图已变、树没跟上"（如固定目录被移除后视图回落主根），由 viewSync 兜底重载。
  const treeViewRef = useRef<string | null>(null);

  // 对话根实时值：扫描回调内取最新对话路径，避免把它放进 useCallback 依赖导致回调重建
  const chatPathRef = useRef<string | null>(null);
  chatPathRef.current = deps.chatPath;

  // 按扫描目标分别记录代号：同一路径的新扫描作废旧扫描（快速连切 / 并发刷新），
  // 但扫描别的路径不会作废旧路径的在途扫描——否则"旧视图的迟到扫描"会把当前视图
  // 的在途扫描连带作废，两条响应都不落地，文件列表会永久停在旧目录。
  const scanGenRef = useRef<Map<string, number>>(new Map());
  const beginScan = useCallback((targetPath: string): number => {
    const gen = (scanGenRef.current.get(targetPath) ?? 0) + 1;
    scanGenRef.current.set(targetPath, gen);
    return gen;
  }, []);

  // 扫描落地前的时效性判定：同目标已有更新的扫描，或目标已不是"当前视图实际应显示
  // 的目录"（扫描启动时合法——如 ensureOrganizeFolder 带着旧 view 触发的刷新——但 IPC
  // 返回前用户已切换目录 / 移除最后一个固定目录）都必须丢弃，否则旧目录的树最后落地，
  // 下方文件列表就会残留已退出目录的内容。
  const isScanStale = useCallback((gen: number, targetPath: string) => {
    if (gen !== (scanGenRef.current.get(targetPath) ?? 0)) return true;
    // 文件列表只显示固定目录内容，扫描目标必须仍是当前固定目录
    return targetPath !== currentViewPathRef.current;
  }, []);

  // 统一处理过期扫描：仅把主进程视图根门控重新同步到当前视图（旧扫描可能把它留在
  // 已退出的固定目录），绝不改动 treeViewRef——对齐标记只能由"为当前目标发起扫描"或
  // "树成功落地"推进。若这里谎报对齐（标记=当前视图但没有树交付），viewSync 会误判
  // 列表已跟上而跳过补扫，在"初始化未完成时移除最后一个固定目录"等时序下列表永久残留。
  // 返回 true 表示调用方应立即放弃落地。
  const discardStaleScan = useCallback(
    (gen: number, targetPath: string): boolean => {
      if (!isScanStale(gen, targetPath)) return false;
      void window.electron?.notes?.setViewPath?.(currentViewPathRef.current).catch(() => undefined);
      return true;
    },
    [isScanStale]
  );

  const findFileInTreeRef = useRef<((filePath: string, nodes: FileTreeNode[]) => FileTreeNode | null) | null>(null);
  findFileInTreeRef.current = (filePath: string, nodes: FileTreeNode[]): FileTreeNode | null => {
    for (const node of nodes) {
      if (node.path === filePath && node.type === 'file') {
        return node;
      }
      if (node.children) {
        const found = findFileInTreeRef.current!(filePath, node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const findFileInTree = useCallback(
    (filePath: string, nodes: FileTreeNode[]): FileTreeNode | null => {
      return findFileInTreeRef.current!(filePath, nodes);
    },
    []
  );

  const getParentFolders = useCallback(
    (filePath: string, rootPath: string): string[] => {
      const parents: string[] = [];
      let currentPath = filePath;

      while (currentPath !== rootPath) {
        const lastSep = Math.max(currentPath.lastIndexOf('/'), currentPath.lastIndexOf('\\'));
        if (lastSep === -1) break;

        currentPath = currentPath.substring(0, lastSep);
        if (currentPath && currentPath !== rootPath) {
          parents.push(currentPath);
        }
      }

      return parents;
    },
    []
  );

  const updateTreeExpandStateRef = useRef<((nodes: FileTreeNode[]) => FileTreeNode[]) | null>(null);
  updateTreeExpandStateRef.current = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes.map((node) => ({
      ...node,
      expanded: expandedFolders.has(node.path),
      children: node.children ? updateTreeExpandStateRef.current!(node.children) : undefined,
    }));
  };

  const expandTree = useCallback(
    (nodes: FileTreeNode[]): FileTreeNode[] => {
      return updateTreeExpandStateRef.current!(nodes);
    },
    []
  );

  // 加载文件列表与对话整理树；首次初始化与缓存命中后的后台刷新共用。
  // 文件列表只显示固定目录内容：viewPath 为空（无视图）时列表清空，绝不扫描对话路径本身。
  // 对话整理树只要 chatBasePath 存在就加载（与切换目录 / 手动刷新入口的行为一致），
  // 否则侧边栏「对话整理」区块不会显示。
  const fullScan = useCallback(
    async (root: string, viewPath: string | null) => {
      const notes = window.electron?.notes;
      if (!notes) return;
      await notes.setViewPath(viewPath);
      if (!viewPath) {
        setFileTree([]);
        treeViewRef.current = null;
      } else {
        const seq = beginScan(viewPath);
        const result = await notes.scanFolderAsync(viewPath);
        // 期间已有更新的扫描，或视图已不是本次扫描目标（切换目录、移除固定目录）→ 丢弃陈旧结果
        if (discardStaleScan(seq, viewPath)) return;
        setFileTree(result.success && result.tree ? result.tree : []);
        treeViewRef.current = viewPath;
      }

      const chatBasePath = chatPathRef.current || root;
      if (chatBasePath) {
        await deps.loadChatOrganizeTree(chatBasePath);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beginScan, discardStaleScan, deps.loadChatOrganizeTree]
  );

  // 初始加载；「还原上次打开文件」由组合根在 initialized=true 后处理。
  // 切换导航后返回（模块缓存命中同一 root 与视图）时跳过同步扫描：直接复用上次
  // 的树，选中 / 展开状态毫秒级恢复，再后台全量刷新纠偏；重启（缓存为空）按持久
  // 化的视图路径恢复固定目录视图或走主根完整扫描。
  const init = useCallback(async () => {
    if (initialized) return;
    if (!window.electron?.notes) return;

    // 内部主根取对话路径：已无独立的主根选择流程，rootPath 仅作为 watcher 监听范围、
    // 删除后的回退基准与操作的默认落点。无对话路径时保持未初始化，等用户选定后由下方
    // effect 依赖变化重新触发本函数。
    const root = chatPathRef.current;
    if (!root) return;

    try {
      // 文件列表不扫描主根，主根设置只用于内部兼容（见下方 sync effect 同步到主进程）
      setHasRootPath(true);
      setRootPathState(root);

      // 视图恢复条件：路径非主根且仍是当前固定目录成员。固定目录被全部移除 / 取消固定后，
      // 持久化的视图路径即使磁盘仍存在也不得恢复——否则 init 按该目录取树后，组合根的
      // 成员校验又把视图重置为无视图，viewSync 补扫与 init 后台刷新并发交错，文件列表会
      // 卡在已取消固定的目录。
      // init 闭包取首次渲染值，pinnedFolders 在挂载时即从 localStorage 同步初始化。
      let viewPath =
        deps.currentViewPath &&
        deps.currentViewPath !== root &&
        deps.pinnedFolders.some((p) => p.path === deps.currentViewPath)
          ? deps.currentViewPath
          : null;
      if (viewPath) {
        // 视图目录已被删除 / 失权（含历史会话残留的持久化记录）时回落无视图，
        // 并清掉 state 与持久化键，避免「失效目录」的视图反复被恢复
        const validation = await window.electron.notes
          .validateFolder(viewPath)
          .catch(() => null);
        if (!validation?.valid) {
          viewPath = null;
          deps.setCurrentViewPath(null);
        }
      }
      // 视图根 / 对话根同步给主进程门控（与主根相互独立），保证读取固定目录内文件、
      // 对话目录内文件都不会因越界被拒
      await window.electron.notes.setViewPath(viewPath);
      await window.electron.notes.setChatRootPath(chatPathRef.current);

      if (memoryTree && memoryRoot === root && memoryView === viewPath) {
        setFileTree(memoryTree);
        treeViewRef.current = viewPath;
        setInitialized(true);
        void fullScan(root, viewPath).catch(() => {
          /* 后台刷新失败保留缓存树，由下次刷新 / 手动刷新自愈 */
        });
        return;
      }
      await fullScan(root, viewPath);
    } catch {
      setError('初始化笔记模块失败');
    }
    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, fullScan]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps.chatPath]);

  // 对话路径变更 → 同步主根到状态与主进程门控。文件列表只显示固定目录，故此处不触发扫描。
  useEffect(() => {
    const chat = chatPathRef.current;
    if (!chat || chat === rootPath) return;
    setRootPathState(chat);
    setHasRootPath(true);
    void window.electron?.notes?.setRootPath?.(chat).catch(() => undefined);
  }, [deps.chatPath, rootPath]);

  const selectRootFolder = useCallback(async (): Promise<boolean> => {
    if (!window.electron?.notes) return false;

    try {
      setLoading(true);
      setError(null);

      const result = await window.electron.notes.selectFolder();
      if (result.canceled || result.filePaths.length === 0) {
        setLoading(false);
        return false;
      }

      const selectedPath = result.filePaths[0];
      const validation = await window.electron.notes.validateFolder(selectedPath);
      if (!validation.valid) {
        setError(validation.error || '文件夹验证失败');
        setLoading(false);
        return false;
      }

      const { default: localStorageService, STORAGE_KEYS } = await import(
        '../../../../services/localStorageService'
      );
      await window.electron.notes.setRootPath(selectedPath);
      localStorageService.setString(STORAGE_KEYS.NOTES_ROOT_PATH, selectedPath);
      setRootPathState(selectedPath);
      setHasRootPath(true);

      const scanResult = await window.electron.notes.scanFolder(selectedPath);
      if (!scanResult.success) {
        setError(scanResult.error || '扫描文件夹失败');
        setLoading(false);
        return false;
      }

      // 显式路径取树，不依赖主进程隐式主根
      const tree = await window.electron.notes.getFileTreeAsync(selectedPath);
      setFileTree(tree);
      treeViewRef.current = null;
      setLoading(false);
      return true;
    } catch {
      setError('选择根目录失败');
      setLoading(false);
      return false;
    }
  }, []);

  const setRootPath = useCallback(async (path: string) => {
    if (!window.electron?.notes) return;
    const seq = beginScan(path);
    await window.electron.notes.setRootPath(path);
    setRootPathState(path);
    setHasRootPath(true);

    await window.electron.notes.scanFolder(path);
    const tree = await window.electron.notes.getFileTreeAsync(path);
    // 主根变更是显式动作：仅同目标的更新扫描能作废它，不做"当前视图"时效性校验
    if (seq !== (scanGenRef.current.get(path) ?? 0)) return;
    setFileTree(tree);
    treeViewRef.current = null;
  }, [beginScan]);

  const refreshFileTree = useCallback(async () => {
    const notes = window.electron?.notes;
    if (!notes) return;
    // 文件列表只显示固定目录内容：无视图时清空列表（刷新仍要跑，以便重建对话整理树）
    treeViewRef.current = currentViewPathRef.current;

    try {
      setLoading(true);
      setError(null);

      // 视图根仅同步给门控（固定目录内增删改不被越界拒绝）；主根保持不变
      await notes.setViewPath(currentViewPathRef.current);
      let tree: FileTreeNode[] = [];
      const viewPath = currentViewPathRef.current;
      if (viewPath) {
        const seq = beginScan(viewPath);
        const result = await notes.scanFolderAsync(viewPath);
        // 过期响应（切换目录 / 移除固定目录后又有新扫描，或本次扫描目标已不是当前视图）
        // 直接丢弃，避免旧目录列表最后落地造成残留；对齐标记保持不动，viewSync 会检测到
        // 「树没跟上视图」并由当前视图的扫描补位（见 discardStaleScan 的说明）
        if (discardStaleScan(seq, viewPath)) {
          setLoading(false);
          return;
        }
        tree = result.success && result.tree ? result.tree : [];
      }
      setFileTree(tree);

      // 对话整理树按显式对话根加载，与当前视图 / 主根完全独立
      const chatBasePath = chatPathRef.current || rootPath;
      if (chatBasePath) {
        await deps.loadChatOrganizeTree(chatBasePath);
      }

      setLoading(false);
    } catch (err) {
      logError('刷新文件树失败', 'useNotes', err as Error);
      setError('刷新文件树失败');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath, beginScan, discardStaleScan, deps.loadChatOrganizeTree]);

  // 视图与文件列表对齐：固定目录被移除、目录被删除 / 重命名后视图回落主根时，只有
  // 视图变了而树还停在旧目录，下方列表会一直显示已失效目录的内容。凡已由
  // switchToFolder / fullScan / refreshFileTree 取过树的入口都已对齐标记，此处不重复加载。
  useEffect(() => {
    const view = deps.currentViewPath && deps.currentViewPath !== rootPath ? deps.currentViewPath : null;
    if (!initialized || treeViewRef.current === view) return;
    void refreshFileTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, deps.currentViewPath, rootPath]);

  const toggleFolderExpand = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const switchToFolder = useCallback(
    async (folderPath: string) => {
      const notes = window.electron?.notes;
      if (!notes) return;
      // 切到主根目录即「无视图」：全链路约定 null = 主根视图（侧边栏高亮同理）
      const view = folderPath === rootPath ? null : folderPath;
      deps.setCurrentViewPath(view);
      // 乐观对齐：本次就会按 folderPath 取树，viewSync 无需再补一次
      treeViewRef.current = view;
      const seq = beginScan(folderPath);

      try {
        setLoading(true);
        // 只把视图根同步给门控；主进程主根保持为主根目录，二者互不覆盖
        await notes.setViewPath(view);
        let tree: FileTreeNode[] = [];
        if (view) {
          tree = await notes.getFileTreeAsync(folderPath);
          // 切换途中又产生了更新的扫描（快速连切 / 移除固定目录），或视图已再次变化
          // → 让最新的当前视图扫描负责结果，本次旧目录树丢弃
          if (discardStaleScan(seq, folderPath)) {
            setLoading(false);
            return;
          }
        }
        // 切回主根视图（view 为空）时用空树清空列表：文件列表不显示主根内容
        setFileTree(tree);

        const chatBasePath = chatPathRef.current || rootPath;
        if (chatBasePath) {
          await deps.loadChatOrganizeTree(chatBasePath);
        }

        setExpandedFolders(new Set());
        setLoading(false);
      } catch (err) {
        logError('切换目录失败', 'useNotes', err as Error);
        setError('切换目录失败');
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rootPath, beginScan, discardStaleScan, deps.loadChatOrganizeTree, deps.setCurrentViewPath]
  );

  const rebuildIndex = useCallback(async () => {
    if (!rootPath || !window.electron) return;
    try {
      setLoading(true);
      await window.electron.notes.indexAll(rootPath);
    } catch (err) {
      logError('重建索引失败', 'useNotes', err as Error);
      setError('重建索引失败');
    } finally {
      setLoading(false);
    }
  }, [rootPath]);

  // 异步扫描并直接返回 tree，调用方可 setFileTree(...) 替换。
  const scanFolderAsync = useCallback(
    async (scanPath: string) => {
      if (!window.electron?.notes || !scanPath) {
        return { success: false, fileCount: 0, folderCount: 0, tree: [] as FileTreeNode[] };
      }
      try {
        const result = await window.electron.notes.scanFolderAsync(scanPath);
        return {
          success: !!result.success,
          fileCount: result.fileCount ?? 0,
          folderCount: result.folderCount ?? 0,
          tree: (result.tree ?? []) as FileTreeNode[],
        };
      } catch (err) {
        logError('异步扫描失败', 'useNotes', err as Error);
        return { success: false, fileCount: 0, folderCount: 0, tree: [] as FileTreeNode[] };
      }
    },
    []
  );

  // 异步 build tree（不写 last_scan_at，仅返回结构）。
  const getFileTreeAsync = useCallback(
    async (scanPath: string): Promise<FileTreeNode[]> => {
      if (!window.electron?.notes || !scanPath) {
        return [];
      }
      try {
        const tree = await window.electron.notes.getFileTreeAsync(scanPath);
        return (tree ?? []) as FileTreeNode[];
      } catch (err) {
        logError('异步 build tree 失败', 'useNotes', err as Error);
        return [];
      }
    },
    []
  );

  return {
    hasRootPath,
    rootPath,
    fileTree,
    loading,
    error,
    initialized,
    selectRootFolder,
    setRootPath,
    refreshFileTree,
    toggleFolderExpand,
    switchToFolder,
    rebuildIndex,
    clearError,
    scanFolderAsync,
    getFileTreeAsync,
    init,
    findFileInTree,
    getParentFolders,
    expandTree,
    setHasRootPath,
    setRootPathState,
    setFileTree,
    setExpandedFolders,
    setLoading,
    setError,
  };
}