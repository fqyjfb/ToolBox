import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus } from 'lucide-react';
import {
  todoServiceWrapper,
  Todo,
  TodoCategory,
  CreateTodoRequest,
  CreateTodoCategoryRequest,
} from '../../../services/TodoService';
import { useAuthStore } from '../../../store/AuthStore';
import { useNavSearch } from '../../../contexts/NavSearchContext';
import ContextMenu from '../../../components/ui/ContextMenu';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import type { TodoBoardItem, TodoCardHandlers } from '../../../components/ui/TodoCard';
import { debounce } from '../../../utils';
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_PRIORITY,
  DEFAULT_STATUS,
  TODO_DEBOUNCE_MS,
  TODO_PAGE_SIZE,
  TODO_TABS,
  UNCATEGORIZED_COLOR,
  UNCATEGORIZED_ID,
  UNCATEGORIZED_NAME,
} from '../../../constants/todo';
import type { TodoTab } from '../../../constants/todo';
import { useTodoOperations } from './useTodoOperations';
import { useCategoryOperations } from './useCategoryOperations';
import { useTodoContextMenu } from './useTodoContextMenu';
import type { TodoContextMenuHandlers } from './useTodoContextMenu';
import TodoBoard from './TodoBoard';
import TodoFormModal from './TodoFormModal';
import CategoryFormModal from './CategoryFormModal';

const EMPTY_TODO_FORM: CreateTodoRequest & { category_id: string | null } = {
  title: '',
  description: '',
  due_date: '',
  priority: DEFAULT_PRIORITY,
  status: DEFAULT_STATUS,
  category_id: null,
};

const groupByCategory = (todos: Todo[]): Record<string, Todo[]> => {
  const grouped: Record<string, Todo[]> = {};
  todos.forEach(todo => {
    const categoryId = todo.category_id || UNCATEGORIZED_ID;
    if (!grouped[categoryId]) grouped[categoryId] = [];
    grouped[categoryId].push(todo);
  });
  return grouped;
};

/**
 * 构造看板分组。
 * 分类卡片的可见性与页签解耦：非搜索态始终展示所有分类，页签只决定分类内展示哪些任务
 * （否则「未完成」页签下把任务全部勾完时，整个分类卡片会消失）；
 * 搜索态下仍只展示命中的分类，避免刷出一屏空卡片。
 */
const buildBoards = (
  categories: TodoCategory[],
  filteredTodos: Todo[],
  isSearching: boolean
): TodoBoardItem[] => {
  const grouped = groupByCategory(filteredTodos);

  const boards = (isSearching ? categories.filter(c => (grouped[c.id]?.length ?? 0) > 0) : categories)
    .map<TodoBoardItem>(category => ({
      id: category.id,
      name: category.name,
      color: category.color || DEFAULT_CATEGORY_COLOR,
      todos: grouped[category.id] || [],
      isUncategorized: false,
    }));

  if (grouped[UNCATEGORIZED_ID]?.length) {
    boards.push({
      id: UNCATEGORIZED_ID,
      name: UNCATEGORIZED_NAME,
      color: UNCATEGORIZED_COLOR,
      todos: grouped[UNCATEGORIZED_ID],
      isUncategorized: true,
    });
  }

  return boards;
};

const TodoManagerPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const { searchQuery, isSearchActive, clearSearch } = useNavSearch();

  const searchKeyword = isSearchActive ? searchQuery.trim() : '';
  const isSearching = searchKeyword.length > 0;

  const [todos, setTodos] = useState<Todo[]>([]);
  const [categories, setCategories] = useState<TodoCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TodoTab>('in_progress');
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
    onConfirm: () => {},
  });

  const [newTodo, setNewTodo] = useState<CreateTodoRequest & { category_id: string | null }>(EMPTY_TODO_FORM);

  const todosRef = useRef<Todo[]>(todos);
  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  const { createTodo, updateTodo, toggleComplete, deleteTodo } = useTodoOperations();
  const { createCategory, updateCategory, deleteCategory } = useCategoryOperations();
  const { contextMenu, handleContextMenu, handleCloseContextMenu, getContextMenuItems } = useTodoContextMenu();

  const loadTodos = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const categoriesResult = await todoServiceWrapper.category.getCategories(user.id);
      if (categoriesResult.success) {
        setCategories(categoriesResult.data || []);
      }

      let todosResult;
      if (isSearching) {
        todosResult = await todoServiceWrapper.todo.searchTodos(user.id, searchKeyword, 1, TODO_PAGE_SIZE);
      } else {
        todosResult = await todoServiceWrapper.todo.getTodos(user.id, undefined, 1, TODO_PAGE_SIZE);
      }

      if (todosResult.success && todosResult.data) {
        setTodos(todosResult.data.data || []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, isSearching, searchKeyword]);

  const openCreateCategoryModal = useCallback(() => {
    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategoryColor(DEFAULT_CATEGORY_COLOR);
    setShowCategoryModal(true);
  }, []);

  const handleAddTodoWithCategory = useCallback((categoryId: string | null) => {
    setNewTodo({ ...EMPTY_TODO_FORM, category_id: categoryId });
    setShowAddTodoModal(true);
  }, []);

  const openAddTodoModal = useCallback(() => {
    handleAddTodoWithCategory(null);
  }, [handleAddTodoWithCategory]);

  useEffect(() => {
    window.electron?.onOpenAddTodo(openAddTodoModal);
    return () => {
      // 预加载实现为单回调槽位，传入空实现即等价于取消订阅
      window.electron?.onOpenAddTodo(() => {});
    };
  }, [openAddTodoModal]);

  const debouncedLoadTodosRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    debouncedLoadTodosRef.current = debounce(() => {
      loadTodos();
    }, TODO_DEBOUNCE_MS);
  }, [loadTodos]);

  useEffect(() => {
    if (debouncedLoadTodosRef.current) {
      debouncedLoadTodosRef.current();
    }
    return () => {
      debouncedLoadTodosRef.current = null;
    };
  }, [searchKeyword]);

  const filteredTodos = useMemo(() => {
    if (activeTab === 'completed') return todos.filter(t => t.is_completed);
    if (activeTab === 'in_progress') return todos.filter(t => !t.is_completed);
    return todos;
  }, [todos, activeTab]);

  const boards = useMemo(
    () => buildBoards(categories, filteredTodos, isSearching),
    [categories, filteredTodos, isSearching]
  );

  const inProgressCount = todos.filter(t => !t.is_completed).length;
  const completedCount = todos.filter(t => t.is_completed).length;

  const tabCounts: Record<TodoTab, number> = {
    in_progress: inProgressCount,
    completed: completedCount,
    all: todos.length,
  };

  const resetNewTodo = useCallback(() => {
    setNewTodo(EMPTY_TODO_FORM);
  }, []);

  const handleAddTodo = async () => {
    if (!user || !newTodo.title.trim()) return;

    const success = await createTodo(newTodo);
    if (success) {
      resetNewTodo();
      setShowAddTodoModal(false);
      loadTodos();
    }
  };

  const handleToggleCompleteLocal = useCallback(async (id: string) => {
    if (!user) return;
    const todo = todosRef.current.find(t => t.id === id);
    if (!todo) return;

    const nextCompleted = !todo.is_completed;
    const success = await toggleComplete(id, nextCompleted);
    if (!success) return;

    // 服务端已更新成功，直接同步本地状态，避免整表重拉造成的闪烁
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, is_completed: nextCompleted } : t)));
  }, [user, toggleComplete]);

  const handleEditTodo = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setNewTodo({
      title: todo.title,
      description: todo.description || '',
      due_date: todo.due_date || '',
      priority: todo.priority,
      status: todo.status,
      category_id: todo.category_id,
    });
    setShowAddTodoModal(true);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleSaveEdit = async () => {
    if (!user || !editingTodo || !newTodo.title.trim()) return;

    const success = await updateTodo(editingTodo.id, newTodo);
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
      parent_id: null,
    };

    const success = await createCategory(categoryData);
    if (success) {
      setNewCategoryName('');
      setNewCategoryColor(DEFAULT_CATEGORY_COLOR);
      setShowCategoryModal(false);
      loadTodos();
    }
  };

  const handleEditCategory = useCallback((id: string) => {
    const found = categories.find(c => c.id === id);
    if (!found) return;

    setEditingCategory(found);
    setNewCategoryName(found.name);
    setNewCategoryColor(found.color || DEFAULT_CATEGORY_COLOR);
    setShowCategoryModal(true);
  }, [categories]);

  const handleSaveCategoryEdit = async () => {
    if (!user || !editingCategory || !newCategoryName.trim()) return;

    const categoryData: CreateTodoCategoryRequest = {
      name: newCategoryName,
      color: newCategoryColor,
      parent_id: null,
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
      onConfirm,
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

  const cardHandlers = useMemo<TodoCardHandlers>(() => ({
    onContextMenu: handleContextMenu,
    onToggleComplete: handleToggleCompleteLocal,
    onEditTodo: handleEditTodo,
    onDeleteTodo: handleDeleteTodoLocal,
    onEditCategory: handleEditCategory,
    onDeleteCategory: handleDeleteCategoryLocal,
    onOpenConfirmDialog: handleOpenConfirmDialog,
    onAddTodo: handleAddTodoWithCategory,
  }), [
    handleContextMenu,
    handleToggleCompleteLocal,
    handleEditTodo,
    handleDeleteTodoLocal,
    handleEditCategory,
    handleDeleteCategoryLocal,
    handleOpenConfirmDialog,
    handleAddTodoWithCategory,
  ]);

  const contextMenuHandlers = useMemo<TodoContextMenuHandlers>(() => ({
    onEditTodo: handleEditTodo,
    onToggleComplete: handleToggleCompleteLocal,
    onDeleteTodo: handleDeleteTodoLocal,
    onEditCategory: handleEditCategory,
    onDeleteCategory: handleDeleteCategoryLocal,
    onOpenConfirmDialog: handleOpenConfirmDialog,
    onCloseContextMenu: handleCloseContextMenu,
    onShowAddTodoModal: openAddTodoModal,
    onShowCategoryModal: openCreateCategoryModal,
  }), [
    handleEditTodo,
    handleToggleCompleteLocal,
    handleDeleteTodoLocal,
    handleEditCategory,
    handleDeleteCategoryLocal,
    handleOpenConfirmDialog,
    handleCloseContextMenu,
    openAddTodoModal,
    openCreateCategoryModal,
  ]);

  const contextMenuItems = useMemo(
    () => getContextMenuItems(todos, categories, contextMenuHandlers),
    [todos, categories, contextMenuHandlers, getContextMenuItems]
  );

  if (!user) return null;

  // 仅在首次加载（本地无任何数据）时展示骨架，避免搜索时闪烁
  const showSkeleton = isLoading && categories.length === 0 && todos.length === 0;

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      onContextMenu={(e) => handleContextMenu(e, 'empty')}
    >
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-text-primary mb-1">我的待办事项</h3>
            <p className="text-xs text-text-secondary">管理您的日常任务和分组记录</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openAddTodoModal}
              className="bg-primary text-button-text px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-primary-hover flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              新建任务
            </button>
            <button
              type="button"
              onClick={openCreateCategoryModal}
              className="border border-border text-text-secondary px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-bg-tertiary flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              新建分类
            </button>
          </div>
        </div>

        <div className="flex gap-4 border-b border-border mb-4">
          {TODO_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`pb-2 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-primary text-primary'
                  : 'border-b-2 border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label} ({tabCounts[tab.key]})
            </button>
          ))}
        </div>

        <TodoBoard
          boards={boards}
          isLoading={showSkeleton}
          isEmptySearch={isSearching && boards.length === 0}
          searchKeyword={searchKeyword}
          activeTab={activeTab}
          handlers={cardHandlers}
          onCreateCategory={openCreateCategoryModal}
          onClearSearch={clearSearch}
        />
      </div>

      <TodoFormModal
        isOpen={showAddTodoModal}
        onClose={handleCloseAddTodoModal}
        editingTodo={editingTodo}
        newTodo={newTodo}
        categories={categories}
        onNewTodoChange={setNewTodo}
        onConfirm={editingTodo ? handleSaveEdit : handleAddTodo}
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

export default TodoManagerPage;
