import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clipboard, Plus, Trash2, Edit, ClipboardPaste, Tag } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndSensors } from '../../../hooks/useDndSensors';
import { clipboardService } from '../../../services/ClipboardService';
import { openUrl } from '../../../services/browserService';
import { ClipboardCategory, ClipboardItem } from '../../../types/clipboard';
import { useAuthStore } from '../../../store/AuthStore';
import { useToastStore } from '../../../store/toastStore';
import { useNavSearch } from '../../../contexts/NavSearchContext';
import { logError } from '../../../services/loggerService';

import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ContextMenu, { ContextMenuItem } from '../../../components/ui/ContextMenu';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import Pagination from '../../../components/ui/Pagination';

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
        <Clipboard className="w-3 h-3 text-gray-600 dark:text-gray-400" />
      </button>
      <button
        onClick={() => openUrl(url)}
        className="text-blue-600 dark:text-blue-400 hover:underline text-sm bg-transparent border-none p-0 cursor-pointer"
      >
        {url}
      </button>
    </span>
  );
};

const SortableCategoryButton: React.FC<{
  category: ClipboardCategory;
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
        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors flex items-center gap-1 ${
          isSelected
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
      >
        <Tag size={12} />
        {category.name}
      </button>
    </div>
  );
};

const CloudClipboardPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const addToast = useToastStore((state) => state.addToast);
  const { searchQuery, isSearchActive } = useNavSearch();
  const [categories, setCategories] = useState<ClipboardCategory[]>([]);

  const sensors = useDndSensors();
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newItemContent, setNewItemContent] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newItemCategoryId, setNewItemCategoryId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ClipboardItem | null>(null);
  const [editingItemCategoryId, setEditingItemCategoryId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<ClipboardCategory | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [showEditItemModal, setShowEditItemModal] = useState<boolean>(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    type: 'item' | 'category' | 'empty';
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

  useEffect(() => {
    if (user) {
      loadCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadCategories = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const categoriesData = await clipboardService.getCategories(user.id);
      setCategories(categoriesData);
    } catch (error) {
      logError('Error loading categories', 'CloudClipboardPage', error as Error);
      addToast({ message: '加载分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex(c => c.id === active.id);
      const newIndex = categories.findIndex(c => c.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newCategories = arrayMove(categories, oldIndex, newIndex);
        setCategories(newCategories);
        if (user) {
          clipboardService.updateCategoryOrder(user.id, newCategories.map(c => c.id))
            .catch(error => {
              logError('Error updating category order', 'CloudClipboardPage', error as Error);
              addToast({ message: '更新分类排序失败', type: 'error' });
            });
        }
      }
    }
  }, [categories, user, addToast]);

  useEffect(() => {
    setCurrentPage(1);
    loadItems(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedCategory]);

  useEffect(() => {
    loadItems(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  useEffect(() => {
    setCurrentPage(1);
    loadItems(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isSearchActive]);

  const loadItems = async (pageNum: number = 1) => {
    if (!user) return;
    
    try {
      setLoading(true);
      let result;
      
      if (isSearchActive && searchQuery.trim()) {
        result = await clipboardService.searchItems(user.id, searchQuery.trim(), pageNum, pageSize);
      } else {
        const categoryId = selectedCategory || undefined;
        result = await clipboardService.getItems(user.id, categoryId, pageNum, pageSize);
      }
      
      setItems(result.list);
      setTotalItems(result.total);
      setCurrentPage(pageNum);
    } catch (error) {
      logError('Error loading items', 'CloudClipboardPage', error as Error);
      addToast({ message: '加载项目失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!user || !newCategoryName.trim()) return;
    
    try {
      setLoading(true);
      await clipboardService.createCategory(user.id, {
        name: newCategoryName.trim()
      });
      await loadCategories();
      setNewCategoryName('');
      setShowAddCategoryModal(false);
      addToast({ message: '分类添加成功', type: 'success' });
    } catch (error) {
      logError('Error creating category', 'CloudClipboardPage', error as Error);
      addToast({ message: '添加分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !user) return;
    
    try {
      setLoading(true);
      await clipboardService.updateCategory(user.id, editingCategory.id, {
        name: editingCategory.name
      });
      await loadCategories();
      setEditingCategory(null);
      setShowEditCategoryModal(false);
      addToast({ message: '分类修改成功', type: 'success' });
    } catch (error) {
      logError('Error updating category', 'CloudClipboardPage', error as Error);
      addToast({ message: '修改分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = useCallback(async (categoryId: string) => {
    if (!user) return;
    try {
      setLoading(true);
      await clipboardService.deleteCategory(user.id, categoryId);
      await loadCategories();
      if (selectedCategory === categoryId) {
        setSelectedCategory(null);
      }
      addToast({ message: '分类删除成功', type: 'success' });
    } catch (error) {
      logError('Error deleting category', 'CloudClipboardPage', error as Error);
      addToast({ message: '删除分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, clipboardService, loadCategories, selectedCategory, addToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateItem = async () => {
    if (!user || !newItemContent.trim()) return;
    
    try {
      setLoading(true);
      await clipboardService.createItem(user.id, {
        category_id: newItemCategoryId,
        content: newItemContent.trim()
      });
      setNewItemContent('');
      setNewItemCategoryId(null);
      setShowAddItemModal(false);
      await loadItems(1);
      addToast({ message: '项目添加成功', type: 'success' });
    } catch (error) {
      logError('Error creating item', 'CloudClipboardPage', error as Error);
      addToast({ message: '添加项目失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !user) return;
    
    try {
      setLoading(true);
      await clipboardService.updateItem(user.id, editingItem.id, {
        content: editingItem.content,
        category_id: editingItemCategoryId
      });
      setEditingItem(null);
      setEditingItemCategoryId(null);
      setShowEditItemModal(false);
      await loadItems(1);
      addToast({ message: '项目修改成功', type: 'success' });
    } catch (error) {
      logError('Error updating item', 'CloudClipboardPage', error as Error);
      addToast({ message: '修改项目失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = useCallback(async (itemId: string) => {
    if (!user) return;
    try {
      setLoading(true);
      await clipboardService.deleteItem(user.id, itemId);
      await loadItems(1);
      addToast({ message: '项目删除成功', type: 'success' });
    } catch (error) {
      logError('Error deleting item', 'CloudClipboardPage', error as Error);
      addToast({ message: '删除项目失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, clipboardService, addToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyItem = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      addToast({ message: '复制成功', type: 'success' });
    } catch (error) {
      logError('Error copying to clipboard', 'CloudClipboardPage', error as Error);
      addToast({ message: '浏览器权限限制，请手动复制', type: 'warning' });
    }
  }, [addToast]);

  const handleCopyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      addToast({ message: '链接已复制', type: 'success' });
    } catch (error) {
      logError('Error copying URL', 'CloudClipboardPage', error as Error);
      addToast({ message: '复制失败', type: 'error' });
    }
  }, [addToast]);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setNewItemContent(text);
    } catch (error) {
      logError('Error pasting from clipboard', 'CloudClipboardPage', error as Error);
      addToast({ message: '浏览器权限限制，请手动粘贴', type: 'warning' });
    }
  };

  const handleQuickPaste = async () => {
    if (!user) return;
    
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;
      
      setLoading(true);
      await clipboardService.createItem(user.id, {
        category_id: selectedCategory || null,
        content: text.trim()
      });
      await loadItems(1);
      addToast({ message: '快速粘贴成功', type: 'success' });
    } catch (error) {
      logError('Error quick pasting', 'CloudClipboardPage', error as Error);
      addToast({ message: '浏览器权限限制，请手动粘贴', type: 'warning' });
    } finally {
      setLoading(false);
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'item' | 'category' | 'empty', targetId?: string) => {
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
    if (contextMenu.type === 'item' && contextMenu.targetId) {
      const item = items.find(i => i.id === contextMenu.targetId);
      if (!item) return [];
      
      return [
        {
          id: 'copy',
          label: '复制',
          icon: <Clipboard className="w-4 h-4" />,
          onClick: () => {
            handleCopyItem(item.content);
            handleCloseContextMenu();
          }
        },
        {
          id: 'edit',
          label: '编辑',
          icon: <Edit className="w-4 h-4" />,
          onClick: () => {
            setEditingItem(item);
            setEditingItemCategoryId(item.category_id);
            setShowEditItemModal(true);
            handleCloseContextMenu();
          }
        },
        { id: 'divider1', label: '', divider: true },
        {
          id: 'delete',
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个项目吗？', () => handleDeleteItem(item.id))
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
          id: 'add-item',
          label: '添加项目',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => {
            setShowAddItemModal(true);
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
  }, [contextMenu.type, contextMenu.targetId, items, categories, handleCopyItem, handleDeleteItem, handleDeleteCategory, handleCloseContextMenu, handleOpenConfirmDialog]);

  const handleCloseAddItemModal = () => {
    setShowAddItemModal(false);
    setNewItemContent('');
  };

  const handleCloseEditItemModal = () => {
    setShowEditItemModal(false);
    setEditingItem(null);
  };

  const handleCloseAddCategoryModal = () => {
    setShowAddCategoryModal(false);
    setNewCategoryName('');
  };

  const handleCloseEditCategoryModal = () => {
    setShowEditCategoryModal(false);
    setEditingCategory(null);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div 
      className="h-full flex flex-col p-4 overflow-hidden"
      onContextMenu={(e) => handleContextMenu(e, 'empty')}
    >
        <div className="mb-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  selectedCategory === null 
                    ? 'bg-gray-800 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                全部
              </button>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={categories.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                  <div className="flex items-center gap-2 flex-wrap">
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
              <button
                onClick={() => setShowAddCategoryModal(true)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="添加分类"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleQuickPaste}
                className="p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setShowAddItemModal(true)}
                className="p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Clipboard className="w-10 h-10 text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">暂无剪贴板项目</p>
            </div>
          ) : (
            items.map((item) => (
              <div 
                key={item.id} 
                className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 border border-gray-200 dark:border-gray-600"
                onContextMenu={(e) => handleContextMenu(e, 'item', item.id)}
              >
                <div className="flex items-start gap-3">
                  <button 
                    onClick={() => handleCopyItem(item.content)}
                    className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded transition-colors flex-shrink-0"
                  >
                    <Clipboard className="w-4 h-4" />
                  </button>
                  <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words text-sm flex-1">
                    {item.content.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
                      if (part.match(/^https?:\/\/[^\s]+$/)) {
                        return (
                          <LinkWithCopy key={index} url={part} onCopy={handleCopyUrl} />
                        );
                      }
                      return part;
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {item.category_id && (
                    <span className="text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full">
                      {categories.find(c => c.id === item.category_id)?.name}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            currentPage={currentPage}
            total={totalItems}
            pageSize={pageSize}
            onPageChange={loadItems}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>

        <Modal
          isOpen={showAddItemModal}
          onClose={handleCloseAddItemModal}
          title="添加项目"
          confirmText="添加"
          onConfirm={handleCreateItem}
          confirmDisabled={!newItemContent.trim()}
        >
          <div className="space-y-4">
            <select
              value={newItemCategoryId || ''}
              onChange={(e) => setNewItemCategoryId(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">全部</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <div className="relative">
              <textarea
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                placeholder="内容"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={handlePasteFromClipboard}
                className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md"
              >
                <ClipboardPaste className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showEditItemModal}
          onClose={handleCloseEditItemModal}
          title="编辑项目"
          confirmText="保存"
          onConfirm={handleUpdateItem}
        >
          {editingItem && (
            <div className="space-y-4">
              <select
                value={editingItemCategoryId || ''}
                onChange={(e) => setEditingItemCategoryId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">全部</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <textarea
                value={editingItem.content}
                onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                placeholder="内容"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white"
              />
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
        >
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="分类名称"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white"
          />
        </Modal>

        <Modal
          isOpen={showEditCategoryModal}
          onClose={handleCloseEditCategoryModal}
          title="编辑分类"
          confirmText="保存"
          onConfirm={handleUpdateCategory}
        >
          {editingCategory && (
            <input
              type="text"
              value={editingCategory.name}
              onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
              placeholder="分类名称"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white"
            />
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

export default CloudClipboardPage;