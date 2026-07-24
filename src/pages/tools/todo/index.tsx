import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, FolderOpen } from 'lucide-react';
import { todoServiceWrapper, Todo, TodoCategory, CreateTodoRequest, CreateTodoCategoryRequest } from '../../../services/TodoService';
import { useAuthStore } from '../../../store/AuthStore';
import { useNavSearch } from '../../../contexts/NavSearchContext';
import ContextMenu from '../../../components/ui/ContextMenu';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import TodoCard from '../../../components/ui/TodoCard';
import { debounce } from '../../../utils';
import { useTodoOperations } from './useTodoOperations';
import { useCategoryOperations } from './useCategoryOperations';
import { useTodoContextMenu } from './useTodoContextMenu';
import TodoFormModal from './TodoFormModal';
import CategoryFormModal from './CategoryFormModal';

const DEBOUNCE_DELAY_MS = 300;
const PAGE_SIZE = 100;
const DEFAULT_PRIORITY = '中';
const DEFAULT_STATUS = '待办';
const DEFAULT_CATEGORY_COLOR = '#3B82F6';

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

const TodoManagerPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const { searchQuery, isSearchActive } = useNavSearch();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [categories, setCategories] = useState<TodoCategory[]>([]);
  const [activeTab, setActiveTab] = useState<'in_progress' | 'completed' | 'all'>('in_progress');
  const [showAddTodoModal, setShowAddTodoModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingCategory, setEditingCategory] = useState<TodoCategory | null>(null);
  const [newCategoryColor, setNewCategoryColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [newCategoryName, setNewCategoryName] = useState('');

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

  const [newTodo, setNewTodo] = useState<CreateTodoRequest & { category_id: string | null }>({
    title: '',
    description: '',
    due_date: '',
    priority: DEFAULT_PRIORITY,
    status: DEFAULT_STATUS,
    category_id: null
  });

  const debouncedLoadTodosRef = useRef<(() => void) | null>(null);

  const { createTodo, updateTodo, toggleComplete, deleteTodo } = useTodoOperations();
  const { createCategory, updateCategory, deleteCategory } = useCategoryOperations();
  const { contextMenu, handleContextMenu, handleCloseContextMenu, getContextMenuItems } = useTodoContextMenu();

  const loadTodos = useCallback(async () => {
    if (!user) return;

    const categoriesResult = await todoServiceWrapper.category.getCategories(user.id);
    if (categoriesResult.success) {
      setCategories(categoriesResult.data || []);
    }

    let todosResult;
    const finalSearchQuery = isSearchActive && searchQuery.trim() ? searchQuery.trim() : undefined;

    if (finalSearchQuery) {
      todosResult = await todoServiceWrapper.todo.searchTodos(user.id, finalSearchQuery, 1, PAGE_SIZE);
    } else {
      todosResult = await todoServiceWrapper.todo.getTodos(user.id, undefined, 1, PAGE_SIZE);
    }

    if (todosResult.success && todosResult.data) {
      setTodos(todosResult.data.data || []);
    }
  }, [user, isSearchActive, searchQuery]);

  useEffect(() => {
    const handleOpenAddTodo = () => {
      setShowAddTodoModal(true);
    };
    window.electron?.onOpenAddTodo(handleOpenAddTodo);
    return () => {
      window.electron?.onOpenAddTodo(() => {});
    };
  }, []);

  useEffect(() => {
    debouncedLoadTodosRef.current = debounce(() => {
      loadTodos();
    }, DEBOUNCE_DELAY_MS);
  }, [loadTodos]);

  useEffect(() => {
    if (debouncedLoadTodosRef.current) {
      debouncedLoadTodosRef.current();
    }
    return () => {
      debouncedLoadTodosRef.current = null;
    };
  }, [searchQuery, isSearchActive]);

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

  const resetNewTodo = useCallback(() => {
    setNewTodo({
      title: '',
      description: '',
      due_date: '',
      priority: DEFAULT_PRIORITY,
      status: DEFAULT_STATUS,
      category_id: null
    });
  }, []);

  const handleAddTodo = async () => {
    if (!user || !newTodo.title.trim()) return;

    const todoData: CreateTodoRequest = {
      title: newTodo.title,
      description: newTodo.description,
      due_date: newTodo.due_date,
      priority: newTodo.priority,
      status: newTodo.status,
      category_id: newTodo.category_id
    };

    const success = await createTodo(todoData);
    if (success) {
      resetNewTodo();
      setShowAddTodoModal(false);
      loadTodos();
    }
  };

  const handleToggleCompleteLocal = useCallback(async (id: string) => {
    if (!user) return;
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const success = await toggleComplete(id, !todo.is_completed);
    if (success) {
      loadTodos();
    }
  }, [user, todos, toggleComplete, loadTodos]);

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
    if (!user || !editingTodo || !newTodo.title.trim()) return;

    const todoData: CreateTodoRequest = {
      title: newTodo.title,
      description: newTodo.description,
      due_date: newTodo.due_date,
      priority: newTodo.priority,
      status: newTodo.status,
      category_id: newTodo.category_id
    };

    const success = await updateTodo(editingTodo.id, todoData);
    if (success) {
      setEditingTodo(null);
      resetNewTodo();
      setShowAddTodoModal(false);
      loadTodos();
    }
  };

  const handleDeleteTodoLocal = useCallback(async (id: string) => {
    const success = await deleteTodo(id);
    if (success) {
      loadTodos();
    }
  }, [deleteTodo, loadTodos]);

  const handleAddCategory = async () => {
    if (!user || !newCategoryName.trim()) return;

    const categoryData: CreateTodoCategoryRequest = {
      name: newCategoryName,
      color: newCategoryColor,
      parent_id: null
    };

    const success = await createCategory(categoryData);
    if (success) {
      setNewCategoryName('');
      setNewCategoryColor(DEFAULT_CATEGORY_COLOR);
      setShowCategoryModal(false);
      loadTodos();
    }
  };

  const handleEditCategory = useCallback((category: TodoCategory) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryColor(category.color || DEFAULT_CATEGORY_COLOR);
    setShowCategoryModal(true);
  }, []);

  const handleSaveCategoryEdit = async () => {
    if (!user || !editingCategory || !newCategoryName.trim()) return;

    const categoryData: CreateTodoCategoryRequest = {
      name: newCategoryName,
      color: newCategoryColor,
      parent_id: null
    };

    const success = await updateCategory(editingCategory.id, categoryData);
    if (success) {
      setEditingCategory(null);
      setNewCategoryName('');
      setShowCategoryModal(false);
      loadTodos();
    }
  };

  const handleDeleteCategoryLocal = useCallback(async (id: string) => {
    const success = await deleteCategory(id);
    if (success) {
      loadTodos();
    }
  }, [deleteCategory, loadTodos]);

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

  const contextMenuItems = useMemo(() => getContextMenuItems(
    todos,
    categories,
    handleEditTodo,
    handleToggleCompleteLocal,
    handleDeleteTodoLocal,
    handleEditCategory,
    handleDeleteCategoryLocal,
    handleOpenConfirmDialog,
    handleCloseContextMenu,
    () => setShowAddTodoModal(true),
    () => setShowCategoryModal(true)
  ), [todos, categories, handleEditTodo, handleToggleCompleteLocal, handleDeleteTodoLocal, handleEditCategory, handleDeleteCategoryLocal, handleOpenConfirmDialog, handleCloseContextMenu, getContextMenuItems]);

  if (!user) return null;

  return (
    <div 
      className="h-full flex flex-col p-4 overflow-hidden"
      onContextMenu={(e) => handleContextMenu(e, 'empty')}
      onClick={() => {}}
    >
      <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">我的待办事项</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">管理您的日常任务和分组记录</p>
            </div>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="bg-primary text-button-text px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-primary-hover flex items-center gap-1.5"
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
                    onToggleComplete={handleToggleCompleteLocal}
                    onEditTodo={handleEditTodo}
                    onDeleteTodo={handleDeleteTodoLocal}
                    onEditCategory={handleEditCategory}
                    onDeleteCategory={handleDeleteCategoryLocal}
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
                  onToggleComplete={handleToggleCompleteLocal}
                  onEditTodo={handleEditTodo}
                  onDeleteTodo={handleDeleteTodoLocal}
                  onEditCategory={handleEditCategory}
                  onDeleteCategory={handleDeleteCategoryLocal}
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

      <TodoFormModal
        isOpen={showAddTodoModal}
        onClose={handleCloseAddTodoModal}
        editingTodo={editingTodo}
        newTodo={newTodo}
        categories={categories}
        onNewTodoChange={setNewTodo}
        onConfirm={editingTodo ? handleSaveEdit : handleAddTodo}
        formatDateTimeForInput={formatDateTimeForInput}
      />

      <CategoryFormModal
        isOpen={showCategoryModal}
        onClose={handleCloseCategoryModal}
        editingCategory={editingCategory}
        newCategoryName={newCategoryName}
        newCategoryColor={newCategoryColor}
        categories={categories}
        onNewCategoryNameChange={setNewCategoryName}
        onNewCategoryColorChange={setNewCategoryColor}
        onConfirm={editingCategory ? handleSaveCategoryEdit : handleAddCategory}
        onEditCategory={handleEditCategory}
        onDeleteCategory={handleDeleteCategoryLocal}
        onOpenConfirmDialog={handleOpenConfirmDialog}
      />

      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenuItems}
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

export default React.memo(TodoManagerPage);