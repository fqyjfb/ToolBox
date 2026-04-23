import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuthStore } from '../store/AuthStore';
import { todoServiceWrapper } from '../services/TodoService';

interface TodoNotificationContextType {
  pendingCount: number;
  refreshCount: () => void;
}

const TodoNotificationContext = createContext<TodoNotificationContextType | undefined>(undefined);

export const TodoNotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const admin = useAuthStore((state) => state.admin);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const fetchPendingTodos = useCallback(async () => {
    if (!admin) return;
    const result = await todoServiceWrapper.todo.getTodos(admin.id, undefined, 1, 100);
    if (result.success && result.data) {
      const pending = result.data.data.filter(todo => todo.status !== '已完成' && !todo.is_completed).length;
      setPendingCount(pending);
    }
  }, [admin]);

  useEffect(() => {
    fetchPendingTodos();
    const interval = setInterval(fetchPendingTodos, 30000);
    return () => clearInterval(interval);
  }, [fetchPendingTodos]);

  const refreshCount = useCallback(() => {
    fetchPendingTodos();
  }, [fetchPendingTodos]);

  return (
    <TodoNotificationContext.Provider value={{ pendingCount, refreshCount }}>
      {children}
    </TodoNotificationContext.Provider>
  );
};

export const useTodoNotification = () => {
  const context = useContext(TodoNotificationContext);
  if (context === undefined) {
    throw new Error('useTodoNotification must be used within a TodoNotificationProvider');
  }
  return context;
};
