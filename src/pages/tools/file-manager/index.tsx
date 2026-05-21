import React, { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  File,
  Home,
  HardDrive,
  Plus,
  Trash2,
  ArrowLeft,
  Star,
  FolderOpen,
  Search,
  Settings,
  X
} from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';
import Modal from '../../../components/ui/Modal';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ContextMenu, { ContextMenuItem } from '../../../components/ui/ContextMenu';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { logError } from '../../../services/loggerService';

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedTime?: Date;
}

interface FavoriteItem {
  name: string;
  path: string;
  icon: string;
  isSystem: boolean;
}

interface PathConfig {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
}

const FileManagerPage: React.FC = () => {
  const { addToast } = useToastStore();
  const [currentPath, setCurrentPath] = useState<string>('');
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [targetPaths, setTargetPaths] = useState<PathConfig[]>([]);
  const [activeTab, setActiveTab] = useState<'system' | 'user'>('system');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('就绪');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddPathModal, setShowAddPathModal] = useState(false);
  const [newPathName, setNewPathName] = useState('');
  const [newPathValue, setNewPathValue] = useState('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuX, setContextMenuX] = useState(0);
  const [contextMenuY, setContextMenuY] = useState(0);
  const [contextMenuTarget, setContextMenuTarget] = useState<'file' | 'favorite' | 'target' | null>(null);
  const [selectedFileItem, setSelectedFileItem] = useState<FileItem | null>(null);
  const [selectedFavoriteItem, setSelectedFavoriteItem] = useState<FavoriteItem | null>(null);
  const [selectedTargetPath, setSelectedTargetPath] = useState<PathConfig | null>(null);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<FileItem | null>(null);
  const [showDeletePathConfirm, setShowDeletePathConfirm] = useState(false);
  const [deletePathItem, setDeletePathItem] = useState<PathConfig | null>(null);

  const initializeFileManager = useCallback(async () => {
    try {
      await loadSystemFavorites();
      await loadUserFavorites();
      await loadTargetPaths();
      
      const desktopPath = await window.electron?.fileManager.getPath('desktop');
      if (desktopPath) {
        setCurrentPath(desktopPath);
        await loadFiles(desktopPath);
      }
    } catch (error) {
      console.error('初始化文件管理器失败:', error);
      addToast({ type: 'error', message: '初始化文件管理器失败' });
    }
  }, [addToast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    initializeFileManager();
  }, [initializeFileManager]);

  const loadSystemFavorites = useCallback(async () => {
    try {
      const systemPaths = await window.electron?.fileManager.getSystemPaths();
      setFavorites(prev => {
        const filtered = prev.filter(f => !f.isSystem);
        return [...(systemPaths || []), ...filtered];
      });
    } catch (error) {
      console.error('加载系统路径失败:', error);
    }
  }, []);

  const loadUserFavorites = useCallback(async () => {
    try {
      const savedFavorites = await window.electron?.fileManager.getFavorites();
      setFavorites(prev => {
        const system = prev.filter(f => f.isSystem);
        return [...system, ...(savedFavorites || [])];
      });
    } catch (error) {
      logError('加载用户收藏失败', 'FileManager', error as Error);
    }
  }, []);

  const loadTargetPaths = useCallback(async () => {
    try {
      const paths = await window.electron?.fileManager.getTargetPaths();
      setTargetPaths(paths || []);
    } catch (error) {
      console.error('加载目标路径失败:', error);
    }
  }, []);

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    setStatus(`正在加载: ${path}`);
    try {
      const files = await window.electron?.fileManager.listFiles(path);
      setFileList(files || []);
      setStatus(`目录: ${path} - ${files?.length || 0} 个项目`);
    } catch (error) {
      logError('加载文件列表失败', 'FileManager', error as Error);
      addToast({ type: 'error', message: '加载文件列表失败' });
      setStatus('加载失败');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const navigateToPath = useCallback(async (path: string) => {
    setCurrentPath(path);
    await loadFiles(path);
  }, [loadFiles]);

  const goBack = useCallback(async () => {
    if (!currentPath) return;
    const parentPath = await window.electron?.fileManager.getParentPath(currentPath);
    if (parentPath) {
      await navigateToPath(parentPath);
    }
  }, [currentPath, navigateToPath]);

  const openItem = useCallback(async (item: FileItem) => {
    if (item.isDirectory) {
      await navigateToPath(item.path);
    } else {
      try {
        await window.electron?.fileManager.openFile(item.path);
        setStatus(`已打开: ${item.name}`);
        addToast({ type: 'success', message: `已打开: ${item.name}` });
      } catch (error) {
        console.error('打开文件失败:', error);
        addToast({ type: 'error', message: '打开文件失败' });
      }
    }
  }, [addToast, navigateToPath]);

  const addToFavorites = useCallback(async (item: FileItem) => {
    if (!item.isDirectory) {
      addToast({ type: 'warning', message: '仅支持收藏文件夹' });
      return;
    }
    try {
      await window.electron?.fileManager.addFavorite(item.path, item.name);
      await loadUserFavorites();
      addToast({ type: 'success', message: `已添加到常用: ${item.name}` });
      setStatus(`已添加到常用: ${item.name}`);
    } catch (error) {
      console.error('添加收藏失败:', error);
      addToast({ type: 'error', message: '添加收藏失败' });
    }
  }, [addToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeFromFavorites = useCallback(async (path: string) => {
    try {
      await window.electron?.fileManager.removeFavorite(path);
      await loadUserFavorites();
      addToast({ type: 'success', message: '已从常用移除' });
      setStatus('已从常用移除');
    } catch (error) {
      console.error('移除收藏失败:', error);
      addToast({ type: 'error', message: '移除收藏失败' });
    }
  }, [addToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToTargetPaths = useCallback(async (item: FileItem) => {
    if (!item.isDirectory) {
      addToast({ type: 'warning', message: '仅支持设置文件夹为目标路径' });
      return;
    }
    try {
      await window.electron?.fileManager.addTargetPath(item.path, item.name);
      await loadTargetPaths();
      addToast({ type: 'success', message: `已添加到目标路径: ${item.name}` });
      setStatus(`已添加到目标路径: ${item.name}`);
    } catch (error) {
      logError('添加目标路径失败', 'FileManager', error as Error);
      addToast({ type: 'error', message: '添加目标路径失败' });
    }
  }, [addToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteItem = useCallback((item: FileItem) => {
    setDeleteConfirmItem(item);
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmItem) return;
    
    try {
      await window.electron?.fileManager.deleteItem(deleteConfirmItem.path);
      await loadFiles(currentPath);
      addToast({ type: 'success', message: `已删除: ${deleteConfirmItem.name}` });
      setStatus(`已删除: ${deleteConfirmItem.name}`);
    } catch (error) {
      console.error('删除失败:', error);
      addToast({ type: 'error', message: '删除失败' });
    } finally {
      setShowDeleteConfirm(false);
      setDeleteConfirmItem(null);
    }
  }, [deleteConfirmItem, currentPath, addToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyToTarget = useCallback(async (filePaths: string[], targetPath: string, targetName: string) => {
    if (filePaths.length === 0) return;
    
    try {
      setStatus(`正在复制到 ${targetName}...`);
      const successCount = await window.electron?.fileManager.copyFiles(filePaths, targetPath);
      addToast({ type: 'success', message: `复制完成: ${successCount}/${filePaths.length} 个文件` });
      setStatus(`复制完成: ${successCount}/${filePaths.length} 个文件成功复制到 ${targetName}`);
    } catch (error) {
      console.error('复制失败:', error);
      addToast({ type: 'error', message: '复制失败' });
      setStatus('复制失败');
    }
  }, [addToast]);

  const handleAddTargetPath = async () => {
    if (!newPathName || !newPathValue) {
      addToast({ type: 'warning', message: '请填写完整信息' });
      return;
    }
    
    try {
      await window.electron?.fileManager.addTargetPath(newPathValue, newPathName);
      await loadTargetPaths();
      setShowAddPathModal(false);
      setNewPathName('');
      setNewPathValue('');
      addToast({ type: 'success', message: '已添加目标路径' });
    } catch (error) {
      logError('添加目标路径失败', 'FileManager', error as Error);
      addToast({ type: 'error', message: '添加目标路径失败' });
    }
  };

  const deleteTargetPath = useCallback((pathId: string) => {
    const pathConfig = targetPaths.find(p => p.id === pathId);
    if (!pathConfig) return;
    setDeletePathItem(pathConfig);
    setShowDeletePathConfirm(true);
  }, [targetPaths]);

  const handleConfirmDeletePath = useCallback(async () => {
    if (!deletePathItem) return;
    
    try {
      await window.electron?.fileManager.removeTargetPath(deletePathItem.id);
      await loadTargetPaths();
      addToast({ type: 'success', message: '已删除目标路径' });
      setStatus(`已删除路径: ${deletePathItem.name}`);
    } catch (error) {
      console.error('删除目标路径失败:', error);
      addToast({ type: 'error', message: '删除目标路径失败' });
    } finally {
      setShowDeletePathConfirm(false);
      setDeletePathItem(null);
    }
  }, [deletePathItem, addToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTargetPath = useCallback(async (path: string) => {
    try {
      await window.electron?.fileManager.openFile(path);
      const pathConfig = targetPaths.find(p => p.path === path);
      if (pathConfig) {
        setStatus(`已打开路径: ${pathConfig.name}`);
        addToast({ type: 'success', message: `已打开: ${pathConfig.name}` });
      }
    } catch (error) {
      logError('打开路径失败', 'FileManager', error as Error);
      addToast({ type: 'error', message: '打开路径失败' });
    }
  }, [targetPaths, addToast]);

  const handleFileContextMenu = useCallback((e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    setContextMenuX(e.clientX);
    setContextMenuY(e.clientY);
    setContextMenuTarget('file');
    setSelectedFileItem(item);
    setSelectedFavoriteItem(null);
    setSelectedTargetPath(null);
    setContextMenuOpen(true);
  }, []);

  const handleFavoriteContextMenu = useCallback((e: React.MouseEvent, item: FavoriteItem) => {
    if (item.isSystem) return;
    e.preventDefault();
    setContextMenuX(e.clientX);
    setContextMenuY(e.clientY);
    setContextMenuTarget('favorite');
    setSelectedFavoriteItem(item);
    setSelectedFileItem(null);
    setSelectedTargetPath(null);
    setContextMenuOpen(true);
  }, []);

  const handleTargetContextMenu = useCallback((e: React.MouseEvent, path: PathConfig) => {
    e.preventDefault();
    setContextMenuX(e.clientX);
    setContextMenuY(e.clientY);
    setContextMenuTarget('target');
    setSelectedTargetPath(path);
    setSelectedFileItem(null);
    setSelectedFavoriteItem(null);
    setContextMenuOpen(true);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, item: FileItem) => {
    e.dataTransfer.setData('text/plain', item.path);
    e.dataTransfer.setData('text/uri-list', `file://${item.path}`);
    setDraggedItem(item.path);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
  }, []);

  const handleDropOnTarget = useCallback(async (e: React.DragEvent, targetPath: string, targetName: string) => {
    e.preventDefault();
    const filePath = e.dataTransfer.getData('text/plain');
    if (filePath) {
      await copyToTarget([filePath], targetPath, targetName);
    }
  }, [copyToTarget]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const filteredFiles = fileList.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedFavorites = activeTab === 'system'
    ? favorites.filter(f => f.isSystem)
    : favorites.filter(f => !f.isSystem);

  const getFileContextMenuItems = (): ContextMenuItem[] => {
    if (!selectedFileItem) return [];
    
    const items: ContextMenuItem[] = [];
    
    items.push({
      id: 'open',
      label: selectedFileItem.isDirectory ? '打开文件夹' : '打开文件',
      icon: selectedFileItem.isDirectory ? <FolderOpen className="w-4 h-4" /> : <File className="w-4 h-4" />,
      onClick: () => selectedFileItem && openItem(selectedFileItem),
    });
    
    if (selectedFileItem.isDirectory) {
      items.push({
        id: 'add-favorite',
        label: '添加到常用',
        icon: <Star className="w-4 h-4" />,
        onClick: () => selectedFileItem && addToFavorites(selectedFileItem),
      });
      items.push({
        id: 'add-target',
        label: '设为目标路径',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => selectedFileItem && addToTargetPaths(selectedFileItem),
      });
    }
    
    items.push({ id: 'divider', divider: true });
    
    items.push({
      id: 'delete',
      label: '删除',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => selectedFileItem && deleteItem(selectedFileItem),
      className: 'text-error',
    });
    
    return items;
  };

  const getFavoriteContextMenuItems = (): ContextMenuItem[] => {
    if (!selectedFavoriteItem) return [];
    
    return [
      {
        id: 'open',
        label: '打开',
        icon: <FolderOpen className="w-4 h-4" />,
        onClick: () => selectedFavoriteItem && navigateToPath(selectedFavoriteItem.path),
      },
      { id: 'divider', divider: true },
      {
        id: 'remove',
        label: '移除',
        icon: <X className="w-4 h-4" />,
        onClick: () => selectedFavoriteItem && removeFromFavorites(selectedFavoriteItem.path),
        className: 'text-error',
      },
    ];
  };

  const getTargetContextMenuItems = (): ContextMenuItem[] => {
    if (!selectedTargetPath) return [];
    
    return [
      {
        id: 'open',
        label: '打开路径',
        icon: <FolderOpen className="w-4 h-4" />,
        onClick: () => selectedTargetPath && openTargetPath(selectedTargetPath.path),
      },
      { id: 'divider', divider: true },
      {
        id: 'delete',
        label: '删除路径',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => selectedTargetPath && deleteTargetPath(selectedTargetPath.id),
        className: 'text-error',
      },
    ];
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    switch (contextMenuTarget) {
      case 'file':
        return getFileContextMenuItems();
      case 'favorite':
        return getFavoriteContextMenuItems();
      case 'target':
        return getTargetContextMenuItems();
      default:
        return [];
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={goBack}
                disabled={!currentPath}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="返回上级"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg">
                <FolderOpen className="w-4 h-4" />
                <span className="truncate max-w-md">{currentPath || '选择目录'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="搜索文件..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-primary w-64 text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-900">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
                <button
                  onClick={() => setActiveTab('system')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeTab === 'system'
                      ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  系统
                </button>
                <button
                  onClick={() => setActiveTab('user')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeTab === 'user'
                      ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  常用
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {displayedFavorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                  <Folder className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-sm">暂无{activeTab === 'system' ? '系统路径' : '常用路径'}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {displayedFavorites.map((item, index) => (
                    <div key={index}>
                      <button
                        onClick={() => navigateToPath(item.path)}
                        onContextMenu={(e) => handleFavoriteContextMenu(e, item)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-left group"
                      >
                        {item.icon === 'desktop' && <Home className="w-5 h-5 text-primary flex-shrink-0" />}
                        {item.icon === 'drive' && <HardDrive className="w-5 h-5 text-primary flex-shrink-0" />}
                        {!item.icon && <Folder className="w-5 h-5 text-text-secondary flex-shrink-0" />}
                        <span className="flex-1 truncate text-text-primary">{item.name}</span>
                        {!item.isSystem && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromFavorites(item.path);
                            }}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-error/10 rounded transition-all"
                            title="移除"
                          >
                            <Trash2 className="w-4 h-4 text-text-tertiary hover:text-error" />
                          </button>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-tertiary uppercase tracking-widest">
                    文件列表
                  </span>
                  <span className="text-xs text-text-tertiary">
                    ({filteredFiles.length} 个项目)
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
                  <LoadingSpinner size="md" />
                  <p className="mt-3 text-sm">加载中...</p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
                  <Folder className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-base">文件夹为空</p>
                  {searchQuery && (
                    <p className="text-sm mt-1">未找到匹配 "{searchQuery}" 的文件</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-3">
                  {filteredFiles.map((item, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg cursor-pointer border border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all group ${
                        draggedItem === item.path ? 'opacity-50' : ''
                      }`}
                      onClick={() => openItem(item)}
                      onDoubleClick={() => openItem(item)}
                      onContextMenu={(e) => handleFileContextMenu(e, item)}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      title={item.isDirectory ? '点击打开文件夹，拖拽到目标路径可复制' : '点击打开文件'}
                    >
                      <div className="flex items-center justify-center mb-2">
                        {item.isDirectory ? (
                          <div className="w-12 h-12 flex items-center justify-center bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                            <Folder className="w-6 h-6 text-primary" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <File className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-center text-text-primary truncate mb-1">
                        {item.name}
                      </div>
                      <div className="text-xs text-center text-text-tertiary">
                        {item.isDirectory ? '文件夹' : formatSize(item.size)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="w-80 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-900">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs font-bold text-text-tertiary uppercase tracking-widest">
                目标路径
              </span>
              <button
                onClick={() => setShowAddPathModal(true)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="添加路径"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {targetPaths.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
                  <Settings className="w-14 h-14 mb-4 opacity-30" />
                  <p className="text-sm">暂无目标路径</p>
                  <button
                    onClick={() => setShowAddPathModal(true)}
                    className="mt-3 text-sm text-primary hover:underline"
                  >
                    添加第一个路径
                  </button>
                  <p className="text-xs mt-2 opacity-75">拖拽文件到路径卡片即可复制</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {targetPaths.map((path) => (
                    <div
                      key={path.id}
                      className={`p-3 bg-white dark:bg-gray-800 border rounded-lg transition-all cursor-pointer ${
                        draggedItem ? 'border-primary/50 hover:border-primary' : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                      }`}
                      onClick={() => openTargetPath(path.path)}
                      onContextMenu={(e) => handleTargetContextMenu(e, path)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add('border-primary');
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove('border-primary');
                      }}
                      onDrop={(e) => {
                        e.currentTarget.classList.remove('border-primary');
                        handleDropOnTarget(e, path.path, path.name);
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Folder className="w-5 h-5 text-primary" />
                          <span className="font-medium text-text-primary">{path.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openTargetPath(path.path);
                            }}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                            title="打开路径"
                          >
                            <FolderOpen className="w-4 h-4 text-text-tertiary hover:text-text-primary" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTargetPath(path.id);
                            }}
                            className="p-1.5 hover:bg-error/10 rounded"
                            title="删除路径"
                          >
                            <Trash2 className="w-4 h-4 text-text-tertiary hover:text-error" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-text-tertiary truncate">{path.path}</p>
                      <p className="text-xs text-text-tertiary mt-2 opacity-60 bg-bg-tertiary px-2 py-1 rounded">
                        ↓ 拖拽文件到此处复制
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-text-tertiary">{status}</span>
          <span className="text-xs text-text-tertiary opacity-75">
            提示: 双击打开文件，右键可进行更多操作
          </span>
        </div>
      </div>

      <ContextMenu
        isOpen={contextMenuOpen}
        x={contextMenuX}
        y={contextMenuY}
        items={getContextMenuItems()}
        onClose={() => {
          setContextMenuOpen(false);
          setSelectedFileItem(null);
          setSelectedFavoriteItem(null);
          setSelectedTargetPath(null);
        }}
      />

      <Modal
        title="添加目标路径"
        isOpen={showAddPathModal}
        onClose={() => setShowAddPathModal(false)}
        onConfirm={handleAddTargetPath}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              路径名称
            </label>
            <input
              type="text"
              value={newPathName}
              onChange={(e) => setNewPathName(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-primary text-gray-800 dark:text-gray-200"
              placeholder="例如：下载文件夹"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              路径地址
            </label>
            <input
              type="text"
              value={newPathValue}
              onChange={(e) => setNewPathValue(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-primary text-gray-800 dark:text-gray-200 font-mono text-sm"
              placeholder="C:\Users\...\Downloads"
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded">
            💡 提示: 目标路径用于快速复制文件，拖拽文件到右侧路径卡片即可完成复制
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteConfirmItem(null);
        }}
        onConfirm={handleConfirmDelete}
        title="确认删除"
        message="确定要删除此项目吗？此操作不可撤销。"
        deleteItemName={deleteConfirmItem?.name}
        confirmText="删除"
        cancelText="取消"
      />

      <ConfirmDialog
        isOpen={showDeletePathConfirm}
        onClose={() => {
          setShowDeletePathConfirm(false);
          setDeletePathItem(null);
        }}
        onConfirm={handleConfirmDeletePath}
        title="确认删除路径"
        message="确定要删除此目标路径吗？"
        deleteItemName={deletePathItem?.name}
        confirmText="删除"
        cancelText="取消"
      />
    </div>
  );
};

export default FileManagerPage;
