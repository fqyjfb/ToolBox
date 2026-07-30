import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuthStore } from '../store/AuthStore';
import { todoServiceWrapper } from '../services/TodoService';

/* eslint-disable react-refresh/only-export-components */
interface TodoNotificationContextType {
  pendingCount: number;
  refreshCount: () => void;
}

const TodoNotificationContext = createContext<TodoNotificationContextType | undefined>(undefined);

export const TodoNotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const fetchPendingTodos = useCallback(async () => {
    if (!user) return;
    const result = await todoServiceWrapper.todo.getTodos(user.id, undefined, 1, 100);
    if (result.success && result.data) {
      const pending = result.data.data.filter(todo => todo.status !== '已完成' && !todo.is_completed).length;
      setTimeout(() => setPendingCount(pending), 0);
    }
  }, [user]);

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
