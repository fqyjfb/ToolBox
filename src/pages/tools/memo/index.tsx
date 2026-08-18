import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCallbackRef } from '../../../hooks/useCallbackRef';
import { useNavigate } from 'react-router-dom';
import { StickyNote, Plus, Trash2, Edit, Tag, AlertCircle, Copy } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndSensors } from '../../../hooks/useDndSensors';
import { memoService } from '../../../services/MemoService';
import { openUrl } from '../../../services/browserService';
import { MemoCategory, Memo } from '../../../types/memo';
import { useAuthStore } from '../../../store/AuthStore';
import { useToastStore } from '../../../store/toastStore';
import { useNavSearch } from '../../../contexts/NavSearchContext';
import { logError, logInfo } from '../../../services/loggerService';

const consoleLog = (message: string, data?: unknown) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[MemoPage] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
};

import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ContextMenu, { ContextMenuItem } from '../../../components/ui/ContextMenu';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import Select from '../../../components/ui/Select';
import { modalControlClass } from '../account/shared';

const LinkWithCopy: React.FC<{ url: string; onCopy: (url: string) => void }> = ({ url, onCopy }) => {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCopy(url);
        }}
        className="p-0.5 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        title="复制链接"
      >
        <Copy size={10} className="text-gray-600 dark:text-gray-400" />
      </button>
      <button
        onClick={() => openUrl(url)}
        className="text-blue-600 dark:text-blue-400 hover:underline text-xs bg-transparent border-none p-0 cursor-pointer"
      >
        {url}
      </button>
    </span>
  );
};

const getPriorityStyle = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    case 'medium':
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
    case 'low':
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  }
};

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'high':
      return '高';
    case 'medium':
      return '中';
    case 'low':
    default:
      return '低';
  }
};

const SortableCategoryButton: React.FC<{
  category: MemoCategory;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = ({ category, isSelected, onClick, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
    scale: isDragging ? 1.05 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={`w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left flex items-center gap-2 ${
          isSelected
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        style={{ borderLeft: `3px solid ${category.color}` }}
      >
        <Tag size={14} />
        {category.name}
      </button>
    </div>
  );
};

const MemoPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const addToast = useToastStore((state) => state.addToast);
  const { searchQuery, isSearchActive } = useNavSearch();
  const [categories, setCategories] = useState<MemoCategory[]>([]);

  const sensors = useDndSensors();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newMemoTitle, setNewMemoTitle] = useState<string>('');
  const [newMemoContent, setNewMemoContent] = useState<string>('');
  const [newMemoCategoryId, setNewMemoCategoryId] = useState<string | null>(null);
  const [newMemoPriority, setNewMemoPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryColor, setNewCategoryColor] = useState<string>('#275D7E');
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [editingMemoCategoryId, setEditingMemoCategoryId] = useState<string | null>(null);
  const [editingMemoPriority, setEditingMemoPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [editingCategory, setEditingCategory] = useState<MemoCategory | null>(null);
  const [showAddMemoModal, setShowAddMemoModal] = useState<boolean>(false);
  const [showEditMemoModal, setShowEditMemoModal] = useState<boolean>(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewMemo, setPreviewMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastMemoRef = useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState<number>(4);

  useEffect(() => {
    const updateColumnCount = () => {
      const width = window.innerWidth;
      if (width >= 1280) {
        setColumnCount(4);
      } else if (width >= 1024) {
        setColumnCount(3);
      } else if (width >= 640) {
        setColumnCount(2);
      } else {
        setColumnCount(1);
      }
    };

    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, []);
  
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    type: 'memo' | 'category' | 'empty';
    targetId?: string;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    type: 'empty'
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const loadCategories = useCallbackRef(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const categoriesData = await memoService.getCategories(user.id);
      setCategories(categoriesData);
    } catch (error) {
      logError('Error loading categories', 'MemoPage', error as Error);
      addToast({ message: '加载分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, addToast]);

  useEffect(() => {
    if (user) {
      loadCategories();
    }
  }, [user, loadCategories]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex(c => c.id === active.id);
      const newIndex = categories.findIndex(c => c.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newCategories = arrayMove(categories, oldIndex, newIndex);
        setCategories(newCategories);
        if (user) {
          memoService.updateCategoryOrder(user.id, newCategories.map(c => c.id))
            .catch(error => {
              logError('Error updating category order', 'MemoPage', error as Error);
              addToast({ message: '更新分类排序失败', type: 'error' });
            });
        }
      }
    }
  }, [categories, user, addToast]);

  const loadMemos = useCallbackRef(async (pageNum: number = 1, append: boolean = false) => {
    if (!user) return;
    
    try {
      if (!append) {
        setLoading(true);
      }
      let result;
      
      if (isSearchActive && searchQuery.trim()) {
        result = await memoService.searchMemos(user.id, searchQuery.trim(), pageNum, pageSize);
      } else {
        const categoryId = selectedCategory || undefined;
        result = await memoService.getMemos(user.id, categoryId, pageNum, pageSize);
      }
      
      if (append) {
        setMemos(prev => [...prev, ...result.list]);
      } else {
        setMemos(result.list);
      }
      setHasMore(result.list.length >= pageSize);
      setCurrentPage(pageNum);
    } catch (error) {
      logError('Error loading memos', 'MemoPage', error as Error);
      addToast({ message: '加载备忘录失败', type: 'error' });
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [user, isSearchActive, searchQuery, selectedCategory, pageSize, addToast]);

  useEffect(() => {
    setCurrentPage(1);
    setMemos([]);
    setHasMore(true);
    loadMemos(1, false);
  }, [user, selectedCategory, loadMemos]);

  useEffect(() => {
    setCurrentPage(1);
    setMemos([]);
    setHasMore(true);
    loadMemos(1, false);
  }, [searchQuery, isSearchActive, loadMemos]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isLoadingMore && !loading) {
          setIsLoadingMore(true);
          loadMemos(currentPage + 1, true);
        }
      },
      { rootMargin: '200px' }
    );

    if (lastMemoRef.current && memos.length > 0) {
      observerRef.current.observe(lastMemoRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [memos.length, hasMore, isLoadingMore, loading, currentPage, loadMemos]);

  useEffect(() => {
    const handleOpenAddMemo = () => {
      setShowAddMemoModal(true);
    };

    if (window.electron) {
      window.electron.onOpenAddMemo?.(handleOpenAddMemo);
    }

    return () => {
      if (window.electron) {
        window.electron.onOpenAddMemo?.(() => {});
      }
    };
  }, []);

  const handleCreateCategory = async () => {
    if (!user || !newCategoryName.trim()) {
      consoleLog('handleCreateCategory skipped', { user: !!user, hasName: !!newCategoryName.trim() });
      return;
    }
    
    try {
      consoleLog('handleCreateCategory called', { userId: user.id, name: newCategoryName, color: newCategoryColor });
      setLoading(true);
      await memoService.createCategory(user.id, {
        name: newCategoryName.trim(),
        color: newCategoryColor
      });
      consoleLog('createCategory success');
      await loadCategories();
      setNewCategoryName('');
      setNewCategoryColor('#275D7E');
      setShowAddCategoryModal(false);
      addToast({ message: '分类添加成功', type: 'success' });
      logInfo('分类添加成功', 'MemoPage');
    } catch (error) {
      consoleLog('handleCreateCategory error', error);
      logError('Error creating category', 'MemoPage', error as Error);
      addToast({ message: '添加分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !user) return;
    
    try {
      setLoading(true);
      await memoService.updateCategory(user.id, editingCategory.id, {
        name: editingCategory.name,
        color: editingCategory.color
      });
      await loadCategories();
      setEditingCategory(null);
      setShowEditCategoryModal(false);
      addToast({ message: '分类修改成功', type: 'success' });
    } catch (error) {
      logError('Error updating category', 'MemoPage', error as Error);
      addToast({ message: '修改分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = useCallback(async (categoryId: string) => {
    if (!user) return;
    try {
      setLoading(true);
      await memoService.deleteCategory(user.id, categoryId);
      await loadCategories();
      if (selectedCategory === categoryId) {
        setSelectedCategory(null);
      }
      addToast({ message: '分类删除成功', type: 'success' });
    } catch (error) {
      logError('Error deleting category', 'MemoPage', error as Error);
      addToast({ message: '删除分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, selectedCategory, addToast, loadCategories]);

  const handleCreateMemo = async () => {
    if (!user || !newMemoTitle.trim()) {
      consoleLog('handleCreateMemo skipped', { user: !!user, hasTitle: !!newMemoTitle.trim() });
      return;
    }
    
    try {
      consoleLog('handleCreateMemo called', { userId: user.id, title: newMemoTitle, content: newMemoContent, categoryId: newMemoCategoryId, priority: newMemoPriority });
      setLoading(true);
      await memoService.createMemo(user.id, {
        category_id: newMemoCategoryId,
        title: newMemoTitle.trim(),
        content: newMemoContent,
        priority: newMemoPriority
      });
      consoleLog('createMemo success');
      setNewMemoTitle('');
      setNewMemoContent('');
      setNewMemoCategoryId(null);
      setNewMemoPriority('medium');
      setShowAddMemoModal(false);
      setCurrentPage(1);
      setHasMore(true);
      await loadMemos(1, false);
      addToast({ message: '备忘录添加成功', type: 'success' });
      logInfo('备忘录添加成功', 'MemoPage');
    } catch (error) {
      consoleLog('handleCreateMemo error', error);
      logError('Error creating memo', 'MemoPage', error as Error);
      addToast({ message: '添加备忘录失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMemo = async () => {
    if (!editingMemo || !user) return;
    
    try {
      setLoading(true);
      await memoService.updateMemo(user.id, editingMemo.id, {
        title: editingMemo.title,
        content: editingMemo.content,
        category_id: editingMemoCategoryId,
        priority: editingMemoPriority
      });
      setEditingMemo(null);
      setEditingMemoCategoryId(null);
      setEditingMemoPriority('medium');
      setShowEditMemoModal(false);
      setCurrentPage(1);
      setHasMore(true);
      await loadMemos(1, false);
      addToast({ message: '备忘录修改成功', type: 'success' });
    } catch (error) {
      logError('Error updating memo', 'MemoPage', error as Error);
      addToast({ message: '修改备忘录失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMemo = useCallback(async (memoId: string) => {
    if (!user) return;
    try {
      setLoading(true);
      await memoService.deleteMemo(user.id, memoId);
      setCurrentPage(1);
      setHasMore(true);
      await loadMemos(1, false);
      addToast({ message: '备忘录删除成功', type: 'success' });
    } catch (error) {
      logError('Error deleting memo', 'MemoPage', error as Error);
      addToast({ message: '删除备忘录失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, addToast, loadMemos]);

  const handleCopyMemoContent = useCallback(async (memo: Memo) => {
    try {
      const content = memo.content || memo.title;
      await navigator.clipboard.writeText(content);
      addToast({ message: '内容已复制', type: 'success' });
    } catch (error) {
      logError('Error copying memo content', 'MemoPage', error as Error);
      addToast({ message: '复制失败', type: 'error' });
    }
  }, [addToast]);

  const handleCopyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      addToast({ message: '链接已复制', type: 'success' });
    } catch (error) {
      logError('Error copying URL', 'MemoPage', error as Error);
      addToast({ message: '复制失败', type: 'error' });
    }
  }, [addToast]);

  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'memo' | 'category' | 'empty', targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      type,
      targetId
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleOpenConfirmDialog = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm
    });
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleCloseConfirmDialog = useCallback(() => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (contextMenu.type === 'memo' && contextMenu.targetId) {
      const memo = memos.find(i => i.id === contextMenu.targetId);
      if (!memo) return [];
      
      return [
        {
          id: 'edit',
          label: '编辑',
          icon: <Edit className="w-4 h-4" />,
          onClick: () => {
            setEditingMemo(memo);
            setEditingMemoCategoryId(memo.category_id);
            setEditingMemoPriority(memo.priority);
            setShowEditMemoModal(true);
            handleCloseContextMenu();
          }
        },
        { id: 'divider1', label: '', divider: true },
        {
          id: 'delete',
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个备忘录吗？', () => handleDeleteMemo(memo.id))
        }
      ];
    }

    if (contextMenu.type === 'category' && contextMenu.targetId) {
      const category = categories.find(c => c.id === contextMenu.targetId);
      if (!category) return [];
      
      return [
        {
          id: 'edit',
          label: '编辑',
          icon: <Edit className="w-4 h-4" />,
          onClick: () => {
            setEditingCategory(category);
            setShowEditCategoryModal(true);
            handleCloseContextMenu();
          }
        },
        { id: 'divider1', label: '', divider: true },
        {
          id: 'delete',
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个分类吗？', () => handleDeleteCategory(category.id))
        }
      ];
    }

    if (contextMenu.type === 'empty') {
      return [
        {
          id: 'add-memo',
          label: '添加备忘',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => {
            setShowAddMemoModal(true);
            handleCloseContextMenu();
          }
        },
        {
          id: 'add-category',
          label: '添加分类',
          icon: <Tag className="w-4 h-4" />,
          onClick: () => {
            setShowAddCategoryModal(true);
            handleCloseContextMenu();
          }
        }
      ];
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, memos, categories, handleDeleteMemo, handleDeleteCategory, handleCloseContextMenu, handleOpenConfirmDialog]);

  const handleCloseAddMemoModal = () => {
    setShowAddMemoModal(false);
    setNewMemoTitle('');
    setNewMemoContent('');
  };

  const handleCloseEditMemoModal = () => {
    setShowEditMemoModal(false);
    setEditingMemo(null);
  };

  const handleCloseAddCategoryModal = () => {
    setShowAddCategoryModal(false);
    setNewCategoryName('');
  };

  const handleCloseEditCategoryModal = () => {
    setShowEditCategoryModal(false);
    setEditingCategory(null);
  };

  const handleOpenPreview = (memo: Memo) => {
    setPreviewMemo(memo);
    setShowPreviewModal(true);
  };

  const handleClosePreview = () => {
    setShowPreviewModal(false);
    setPreviewMemo(null);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div 
      className="h-full flex p-4 overflow-hidden"
      onContextMenu={(e) => handleContextMenu(e, 'empty')}
    >
        <div className="w-32 max-w-[120px] flex-shrink-0 mr-4 flex flex-col">
          <div className="mb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left flex items-center gap-2 ${
                selectedCategory === null 
                  ? 'bg-gray-800 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Tag size={14} />
              全部
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={categories.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <SortableCategoryButton
                      key={category.id}
                      category={category}
                      isSelected={selectedCategory === category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      onContextMenu={(e) => handleContextMenu(e, 'category', category.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-hide p-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : memos.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[400px]">
                <StickyNote className="w-12 h-12 text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">暂无备忘录</p>
                <button
                  onClick={() => setShowAddMemoModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  <Plus size={14} />
                  创建一条
                </button>
              </div>
            ) : (
              <div className="flex gap-4 h-full" style={{ flexDirection: columnCount === 1 ? 'column' : 'row' }}>
                {Array.from({ length: columnCount }).map((_, colIndex) => {
                  const colMemos = memos.filter((_, index) => index % columnCount === colIndex);
                  return (
                    <div 
                      key={colIndex} 
                      className="flex-1 flex flex-col gap-4"
                      style={{ minWidth: columnCount === 1 ? 'auto' : '200px', maxWidth: '300px' }}
                    >
                      {colMemos.map((memo, index) => (
                        <div 
                          key={memo.id}
                          ref={colIndex === columnCount - 1 && index === colMemos.length - 1 ? lastMemoRef : null}
                          className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shadow-sm"
                          onClick={() => handleOpenPreview(memo)}
                          onContextMenu={(e) => handleContextMenu(e, 'memo', memo.id)}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${getPriorityStyle(memo.priority)}`}>
                                  <AlertCircle size={8} />
                                  {getPriorityLabel(memo.priority)}
                                </span>
                                <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                  {memo.title}
                                </h3>
                              </div>
                              {memo.content && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words max-h-32 overflow-hidden">
                                  {memo.content.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
                                    if (part.match(/^https?:\/\/[^\s]+$/)) {
                                      return <LinkWithCopy key={index} url={part} onCopy={handleCopyUrl} />;
                                    }
                                    return part;
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyMemoContent(memo);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                              title="复制内容"
                            >
                              <Copy size={12} />
                            </button>
                            {memo.category_id && (
                              <span 
                                className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: `${categories.find(c => c.id === memo.category_id)?.color}20`, color: categories.find(c => c.id === memo.category_id)?.color }}
                              >
                                {memo.category_name}
                              </span>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                              {new Date(memo.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {isLoadingMore && (
                  <div className="flex items-center justify-center py-4 w-full">
                    <LoadingSpinner size="sm" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <Modal
          isOpen={showAddMemoModal}
          onClose={handleCloseAddMemoModal}
          title="添加备忘"
          confirmText="添加"
          onConfirm={handleCreateMemo}
          confirmDisabled={!newMemoTitle.trim()}
          clickOutsideToClose={false}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Select
                  value={newMemoPriority}
                  onChange={(v) => setNewMemoPriority(v as 'high' | 'medium' | 'low')}
                  options={[
                    { value: 'high', label: '高优先级' },
                    { value: 'medium', label: '中优先级' },
                    { value: 'low', label: '低优先级' }
                  ]}
                  className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border-none ${getPriorityStyle(newMemoPriority)}`}
                />
                <Select
                  value={newMemoCategoryId || ''}
                  onChange={(v) => setNewMemoCategoryId(v || null)}
                  options={[
                    { value: '', label: '全部' },
                    ...categories.map((category) => ({ value: category.id, label: category.name }))
                  ]}
                  className="text-xs font-medium px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                />
              </div>
            </div>
            <input
              type="text"
              value={newMemoTitle}
              onChange={(e) => setNewMemoTitle(e.target.value)}
              placeholder="标题"
              className={modalControlClass}
            />
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 min-h-[120px] max-h-64 overflow-auto relative group">
              <textarea
                value={newMemoContent}
                onChange={(e) => setNewMemoContent(e.target.value)}
                placeholder="内容"
                rows={4}
                className="w-full bg-transparent resize-none focus:outline-none text-sm text-gray-600 dark:text-gray-300 placeholder-gray-400"
              />
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showEditMemoModal}
          onClose={handleCloseEditMemoModal}
          title="编辑备忘录"
          confirmText="保存"
          onConfirm={handleUpdateMemo}
          clickOutsideToClose={false}
        >
          {editingMemo && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Select
                    value={editingMemoPriority}
                    onChange={(v) => setEditingMemoPriority(v as 'high' | 'medium' | 'low')}
                    options={[
                      { value: 'high', label: '高优先级' },
                      { value: 'medium', label: '中优先级' },
                      { value: 'low', label: '低优先级' }
                    ]}
                    className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border-none ${getPriorityStyle(editingMemoPriority)}`}
                  />
                  <Select
                    value={editingMemoCategoryId || ''}
                    onChange={(v) => setEditingMemoCategoryId(v || null)}
                    options={[
                      { value: '', label: '全部' },
                      ...categories.map((category) => ({ value: category.id, label: category.name }))
                    ]}
                    className="text-xs font-medium px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  />
                </div>
              </div>
              <input
                type="text"
                value={editingMemo.title}
                onChange={(e) => setEditingMemo({ ...editingMemo, title: e.target.value })}
                placeholder="标题"
                className={modalControlClass}
              />
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 min-h-[120px] max-h-64 overflow-auto relative group">
                <textarea
                  value={editingMemo.content}
                  onChange={(e) => setEditingMemo({ ...editingMemo, content: e.target.value })}
                  placeholder="内容"
                  rows={4}
                  className="w-full bg-transparent resize-none focus:outline-none text-sm text-gray-600 dark:text-gray-300 placeholder-gray-400"
                />
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={showAddCategoryModal}
          onClose={handleCloseAddCategoryModal}
          title="添加分类"
          confirmText="添加"
          onConfirm={handleCreateCategory}
          confirmDisabled={!newCategoryName.trim()}
          clickOutsideToClose={false}
        >
          <div className="space-y-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="分类名称"
              className={modalControlClass}
            />
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 dark:text-gray-400">颜色</label>
              <input
                type="color"
                value={newCategoryColor}
                onChange={(e) => setNewCategoryColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">{newCategoryColor}</span>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showEditCategoryModal}
          onClose={handleCloseEditCategoryModal}
          title="编辑分类"
          confirmText="保存"
          onConfirm={handleUpdateCategory}
          clickOutsideToClose={false}
        >
          {editingCategory && (
            <div className="space-y-2">
              <input
                type="text"
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                placeholder="分类名称"
                className={modalControlClass}
              />
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 dark:text-gray-400">颜色</label>
                <input
                  type="color"
                  value={editingCategory.color}
                  onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">{editingCategory.color}</span>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={showPreviewModal}
          onClose={handleClosePreview}
          title={previewMemo?.title || '备忘录详情'}
          showCancel={false}
          showConfirm={false}
        >
          {previewMemo && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${getPriorityStyle(previewMemo.priority)}`}>
                    <AlertCircle size={10} />
                    {getPriorityLabel(previewMemo.priority)}
                  </span>
                  {previewMemo.category_id && (
                    <span 
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${categories.find(c => c.id === previewMemo.category_id)?.color}20`, color: categories.find(c => c.id === previewMemo.category_id)?.color }}
                    >
                      {previewMemo.category_name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(previewMemo.created_at).toLocaleString()}
                  </span>
                  <button
                    onClick={() => {
                      setEditingMemo(previewMemo);
                      setEditingMemoCategoryId(previewMemo.category_id);
                      setEditingMemoPriority(previewMemo.priority);
                      setShowEditMemoModal(true);
                      handleClosePreview();
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="编辑"
                  >
                    <Edit size={14} />
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 min-h-[120px] max-h-64 overflow-auto relative group scrollbar-hide">
                <button
                  onClick={() => handleCopyMemoContent(previewMemo)}
                  className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  title="复制内容"
                >
                  <Copy size={14} />
                </button>
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words">
                  {(previewMemo.content || '暂无内容').split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
                    if (part.match(/^https?:\/\/[^\s]+$/)) {
                      return <LinkWithCopy key={index} url={part} onCopy={handleCopyUrl} />;
                    }
                    return part;
                  })}
                </p>
              </div>
            </div>
          )}
        </Modal>

      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        items={getContextMenuItems()}
        onClose={handleCloseContextMenu}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={handleCloseConfirmDialog}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
};

export default MemoPage;