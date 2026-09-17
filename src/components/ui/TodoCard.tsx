import React, { useMemo } from 'react';
import { FolderOpen, Folder, MoreVertical, CheckSquare, Clock, AlertCircle, Edit, Trash2, Plus } from 'lucide-react';
import { Todo } from '../../services/TodoService';
import { PRIORITY_WEIGHT, getDeleteCategoryMessage } from '../../constants/todo';
import type { TodoTab } from '../../constants/todo';

/** 一个分组卡片所需的全部数据（已包含未分类虚拟分组） */
export interface TodoBoardItem {
  id: string;
  name: string;
  /** 分类色，须为 6 位 HEX（卡片会追加透明度后缀） */
  color: string;
  todos: Todo[];
  isUncategorized: boolean;
}

/** 卡片对外交互回调集合 */
export interface TodoCardHandlers {
  onContextMenu: (e: React.MouseEvent, type: 'item' | 'category', targetId?: string) => void;
  onToggleComplete: (id: string) => void;
  onEditTodo: (todo: Todo) => void;
  onDeleteTodo: (id: string) => void;
  onEditCategory: (id: string) => void;
  onDeleteCategory: (id: string) => void;
  onOpenConfirmDialog: (title: string, message: string, onConfirm: () => void) => void;
  onAddTodo: (categoryId: string | null) => void;
}

interface TodoCardProps {
  board: TodoBoardItem;
  handlers: TodoCardHandlers;
  activeTab: TodoTab;
}

const PRIORITY_DOT: Record<Todo['priority'], string> = {
  高: 'bg-error',
  中: 'bg-warning',
  低: 'bg-success',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type TimeInfo = { text: string; status: 'overdue' | 'today' | 'tomorrow' | 'later' };

/** 'YYYY-MM-DD HH:mm' 在部分引擎下解析不稳定，统一转为本地 ISO 后再解析 */
const parseDueDate = (dueDate: string): Date | null => {
  const date = new Date(dueDate.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDueTime = (dueDate?: string | null): number => {
  if (!dueDate) return Number.POSITIVE_INFINITY;
  return parseDueDate(dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
};

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const formatTime = (dueDate?: string | null, isCompleted?: boolean): TimeInfo | null => {
  if (!dueDate) return null;
  const date = parseDueDate(dueDate);
  if (!date) return null;

  const diffDays = Math.floor((startOfDay(date) - startOfDay(new Date())) / MS_PER_DAY);
  if (diffDays < 0 && !isCompleted) {
    return { text: '已逾期', status: 'overdue' };
  }

  // 截止时间精确到分钟时补充展示，避免同一天的任务无法区分先后
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  const timeText = hasTime
    ? ` ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    : '';

  if (diffDays === 0) return { text: `今天${timeText}`, status: 'today' };
  if (diffDays === 1) return { text: `明天${timeText}`, status: 'tomorrow' };
  return { text: `${date.getMonth() + 1}月${date.getDate()}日${timeText}`, status: 'later' };
};

const TodoCard: React.FC<TodoCardProps> = ({ board, handlers, activeTab }) => {
  const pendingCount = board.todos.filter(t => !t.is_completed).length;

  const sortedTodos = useMemo(() => [...board.todos].sort((a, b) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;

    const weightDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (weightDiff !== 0) return weightDiff;

    const timeA = getDueTime(a.due_date);
    const timeB = getDueTime(b.due_date);
    if (timeA !== timeB) return timeA - timeB;
    return 0;
  }), [board.todos]);

  return (
    <div
      className="rounded-xl p-4 flex flex-col h-fit bg-card border border-border shadow-sm"
      onContextMenu={(e) => !board.isUncategorized && handlers.onContextMenu(e, 'category', board.id)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${board.color}20`, color: board.color }}
          >
            {board.isUncategorized ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
          </div>
          <h4 className="text-sm font-semibold text-text-primary truncate" title={board.name}>
            {board.name}
          </h4>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${board.color}15`, color: board.color }}
          >
            {activeTab === 'completed' ? `${board.todos.length} 项已完成` : `${pendingCount} 个待办`}
          </span>
          {!board.isUncategorized && (
            <div className="relative group">
              <button
                type="button"
                aria-label={`${board.name} 的分组操作`}
                title="分组操作"
                className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-full mt-1 w-32 py-1 rounded-lg bg-bg-primary border border-border shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all z-20">
                <button
                  type="button"
                  onClick={() => handlers.onEditCategory(board.id)}
                  className="w-full px-3 py-1.5 text-left text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
                >
                  编辑分类
                </button>
                <button
                  type="button"
                  onClick={() => handlers.onOpenConfirmDialog(
                    '删除确认',
                    getDeleteCategoryMessage(board.name),
                    () => handlers.onDeleteCategory(board.id)
                  )}
                  className="w-full px-3 py-1.5 text-left text-sm text-error hover:bg-bg-tertiary transition-colors"
                >
                  删除分类
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto pr-1 max-h-todo-card">
        {sortedTodos.map((todo) => {
          const isCompleted = todo.is_completed;
          const timeInfo = formatTime(todo.due_date, isCompleted);

          return (
            <div
              key={todo.id}
              className="flex items-start gap-2.5 group"
              onContextMenu={(e) => handlers.onContextMenu(e, 'item', todo.id)}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={isCompleted}
                aria-label={isCompleted ? `取消完成：${todo.title}` : `标记完成：${todo.title}`}
                onClick={() => handlers.onToggleComplete(todo.id)}
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer ${
                  isCompleted
                    ? 'bg-success border-success'
                    : 'bg-bg-primary border-border hover:border-primary'
                }`}
              >
                {isCompleted && <CheckSquare className="w-3 h-3 text-white" />}
              </button>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium cursor-pointer transition-colors ${
                    isCompleted
                      ? 'line-through text-text-tertiary'
                      : 'text-text-primary group-hover:text-info'
                  }`}
                  onClick={() => handlers.onEditTodo(todo)}
                >
                  {todo.title}
                </p>

                {todo.description && (
                  <p className={`text-xs text-text-secondary truncate mt-0.5 ${isCompleted ? 'line-through' : ''}`}>
                    {todo.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs flex items-center gap-1 text-text-secondary">
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[todo.priority]}`} />
                    {todo.priority}
                  </span>
                  {timeInfo && (
                    <span
                      className={`text-xs flex items-center gap-1 ${
                        timeInfo.status === 'overdue' ? 'text-error' : 'text-text-tertiary'
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

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex-shrink-0">
                <button
                  type="button"
                  aria-label={`编辑任务：${todo.title}`}
                  title="编辑"
                  onClick={() => handlers.onEditTodo(todo)}
                  className="p-1 rounded text-text-tertiary hover:text-info hover:bg-bg-tertiary transition-colors"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  aria-label={`删除任务：${todo.title}`}
                  title="删除"
                  onClick={() => handlers.onOpenConfirmDialog('删除确认', '确定要删除这个任务吗？', () => handlers.onDeleteTodo(todo.id))}
                  className="p-1 rounded text-text-tertiary hover:text-error hover:bg-bg-tertiary transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {sortedTodos.length === 0 && (
          <div className="py-4 text-center text-text-tertiary text-xs">
            {activeTab === 'completed' ? '暂无已完成的任务' : '暂无待办事项'}
          </div>
        )}
      </div>

      {activeTab !== 'completed' && (
        <button
          type="button"
          onClick={() => handlers.onAddTodo(board.isUncategorized ? null : board.id)}
          className="mt-3 w-full py-1.5 text-xs text-text-secondary border border-dashed border-border rounded-md hover:text-text-primary hover:bg-bg-tertiary flex items-center justify-center gap-1 transition-colors"
        >
          <Plus className="w-3 h-3" />
          添加待办
        </button>
      )}
    </div>
  );
};

export default TodoCard;
