import React from 'react';
import { FolderOpen, Folder, MoreVertical, CheckSquare, Clock, AlertCircle, Edit, Trash2, Plus } from 'lucide-react';
import { Todo, TodoCategory } from '../../services/TodoService';

const MAX_TODO_LIST_HEIGHT = '220px';

interface TodoCardProps {
  category: { id: string; name: string };
  todos: Todo[];
  color: string;
  onContextMenu: (e: React.MouseEvent, type: 'item' | 'category', targetId?: string) => void;
  onToggleComplete: (id: string) => void;
  onEditTodo: (todo: Todo) => void;
  onDeleteTodo: (id: string) => void;
  onEditCategory: (category: TodoCategory) => void;
  onDeleteCategory: (id: string) => void;
  onOpenConfirmDialog: (title: string, message: string, onConfirm: () => void) => void;
  onAddTodo: (categoryId: string | null) => void;
  categories: TodoCategory[];
}

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case '高':
      return 'text-red-500';
    case '中':
      return 'text-yellow-500';
    case '低':
      return 'text-green-500';
    default:
      return 'text-gray-400';
  }
};



const formatTime = (
  dueDate?: string | null,
  isCompleted?: boolean
): { text: string; status: 'overdue' | 'today' | 'tomorrow' | 'later' } | null => {
  if (!dueDate) return null;
  
  const date = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0 && !isCompleted) {
    return { text: '已逾期', status: 'overdue' };
  } else if (diffDays === 0) {
    return { text: '今天', status: 'today' };
  } else if (diffDays === 1) {
    return { text: '明天', status: 'tomorrow' };
  } else {
    return { text: `${date.getMonth() + 1}月${date.getDate()}日`, status: 'later' };
  }
};

const TodoCard: React.FC<TodoCardProps> = ({
  category,
  todos,
  color,
  onContextMenu,
  onToggleComplete,
  onEditTodo,
  onDeleteTodo,
  onEditCategory,
  onDeleteCategory,
  onOpenConfirmDialog,
  onAddTodo,
  categories
}) => {
  const pendingCount = todos.filter(t => !t.is_completed).length;
  
  const sortedTodos = [...todos].sort((a, b) => {
    if (a.is_completed && !b.is_completed) return 1;
    if (!a.is_completed && b.is_completed) return -1;
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  return (
    <div 
      className="rounded-xl p-5 flex flex-col h-fit bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      onContextMenu={(e) => category.id !== 'uncategorized' && onContextMenu(e, 'category', category.id)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {category.id === 'uncategorized' ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
          </div>
          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
            {category.name}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span 
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {pendingCount} 个待办
          </span>
          {category.id !== 'uncategorized' && (
            <div className="relative group">
              <button className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-full mt-1 w-32 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                <button
                  onClick={() => {
                    const found = categories.find(c => c.id === category.id);
                    if (found) onEditCategory(found);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  编辑分类
                </button>
                <button
                  onClick={() => onOpenConfirmDialog('删除确认', `确定要删除分类「${category.name}」吗？该分类下的所有待办事项也将被删除。`, () => onDeleteCategory(category.id))}
                  className="w-full px-3 py-1.5 text-left text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  删除分类
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 overflow-y-auto pr-1" style={{ maxHeight: MAX_TODO_LIST_HEIGHT }}>
        {sortedTodos.map((todo) => {
          const isCompleted = todo.is_completed;
          const timeInfo = formatTime(todo.due_date, isCompleted);

          return (
            <div 
              key={todo.id} 
              className="flex items-start gap-3 group"
              onContextMenu={(e) => onContextMenu(e, 'item', todo.id)}
            >
              <button
                onClick={() => !isCompleted && onToggleComplete(todo.id)}
                disabled={isCompleted}
                className={`mt-1 w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                  isCompleted
                    ? 'bg-green-500 border-green-500 cursor-default'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-blue-500 cursor-pointer'
                }`}
              >
                {isCompleted && <CheckSquare className="w-3 h-3 text-white" />}
              </button>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium cursor-pointer transition-colors ${
                    isCompleted
                      ? 'line-through text-gray-400 dark:text-gray-500'
                      : 'text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'
                  }`}
                  onClick={() => onEditTodo(todo)}
                >
                  {todo.title}
                </p>

                {todo.description && (
                  <p className={`text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 ${isCompleted ? 'line-through' : ''}`}>
                    {todo.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-2xs font-medium ${getPriorityColor(todo.priority)}`}>
                    {todo.priority}
                  </span>
                  {timeInfo && (
                    <span
                      className={`text-2xs flex items-center gap-1 ${
                        timeInfo.status === 'overdue'
                          ? 'text-red-500'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {timeInfo.status === 'overdue' ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      {timeInfo.text}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEditTodo(todo)}
                  className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onOpenConfirmDialog('删除确认', '确定要删除这个任务吗？', () => onDeleteTodo(todo.id))}
                  className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {sortedTodos.length === 0 && (
          <div className="py-4 text-center text-gray-400 dark:text-gray-500 text-sm">
            暂无待办事项
          </div>
        )}
      </div>

      <button
        onClick={() => {
          onAddTodo(category.id === 'uncategorized' ? null : category.id);
        }}
        className="mt-4 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
      >
        <Plus className="w-3 h-3" />
        添加待办
      </button>
    </div>
  );
};

export default TodoCard;