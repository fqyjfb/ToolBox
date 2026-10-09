import type { ReminderNotifyMethod, ReminderRepeatType } from '../types/reminder';

/** 重复类型选项 */
export const REPEAT_TYPES: { value: ReminderRepeatType; label: string }[] = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
];

/** 通知方式选项（创建和编辑模式均可选择切换） */
export const NOTIFY_METHODS: { value: ReminderNotifyMethod; label: string }[] = [
  { value: 'system', label: '系统通知' },
  { value: 'popup', label: '弹窗提醒' },
];

/** 重复类型与中文描述映射，用于卡片展示 */
export const REPEAT_LABEL_MAP: Record<ReminderRepeatType, string> = {
  none: '不重复',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
};

/** 通知方式与中文描述映射，用于卡片展示 */
export const NOTIFY_METHOD_LABEL_MAP: Record<ReminderNotifyMethod, string> = {
  system: '系统通知',
  popup: '弹窗提醒',
};

/** Windows Task Scheduler 任务名前缀，最终任务名为 ToolBox_Reminder_<id> */
export const SCHEDULER_TASK_PREFIX = 'ToolBox_Reminder_';

/** 列表分页大小与搜索防抖时长 */
export const REMINDER_PAGE_SIZE = 50;
export const REMINDER_DEBOUNCE_MS = 300;
