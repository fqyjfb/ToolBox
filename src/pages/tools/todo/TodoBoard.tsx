import React from 'react';
import { FolderOpen, Plus, Search } from 'lucide-react';
import TodoCard, { TodoBoardItem, TodoCardHandlers } from '../../../components/ui/TodoCard';
import type { TodoTab } from '../../../constants/todo';

interface TodoBoardProps {
  boards: TodoBoardItem[];
  isLoading: boolean;
  /** 处于搜索态且没有任何命中结果 */
  isEmptySearch: boolean;
  searchKeyword: string;
  activeTab: TodoTab;
  handlers: TodoCardHandlers;
  onCreateCategory: () => void;
  onClearSearch: () => void;
}

const BOARD_GRID_CLASS = 'grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3';

const BoardSkeleton: React.FC = () => (
  <div className={BOARD_GRID_CLASS}>
    {[0, 1, 2].map((key) => (
      <div key={key} className="rounded-xl p-4 bg-card-50 animate-pulse">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-bg-tertiary" />
          <div className="h-4 w-24 rounded bg-bg-tertiary" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-bg-tertiary" />
          <div className="h-3 w-4/5 rounded bg-bg-tertiary" />
          <div className="h-3 w-3/5 rounded bg-bg-tertiary" />
        </div>
      </div>
    ))}
  </div>
);

const TodoBoard: React.FC<TodoBoardProps> = ({
  boards,
  isLoading,
  isEmptySearch,
  searchKeyword,
  activeTab,
  handlers,
  onCreateCategory,
  onClearSearch,
}) => {
  if (isEmptySearch) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
        <Search className="w-10 h-10 mb-3" />
        <p className="text-sm mb-2">当前页签下没有与「{searchKeyword}」匹配的任务</p>
        <button
          type="button"
          onClick={onClearSearch}
          className="text-sm text-info hover:text-primary transition-colors"
        >
          清除搜索
        </button>
      </div>
    );
  }

  if (isLoading) {
    return <BoardSkeleton />;
  }

  if (boards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
        <FolderOpen className="w-10 h-10 mb-3" />
        <p className="text-sm mb-3">暂无分类</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlers.onAddTodo(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-primary text-button-text hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            创建第一个任务
          </button>
          <button
            type="button"
            onClick={onCreateCategory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-surface-secondary text-text-secondary dark:bg-surface dark:text-content-secondary hover:bg-menu-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            创建第一个分类
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={BOARD_GRID_CLASS}>
      {boards.map((board) => (
        <TodoCard key={board.id} board={board} handlers={handlers} activeTab={activeTab} />
      ))}
    </div>
  );
};

export default TodoBoard;
