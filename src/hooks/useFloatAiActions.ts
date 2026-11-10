import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/AuthStore';
import { useToastStore } from '../store/toastStore';
import { todoServiceWrapper } from '../services/TodoService';
import { logError } from '../services/loggerService';
import { queryKeys } from '../queries/keys';

/**
 * 悬浮球 AI 面板的写入请求在这里落地。
 *
 * 主进程只负责「面板 → 主窗口」转发，待办的实际创建仍走 todoService，
 * 这样用户 id、离线/云同步、字段结构都与待办页完全一致，不必在主进程重复实现一份。
 */
export const useFloatAiActions = () => {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  useEffect(() => {
    const api = window.electron?.floatAi;
    if (!api?.onSaveTodo || !userId) return;

    const unsubscribe = api.onSaveTodo(async (payload) => {
      const requestId = payload?.requestId;
      // 只有携带 requestId 的调用需要回执（悬浮球面板「存为待办」）；
      // 快速捕捉等旧调用没有回执通道，保持原有单向下发语义
      const report = (success: boolean, todo?: unknown, error?: string) => {
        if (!requestId) return;
        api.reportSaveTodo({ requestId, success, todo, error });
      };
      const title = (payload?.title || '').trim();
      if (!title) {
        report(false, undefined, '没有可保存的内容');
        return;
      }
      try {
        const result = await todoServiceWrapper.todo.createTodo(userId, {
          title,
          description: payload?.description || '',
        });
        report(
          !!result?.success,
          result?.success ? result.data : null,
          result?.success ? '' : (result?.error || '添加待办失败')
        );
        if (result?.success) {
          useToastStore.getState().addToast({ type: 'success', message: '已从悬浮球添加到待办' });
          queryClient.invalidateQueries({ queryKey: queryKeys.todo.all });
        } else {
          useToastStore.getState().addToast({ type: 'error', message: result?.error || '添加待办失败' });
        }
      } catch (error) {
        report(false, undefined, '添加待办失败');
        logError('悬浮球存为待办失败', 'FloatAi', error instanceof Error ? error : undefined);
        useToastStore.getState().addToast({ type: 'error', message: '添加待办失败' });
      }
    });

    return unsubscribe;
  }, [userId, queryClient]);
};
