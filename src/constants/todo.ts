import type { Todo } from '../types/todo';

/** 未分类分组的虚拟 ID（仅前端分组用，不落库） */
export const UNCATEGORIZED_ID = 'uncategorized';

/** 未分类分组展示名 */
export const UNCATEGORIZED_NAME = '未分类';

/**
 * 分类颜色取值。
 * 注意：卡片通过 `${color}20` 追加透明度，因此颜色必须是 6 位 HEX 字符串，
 * 不可改用 CSS 变量（会拼出非法值）。
 * 取值与 theme.css 的 --color-todo-1 ~ --color-todo-8 保持一致。
 */
export const CATEGORY_COLOR_OPTIONS: string[] = [
  '#3B82F6',
  '#F97316',
  '#A855F7',
  '#EF4444',
  '#10B981',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

/** 未分类分组颜色（同上，需为 6 位 HEX） */
export const UNCATEGORIZED_COLOR = '#6B7280';

/** 新建分类的默认颜色 */
export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_OPTIONS[0];

/** 任务默认优先级 / 状态（与 TodoService 的兜底值保持一致） */
export const DEFAULT_PRIORITY: Todo['priority'] = '中';
export const DEFAULT_STATUS: Todo['status'] = '待办';

/** 优先级排序权重，数值越大越靠前 */
export const PRIORITY_WEIGHT: Record<Todo['priority'], number> = {
  高: 3,
  中: 2,
  低: 1,
};

/** 列表分页大小与搜索防抖时长 */
export const TODO_PAGE_SIZE = 100;
export const TODO_DEBOUNCE_MS = 300;

/** 页签定义 */
export type TodoTab = 'in_progress' | 'completed' | 'all';

export const TODO_TABS: { key: TodoTab; label: string }[] = [
  { key: 'in_progress', label: '未完成' },
  { key: 'completed', label: '已完成' },
  { key: 'all', label: '所有任务' },
];

/** 删除分类确认文案（卡片入口与右键入口共用，保持语义一致） */
export const getDeleteCategoryMessage = (name: string): string =>
  `确定要删除分类「${name}」吗？删除后该分类下的任务将不再显示。`;
