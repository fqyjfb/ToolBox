export type MemoPriority = 'high' | 'medium' | 'low';

/** 优先级标签配色：列表与表单共用同一套映射 */
export const getPriorityStyle = (priority: string): string => {
  switch (priority) {
    case 'high':
      return 'bg-toast-error-bg text-toast-error-text';
    case 'medium':
      return 'bg-toast-warning-bg text-toast-warning-text';
    case 'low':
    default:
      return 'bg-surface-secondary text-content-secondary';
  }
};
