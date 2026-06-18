import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Edit, Trash2, Tag, CheckSquare, FolderOpen } from 'lucide-react';
import { todoServiceWrapper, Todo, TodoCategory, CreateTodoRequest, CreateTodoCategoryRequest } from '../../../services/TodoService';
import { useAuthStore } from '../../../store/AuthStore';
import { useToastStore } from '../../../store/toastStore';
import { useNavSearch } from '../../../contexts/NavSearchContext';
import { useTodoNotification } from '../../../contexts/TodoNotificationContext';
import ContextMenu, { ContextMenuItem } from '../../../components/ui/ContextMenu';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import TodoCard from '../../../components/ui/TodoCard';
import { debounce } from '../../../utils';

function formatDateTimeForInput(dateTimeStr: string): string {
  if (!dateTimeStr) return '';
  
  const trimmed = dateTimeStr.trim();
  
  if (trimmed.includes('T')) {
    const parts = trimmed.split('T');
    const datePart = parts[0];
    let timePart = parts[1] || '';
    
    if (timePart.includes('.')) {
      timePart = timePart.split('.')[0];
    }
    
    if (timePart.includes('Z')) {
      timePart = timePart.replace('Z', '');
    }
    
    if (timePart.length >= 5) {
      return `${datePart}T${timePart.substring(0, 5)}`;
    } else if (timePart.length === 0) {
      return `${datePart}T00:00`;
    }
  } else if (trimmed.includes(' ')) {
    const parts = trimmed.split(' ');
    const datePart = parts[0];
    const timePart = parts[1] || '';
    
    if (timePart.includes(':')) {
      const timeSegments = timePart.split(':');
      if (timeSegments.length >= 2) {
        return `${datePart}T${timeSegments[0]}:${timeSegments[1]}`;
      }
    }
    return `${datePart}T00:00`;
  }
  
  return trimmed;
}

const COLOR_OPTIONS = [
  '#3B82F6',
  '#F97316',
  '#A855F7',
  '#EF4444',
  '#10B981',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

const TodoManagerPage: React.FC = () => {
  const admin = useAuthStore((state) => state.admin);
  const addToast = useToastStore((state) => state.addToast);
  const { searchQuery, isSearchActive } = useNavSearch();
  const { refreshCount } = useTodoNotification();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [categories, setCategories] = useState<TodoCategory[]>([]);
  const [activeTab, setActiveTab] = useState<'in_progress' | 'completed' | 'all'>('in_progress');
  const [showAddTodoModal, setShowAddTodoModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingCategory, setEditingCategory] = useState<TodoCategory | null>(null);
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6');
  const [newCategoryName, setNewCategoryName] = useState('');

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

  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: '中' as '高' | '中' | '低',
    status: '待办' as '待办' | '进行中' | '已完成' | '已取消',
    category_id: null as string | null
  });

  // 防抖加载待办事项
  const debouncedLoadTodosRef = useRef<(() => void) | null>(null);

  const loadTodos = useCallback(async () => {
    if (!admin) return;

    const categoriesResult = await todoServiceWrapper.category.getCategories(admin.id);
    if (categoriesResult.success) {
      setCategories(categoriesResult.data || []);
    }

    let todosResult;
    const finalSearchQuery = isSearchActive && searchQuery.trim() ? searchQuery.trim() : undefined;

    if (finalSearchQuery) {
      todosResult = await todoServiceWrapper.todo.searchTodos(admin.id, finalSearchQuery, 1, 100);
    } else {
      todosResult = await todoServiceWrapper.todo.getTodos(admin.id, undefined, 1, 100);
    }

    if (todosResult.success && todosResult.data) {
      setTodos(todosResult.data.data || []);
    }
  }, [admin, isSearchActive, searchQuery]);

  useEffect(() => {
    const handleOpenAddTodo = () => {
      setShowAddTodoModal(true);
    };
    window.electron?.onOpenAddTodo(handleOpenAddTodo);
    return () => {
      window.electron?.onOpenAddTodo(() => {});
    };
  }, []);

  // 初始化防抖函数
  useEffect(() => {
    debouncedLoadTodosRef.current = debounce(() => {
      loadTodos();
    }, 300);
  }, [loadTodos]);

  // 搜索查询变化时防抖加载
  useEffect(() => {
    if (debouncedLoadTodosRef.current) {
      debouncedLoadTodosRef.current();
    }
    return () => {
      if (debouncedLoadTodosRef.current) {
        // debounce 内部已处理清理
      }
    };
  }, [searchQuery, isSearchActive]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const todosByCategory = useMemo(() => {
    const grouped: Record<string, Todo[]> = {};
    
    let filtered = [...todos];
    
    if (activeTab === 'completed') {
      filtered = filtered.filter(t => t.is_completed);
    } else if (activeTab === 'in_progress') {
      filtered = filtered.filter(t => !t.is_completed);
    }
    
    filtered.forEach(todo => {
      const catId = todo.category_id || 'uncategorized';
      if (!grouped[catId]) {
        grouped[catId] = [];
      }
      grouped[catId].push(todo);
    });
    
    return grouped;
  }, [todos, activeTab]);

  const inProgressCount = todos.filter(t => !t.is_completed).length;
  const completedCount = todos.filter(t => t.is_completed).length;

  const handleAddTodo = async () => {
    if (!admin || !newTodo.title.trim()) return;

    const todoData: CreateTodoRequest = {
      title: newTodo.title,
      description: newTodo.description,
      due_date: newTodo.due_date,
      priority: newTodo.priority,
      status: newTodo.status,
      category_id: newTodo.category_id
    };

    const result = await todoServiceWrapper.todo.createTodo(admin.id, todoData);
    if (result.success) {
      resetNewTodo();
      setShowAddTodoModal(false);
      addToast({ message: '任务添加成功', type: 'success' });
      refreshCount();
      loadTodos();
    } else {
      addToast({ message: '添加任务失败', type: 'error' });
    }
  };

  const resetNewTodo = useCallback(() => {
    setNewTodo({
      title: '',
      description: '',
      due_date: '',
      priority: '中',
      status: '待办',
      category_id: null
    });
  }, []);

  const handleToggleComplete = useCallback(async (id: string) => {
    if (!admin) return;
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const result = await todoServiceWrapper.todo.updateTodoStatus(admin.id, id, !todo.is_completed);
    if (result.success) {
      addToast({ message: todo.is_completed ? '任务已取消完成' : '任务已完成', type: 'success' });
      refreshCount();
      loadTodos();
    } else {
      addToast({ message: '更新任务状态失败', type: 'error' });
    }
  }, [admin, todos, addToast, refreshCount, loadTodos]);

  const handleEditTodo = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setNewTodo({
      title: todo.title,
      description: todo.description || '',
      due_date: todo.due_date || '',
      priority: todo.priority,
      status: todo.status,
      category_id: todo.category_id
    });
    setShowAddTodoModal(true);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleSaveEdit = async () => {
    if (!admin || !editingTodo || !newTodo.title.trim()) return;

    const todoData: CreateTodoRequest = {
      title: newTodo.title,
      description: newTodo.description,
      due_date: newTodo.due_date,
      priority: newTodo.priority,
      status: newTodo.status,
      category_id: newTodo.category_id
    };

    const result = await todoServiceWrapper.todo.updateTodo(admin.id, editingTodo.id, todoData);
    if (result.success) {
      setEditingTodo(null);
      resetNewTodo();
      setShowAddTodoModal(false);
      addToast({ message: '任务修改成功', type: 'success' });
      refreshCount();
      loadTodos();
    } else {
      addToast({ message: '修改任务失败', type: 'error' });
    }
  };

  const handleDeleteTodo = useCallback(async (id: string) => {
    if (!admin) return;
    const result = await todoServiceWrapper.todo.deleteTodo(admin.id, id);
    if (result.success) {
      addToast({ message: '任务删除成功', type: 'success' });
      refreshCount();
      loadTodos();
    } else {
      addToast({ message: '删除任务失败', type: 'error' });
    }
  }, [admin, addToast, refreshCount, loadTodos]);

  const handleAddCategory = async () => {
    if (!admin || !newCategoryName.trim()) return;

    const categoryData: CreateTodoCategoryRequest = {
      name: newCategoryName,
      color: newCategoryColor,
      parent_id: null
    };

    const result = await todoServiceWrapper.category.createCategory(admin.id, categoryData);
    if (result.success) {
      setNewCategoryName('');
      setNewCategoryColor('#3B82F6');
      setShowCategoryModal(false);
      addToast({ message: '分类添加成功', type: 'success' });
      loadTodos();
    } else {
      addToast({ message: '添加分类失败', type: 'error' });
    }
  };

  const handleEditCategory = useCallback((category: TodoCategory) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryColor(category.color || '#3B82F6');
    setShowCategoryModal(true);
  }, []);

  const handleSaveCategoryEdit = async () => {
    if (!admin || !editingCategory || !newCategoryName.trim()) return;

    const categoryData: CreateTodoCategoryRequest = {
      name: newCategoryName,
      color: newCategoryColor,
      parent_id: null
    };

    const result = await todoServiceWrapper.category.updateCategory(admin.id, editingCategory.id, categoryData);
    if (result.success) {
      setEditingCategory(null);
      setNewCategoryName('');
      setShowCategoryModal(false);
      addToast({ message: '分类修改成功', type: 'success' });
      loadTodos();
    } else {
      addToast({ message: '修改分类失败', type: 'error' });
    }
  };

  const handleDeleteCategory = useCallback(async (id: string) => {
    if (!admin) return;
    const result = await todoServiceWrapper.category.deleteCategory(admin.id, id);
    if (result.success) {
      addToast({ message: '分类删除成功', type: 'success' });
      loadTodos();
    } else {
      addToast({ message: '删除分类失败', type: 'error' });
    }
  }, [admin, addToast, loadTodos]);

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
      const item = todos.find(i => i.id === contextMenu.targetId);
      if (!item) return [];
      
      return [
        {
          id: 'edit',
          label: '编辑',
          icon: <Edit className="w-4 h-4" />,
          onClick: () => handleEditTodo(item)
        },
        {
          id: 'toggle',
          label: item.is_completed ? '标记为未完成' : '标记为完成',
          icon: <CheckSquare className={`w-4 h-4 ${item.is_completed ? 'fill-current' : ''}`} />,
          onClick: () => {
            handleToggleComplete(item.id);
            handleCloseContextMenu();
          }
        },
        { id: 'divider1', label: '', divider: true },
        {
          id: 'delete',
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个任务吗？', () => handleDeleteTodo(item.id))
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
            handleEditCategory(category);
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
          id: 'add-todo',
          label: '添加任务',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => {
            setShowAddTodoModal(true);
            handleCloseContextMenu();
          }
        },
        {
          id: 'add-category',
          label: '添加分类',
          icon: <Tag className="w-4 h-4" />,
          onClick: () => {
            setShowCategoryModal(true);
            handleCloseContextMenu();
          }
        }
      ];
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, todos, categories, handleEditTodo, handleToggleComplete, handleDeleteTodo, handleEditCategory, handleDeleteCategory, handleCloseContextMenu, handleOpenConfirmDialog]);

  const handleCloseAddTodoModal = () => {
    setShowAddTodoModal(false);
    setEditingTodo(null);
    resetNewTodo();
  };

  const handleCloseCategoryModal = () => {
    setShowCategoryModal(false);
    setNewCategoryName('');
    setEditingCategory(null);
  };

  const handleAddTodoWithCategory = useCallback((categoryId: string | null) => {
    resetNewTodo();
    setNewTodo(prev => ({ ...prev, category_id: categoryId }));
    setShowAddTodoModal(true);
  }, [resetNewTodo]);

  if (!admin) return null;

  return (
    <div 
      className="h-full flex flex-col p-6 overflow-hidden"
      onContextMenu={(e) => handleContextMenu(e, 'empty')}
      onClick={() => {}}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">我的待办事项</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">管理您的日常任务和分组记录</p>
            </div>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="bg-gray-800 dark:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-gray-700 dark:hover:bg-blue-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              新建分类
            </button>
          </div>

          <div className="flex gap-6 border-b border-gray-200 dark:border-gray-700 mb-6">
            <button
              onClick={() => setActiveTab('in_progress')}
              className={`pb-3 text-sm font-semibold transition-colors ${
                activeTab === 'in_progress'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              进行中 ({inProgressCount})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`pb-3 text-sm font-semibold transition-colors ${
                activeTab === 'completed'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              已完成 ({completedCount})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-3 text-sm font-semibold transition-colors ${
                activeTab === 'all'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              所有任务
            </button>
          </div>

          {categories.length === 0 && !todosByCategory['uncategorized'] ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <FolderOpen className="w-12 h-12 mb-4" />
              <p className="text-lg mb-2">暂无分类</p>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <Plus className="w-4 h-4" />
                创建第一个分类
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                todosByCategory[category.id] && (
                  <TodoCard
                    key={category.id}
                    category={category}
                    todos={todosByCategory[category.id]}
                    color={category.color || '#3B82F6'}
                    onContextMenu={handleContextMenu}
                    onToggleComplete={handleToggleComplete}
                    onEditTodo={handleEditTodo}
                    onDeleteTodo={handleDeleteTodo}
                    onEditCategory={handleEditCategory}
                    onDeleteCategory={handleDeleteCategory}
                    onOpenConfirmDialog={handleOpenConfirmDialog}
                    onAddTodo={handleAddTodoWithCategory}
                    categories={categories}
                  />
                )
              ))}

              {todosByCategory['uncategorized'] && todosByCategory['uncategorized'].length > 0 && (
                <TodoCard
                  key="uncategorized"
                  category={{ id: 'uncategorized', name: '未分类' }}
                  todos={todosByCategory['uncategorized']}
                  color="#6B7280"
                  onContextMenu={handleContextMenu}
                  onToggleComplete={handleToggleComplete}
                  onEditTodo={handleEditTodo}
                  onDeleteTodo={handleDeleteTodo}
                  onEditCategory={handleEditCategory}
                  onDeleteCategory={handleDeleteCategory}
                  onOpenConfirmDialog={handleOpenConfirmDialog}
                  onAddTodo={handleAddTodoWithCategory}
                  categories={categories}
                />
              )}

              <div
                onClick={() => setShowCategoryModal(true)}
                className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                  <Plus className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">创建新任务分组</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showAddTodoModal}
        onClose={handleCloseAddTodoModal}
        title={editingTodo ? '编辑任务' : '添加新任务'}
        confirmText={editingTodo ? '保存' : '添加'}
        onConfirm={editingTodo ? handleSaveEdit : handleAddTodo}
        confirmDisabled={!newTodo.title.trim()}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">任务标题 *</label>
            <input
              type="text"
              value={newTodo.title}
              onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
              placeholder="输入任务标题"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">分类</label>
            <select
              value={newTodo.category_id || ''}
              onChange={(e) => setNewTodo({ ...newTodo, category_id: e.target.value || null })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
            >
              <option value="">未分类</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">优先级</label>
              <select
                value={newTodo.priority}
                onChange={(e) => setNewTodo({ ...newTodo, priority: e.target.value as '高' | '中' | '低' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
              >
                <option value="高">高</option>
                <option value="中">中</option>
                <option value="低">低</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">截止日期</label>
              <input
                type="datetime-local"
                value={newTodo.due_date ? formatDateTimeForInput(newTodo.due_date) : ''}
                onChange={(e) => setNewTodo({ ...newTodo, due_date: e.target.value.replace('T', ' ') })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
            <textarea
              value={newTodo.description}
              onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
              placeholder="输入任务描述"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCategoryModal}
        onClose={handleCloseCategoryModal}
        title={editingCategory ? '编辑分类' : '新建分类'}
        confirmText={editingCategory ? '保存' : '创建'}
        onConfirm={editingCategory ? handleSaveCategoryEdit : handleAddCategory}
        confirmDisabled={!newCategoryName.trim()}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">分类名称 *</label>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="输入分类名称"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">颜色</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((color) => (
                <div
                  key={color}
                  className={`w-7 h-7 rounded-full cursor-pointer border-2 transition-all bg-[${color}] ${
                    newCategoryColor === color
                      ? 'border-white scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  onClick={() => setNewCategoryColor(color)}
                />
              ))}
            </div>
          </div>
          {categories.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">现有分类</h3>
              <div className="space-y-2">
                {categories.map(category => (
                  <div key={category.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <span className="text-sm text-gray-800 dark:text-white">{category.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditCategory(category)}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenConfirmDialog('删除确认', '确定要删除这个分类吗？', () => handleDeleteCategory(category.id))}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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

export default TodoManagerPage;