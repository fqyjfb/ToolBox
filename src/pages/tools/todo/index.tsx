import React, { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Plus, Edit, Trash2, Calendar, List, Tag, Flag, Clock } from 'lucide-react';
import { todoServiceWrapper, Todo, TodoCategory, CreateTodoRequest, CreateTodoCategoryRequest } from '../../../services/TodoService';
import { useAuthStore } from '../../../store/AuthStore';
import { useToastStore } from '../../../store/toastStore';
import { useNavSearch } from '../../../contexts/NavSearchContext';
import { useTodoNotification } from '../../../contexts/TodoNotificationContext';
import ContextMenu, { ContextMenuItem } from '../../../components/ContextMenu';
import Modal from '../../../components/Modal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import Pagination from '../../../components/Pagination';
import SwitchFilter from '../../../components/SwitchFilter';

const TodoManagerPage: React.FC = () => {
  const admin = useAuthStore((state) => state.admin);
  const addToast = useToastStore((state) => state.addToast);
  const { searchQuery, isSearchActive } = useNavSearch();
  const { refreshCount } = useTodoNotification();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [categories, setCategories] = useState<TodoCategory[]>([]);
  const [filter, setFilter] = useState('pending');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showAddTodoModal, setShowAddTodoModal] = useState(false);
  const [showEditTodoModal, setShowEditTodoModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [previewingTodo, setPreviewingTodo] = useState<Todo | null>(null);
  const [editingCategory, setEditingCategory] = useState<TodoCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
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
  
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: '中' as '高' | '中' | '低',
    status: '待办' as '待办' | '进行中' | '已完成' | '已取消',
    category_id: null as string | null
  });

  useEffect(() => {
    setCurrentPage(1);
    loadTodos(1);
  }, [activeCategory, admin]);

  useEffect(() => {
    loadTodos(currentPage);
  }, [pageSize]);

  useEffect(() => {
    setCurrentPage(1);
    loadTodos(1);
  }, [searchQuery, isSearchActive]);

  const loadTodos = async (pageNum: number = 1) => {
    if (!admin) return;
    
    const categoriesResult = await todoServiceWrapper.category.getCategories(admin.id);
    if (categoriesResult.success) {
      setCategories(categoriesResult.data || []);
    }

    let todosResult;
    if (isSearchActive && searchQuery.trim()) {
      todosResult = await todoServiceWrapper.todo.searchTodos(admin.id, searchQuery.trim(), pageNum, pageSize);
    } else {
      todosResult = await todoServiceWrapper.todo.getTodos(
        admin.id, 
        activeCategory ? { category_id: activeCategory } : undefined,
        pageNum,
        pageSize
      );
    }
    
    if (todosResult.success && todosResult.data) {
      setTodos(todosResult.data.data || []);
      setTotalItems(todosResult.data.total || 0);
      setCurrentPage(pageNum);
    }
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'completed') return todo.is_completed;
    if (filter === 'pending') return !todo.is_completed;
    return true;
  });

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
      setTodos([...todos, result.data!]);
      resetNewTodo();
      setShowAddTodoModal(false);
      addToast({ message: '任务添加成功', type: 'success' });
      refreshCount();
    } else {
      addToast({ message: '添加任务失败', type: 'error' });
    }
  };

  const resetNewTodo = () => {
    setNewTodo({
      title: '',
      description: '',
      due_date: '',
      priority: '中',
      status: '待办',
      category_id: null
    });
  };

  const handleToggleComplete = async (id: string) => {
    if (!admin) return;
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const result = await todoServiceWrapper.todo.updateTodoStatus(admin.id, id, !todo.is_completed);
    if (result.success) {
      setTodos(todos.map(t => t.id === id ? result.data! : t));
      addToast({ message: todo.is_completed ? '任务已取消完成' : '任务已完成', type: 'success' });
      refreshCount();
    } else {
      addToast({ message: '更新任务状态失败', type: 'error' });
    }
  };

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo);
    setNewTodo({
      title: todo.title,
      description: todo.description || '',
      due_date: todo.due_date || '',
      priority: todo.priority,
      status: todo.status,
      category_id: todo.category_id
    });
    setShowEditTodoModal(true);
    handleCloseContextMenu();
  };

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
      setTodos(todos.map(t => t.id === editingTodo.id ? result.data! : t));
      setEditingTodo(null);
      resetNewTodo();
      setShowEditTodoModal(false);
      addToast({ message: '任务修改成功', type: 'success' });
      refreshCount();
    } else {
      addToast({ message: '修改任务失败', type: 'error' });
    }
  };

  const handleDeleteTodo = async (id: string) => {
    if (!admin) return;
    const result = await todoServiceWrapper.todo.deleteTodo(admin.id, id);
    if (result.success) {
      setTodos(todos.filter(todo => todo.id !== id));
      addToast({ message: '任务删除成功', type: 'success' });
      refreshCount();
    } else {
      addToast({ message: '删除任务失败', type: 'error' });
    }
  };

  const handleAddCategory = async () => {
    if (!admin || !newCategoryName.trim()) return;

    const categoryData: CreateTodoCategoryRequest = {
      name: newCategoryName,
      parent_id: null
    };

    const result = await todoServiceWrapper.category.createCategory(admin.id, categoryData);
    if (result.success) {
      setCategories([...categories, result.data!]);
      setNewCategoryName('');
      setShowAddCategoryModal(false);
      addToast({ message: '分类添加成功', type: 'success' });
    } else {
      addToast({ message: '添加分类失败', type: 'error' });
    }
  };

  const handleEditCategory = (category: TodoCategory) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setShowAddCategoryModal(true);
  };

  const handleSaveCategoryEdit = async () => {
    if (!admin || !editingCategory || !newCategoryName.trim()) return;

    const categoryData: CreateTodoCategoryRequest = {
      name: newCategoryName,
      parent_id: null
    };

    const result = await todoServiceWrapper.category.updateCategory(admin.id, editingCategory.id, categoryData);
    if (result.success) {
      setCategories(categories.map(category => category.id === editingCategory.id ? result.data! : category));
      setEditingCategory(null);
      setNewCategoryName('');
      setShowAddCategoryModal(false);
      addToast({ message: '分类修改成功', type: 'success' });
    } else {
      addToast({ message: '修改分类失败', type: 'error' });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!admin) return;
    const result = await todoServiceWrapper.category.deleteCategory(admin.id, id);
    if (result.success) {
      setCategories(categories.filter(category => category.id !== id));
      setTodos(todos.map(todo => 
        todo.category_id === id ? { ...todo, category_id: null } : todo
      ));
      if (activeCategory === id) {
        setActiveCategory(null);
      }
      addToast({ message: '分类删除成功', type: 'success' });
    } else {
      addToast({ message: '删除分类失败', type: 'error' });
    }
  };

  const getCategoryName = (category_id: string | null) => {
    if (!category_id) return '未分类';
    const category = categories.find(c => c.id === category_id);
    return category ? category.name : '未分类';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '高': return 'text-red-600 dark:text-red-300 bg-red-100 dark:bg-red-900/30';
      case '中': return 'text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30';
      case '低': return 'text-green-600 dark:text-green-300 bg-green-100 dark:bg-green-900/30';
      default: return 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800';
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
            setShowAddCategoryModal(true);
            handleCloseContextMenu();
          }
        }
      ];
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, todos, categories, handleEditTodo, handleToggleComplete, handleDeleteTodo, handleEditCategory, handleDeleteCategory, handleCloseContextMenu, handleOpenConfirmDialog]);

  const handleCloseAddTodoModal = () => {
    setShowAddTodoModal(false);
    resetNewTodo();
  };

  const handleCloseEditTodoModal = () => {
    setShowEditTodoModal(false);
    setEditingTodo(null);
    resetNewTodo();
  };

  const handleCloseCategoryModal = () => {
    setShowAddCategoryModal(false);
    setNewCategoryName('');
    setEditingCategory(null);
  };

  const handleDeleteCategoryFromModal = (categoryId: string) => {
    handleOpenConfirmDialog('删除确认', '确定要删除这个分类吗？', () => {
      handleDeleteCategory(categoryId);
      handleCloseCategoryModal();
    });
  };

  return (
    <div 
      className="h-full flex flex-col p-6 overflow-hidden"
      onContextMenu={(e) => handleContextMenu(e, 'empty')}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col h-full">
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  activeCategory === null 
                    ? 'bg-gray-800 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                全部
              </button>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  onContextMenu={(e) => handleContextMenu(e, 'category', category.id)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors flex items-center gap-1 ${
                    activeCategory === category.id 
                      ? 'bg-gray-800 text-white' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Tag size={12} />
                  {category.name}
                </button>
              ))}
              <button
                onClick={() => setShowAddCategoryModal(true)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="添加分类"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex gap-3 items-center">
              <SwitchFilter
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: '全部' },
                  { value: 'pending', label: '未完成' },
                  { value: 'completed', label: '已完成' },
                ]}
              />
              <button
                onClick={() => setShowAddTodoModal(true)}
                className="p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <style>{`
          .todo-card-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 16px;
            align-content: flex-start;
            height: 100%;
            overflow-y: auto;
            padding: 8px;
          }
          .todo-card {
            position: relative;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.4s ease-in-out;
            height: 185px;
            display: flex;
            flex-direction: column;
            background-color: var(--color-card);
          }
          .todo-card::before {
            content: '';
            position: absolute;
            top: -90px;
            right: -85px;
            width: 170px;
            height: 170px;
            background: var(--color-primary);
            border-radius: 50%;
            z-index: 0;
            transition: all 0.5s ease-in-out;
            opacity: 0.8;
          }
          .todo-card:hover::before {
            width: 900px;
            height: 900px;
          }
          .todo-card:hover {
            transform: scale(1.02);
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.27);
          }
          .todo-card-content-inner {
            position: relative;
            z-index: 1;
            transition: all 0.5s ease-in-out;
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 0;
            color: var(--color-text-secondary);
          }
          .todo-card-body-inner {
            flex: 1;
            overflow: hidden;
          }
          .todo-meta {
            color: var(--color-text-secondary);
          }
          .todo-title {
            color: var(--color-text-primary);
          }
          .todo-title.line-through {
            color: var(--color-text-tertiary);
          }
          .todo-description-inner {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: normal;
            max-height: 54px;
            line-height: 18px;
            color: var(--color-text-secondary);
          }
          .todo-description-inner.line-through {
            color: var(--color-text-tertiary);
          }
          .todo-card-btn {
            color: var(--color-text-secondary);
            transition: all 0.2s ease;
          }
          .todo-card:hover .todo-card-content-inner,
          .todo-card:hover .todo-meta,
          .todo-card:hover .todo-title,
          .todo-card:hover .todo-description-inner,
          .todo-card:hover .todo-card-btn {
            color: var(--color-bg-primary) !important;
          }
          .todo-card:hover .todo-priority {
            background: rgba(255, 255, 255, 0.3);
            color: var(--color-bg-primary) !important;
          }
          .todo-number {
            position: absolute;
            top: -95px;
            right: -90px;
            width: 170px;
            height: 170px;
            display: flex;
            align-items: flex-end;
            justify-content: flex-start;
            padding: 80px 100px 30px 30px;
            z-index: 1;
            opacity: 0.3;
          }
          .todo-card:hover .todo-number {
            opacity: 1;
          }
          .todo-number-text {
            font-size: 22px;
            font-weight: 600;
            color: white;
          }
          .todo-card:hover .todo-number-text {
            color: #275D7E;
          }
          .dark .todo-card:hover .todo-number-text {
            color: #f9fafb;
          }
          .todo-card-actions-inner {
            border-top: 1px solid var(--color-border);
            padding-top: 4px;
            margin-top: 4px;
          }
          .todo-card-btn:hover {
            background-color: rgba(209, 213, 219, 0.5);
          }
          .dark .todo-card-btn:hover {
            background-color: rgba(107, 114, 128, 0.5);
          }
          .todo-card:hover .todo-card-btn:hover {
            background-color: rgba(0, 0, 0, 0.15);
          }
        `}</style>
        <div className="todo-card-container">
          {filteredTodos.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16">
              <CheckSquare className="w-10 h-10 text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">暂无任务</p>
            </div>
          ) : (
            filteredTodos.map((todo, index) => (
              <div 
                key={todo.id} 
                className="todo-card bg-gray-50 dark:bg-gray-700 rounded-lg shadow-md px-4 pt-4 pb-2.5 border border-gray-200 dark:border-gray-600 cursor-pointer"
                onContextMenu={(e) => handleContextMenu(e, 'item', todo.id)}
                onClick={() => {
                  setPreviewingTodo(todo);
                  setShowPreviewModal(true);
                }}
              >
                <div className="todo-number">
                  <span className="todo-number-text">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className="todo-card-content-inner">
                  <div className="todo-card-body-inner">
                    <div className="todo-meta flex flex-wrap items-center text-xs gap-2 mb-1.5">
                      <div className="flex items-center">
                        <List className="w-3 h-3 mr-1" />
                        <span>{getCategoryName(todo.category_id)}</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>{new Date(todo.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`todo-priority text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${getPriorityColor(todo.priority)}`}>
                        {todo.priority}
                      </span>
                      <h3 className={`todo-title text-sm font-semibold flex-1 ${todo.is_completed ? 'line-through' : ''}`}>
                        {todo.title}
                      </h3>
                    </div>
                    
                    {todo.description && (
                      <p className={`todo-description-inner text-xs ${todo.is_completed ? 'line-through' : ''}`}>
                        {todo.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="todo-card-actions-inner flex">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditTodo(todo); }} 
                      className="todo-card-btn flex-1 flex items-center justify-center gap-1 py-1.5"
                    >
                      <Edit className="w-3 h-3" />
                      <span className="text-xs">编辑</span>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleToggleComplete(todo.id); }} 
                      className="todo-card-btn flex-1 flex items-center justify-center gap-1 py-1.5"
                    >
                      <CheckSquare className={`w-3 h-3 ${todo.is_completed ? 'fill-current' : ''}`} />
                      <span className="text-xs">{todo.is_completed ? '取消' : '完成'}</span>
                    </button>
                  </div>
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
            onPageChange={loadTodos}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <Modal
        isOpen={showAddTodoModal}
        onClose={handleCloseAddTodoModal}
        title="添加新任务"
        confirmText="添加"
        onConfirm={handleAddTodo}
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
              <option value="">全部</option>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">状态</label>
              <select
                value={newTodo.status}
                onChange={(e) => setNewTodo({ ...newTodo, status: e.target.value as '待办' | '进行中' | '已完成' | '已取消' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
              >
                <option value="待办">待办</option>
                <option value="进行中">进行中</option>
                <option value="已完成">已完成</option>
                <option value="已取消">已取消</option>
              </select>
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
        isOpen={showEditTodoModal}
        onClose={handleCloseEditTodoModal}
        title="编辑任务"
        confirmText="保存"
        onConfirm={handleSaveEdit}
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
              <option value="">全部</option>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">状态</label>
              <select
                value={newTodo.status}
                onChange={(e) => setNewTodo({ ...newTodo, status: e.target.value as '待办' | '进行中' | '已完成' | '已取消' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
              >
                <option value="待办">待办</option>
                <option value="进行中">进行中</option>
                <option value="已完成">已完成</option>
                <option value="已取消">已取消</option>
              </select>
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
        isOpen={showAddCategoryModal}
        onClose={handleCloseCategoryModal}
        title={editingCategory ? '编辑分类' : '管理分类'}
        confirmText={editingCategory ? '保存' : '添加分类'}
        onConfirm={editingCategory ? handleSaveCategoryEdit : handleAddCategory}
        confirmDisabled={!newCategoryName.trim()}
      >
        <div className="space-y-4">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="分类名称"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none dark:bg-gray-700 dark:text-white"
          />
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">现有分类</h3>
            <div className="space-y-2">
              {categories.map(category => (
                <div key={category.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <span className="text-sm text-gray-800 dark:text-white">{category.name}</span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="p-1 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategoryFromModal(category.id)}
                      className="p-1 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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

      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="任务详情"
        showCancel={false}
        showConfirm={false}
        size="lg"
        clickOutsideToClose={true}
      >
        {previewingTodo && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className={`text-lg font-semibold text-gray-900 dark:text-white flex-1 ${previewingTodo.is_completed ? 'line-through opacity-60' : ''}`}>
                {previewingTodo.title}
              </h2>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                previewingTodo.is_completed 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {previewingTodo.is_completed ? '已完成' : '未完成'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300`}>
                <List className="w-3.5 h-3.5" />
                {getCategoryName(previewingTodo.category_id)}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${getPriorityColor(previewingTodo.priority)}`}>
                <Flag className="w-3.5 h-3.5" />
                {previewingTodo.priority}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                previewingTodo.status === '已完成' 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                  : previewingTodo.status === '进行中'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : previewingTodo.status === '已取消'
                  ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                {previewingTodo.status}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(previewingTodo.created_at).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            </div>

            {previewingTodo.description && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className={`text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap ${previewingTodo.is_completed ? 'line-through opacity-60' : ''}`}>
                  {previewingTodo.description}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TodoManagerPage;
