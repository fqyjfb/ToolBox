import { todoServiceWrapper } from './TodoService';
import { queryKeys } from '../queries/keys';

// 侧边栏待办徽标：未完成数量，30s 轮询。
// 原先由 TodoNotificationContext 自行 setInterval 拉一份 todo 列表，与待办页各拉各的；
// 改由 React Query 调度后，待办页接入同一域时可共享缓存，写操作只需 invalidate 即可刷新徽标。
export const todoPendingCountQuery = (userId: string) => ({
  queryKey: queryKeys.todo.pendingCount(userId),
  queryFn: async (): Promise<number> => {
    const result = await todoServiceWrapper.todo.getTodos(userId, undefined, 1, 100);
    if (!result.success || !result.data) return 0;
    return result.data.data.filter(todo => todo.status !== '已完成' && !todo.is_completed).length;
  },
  enabled: !!userId,
  refetchInterval: 30000,
});
