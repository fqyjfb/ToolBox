export type MemoPriority = 'high' | 'medium' | 'low';

/** 优先级标签配色：列表与表单共用同一套映射 */
export const getPriorityStyle = (priority: string): string => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    case 'medium':
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
    case 'low':
    default:
      return 'bg-surface-secondary text-content-secondary';
  }
};
