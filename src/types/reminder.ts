export type ReminderRepeatType = 'none' | 'daily' | 'weekly' | 'monthly';
export type ReminderNotifyMethod = 'system' | 'popup';
export type ReminderSourceType = 'manual' | 'todo' | 'memo';

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  content: string;
  remind_time: string;          // ISO 8601，如 '2026-10-10T09:00:00'
  repeat_type: ReminderRepeatType;
  notify_method: ReminderNotifyMethod;
  is_enabled: boolean;
  last_triggered_at: string | null;
  source_type: ReminderSourceType;   // 来源，区分手动创建与快速设为提醒
  source_id: string | null;           // 关联的 todo/memo id
  created_at: string;
  updated_at: string;
}

export interface CreateReminderRequest {
  title: string;
  content?: string;
  remind_time: string;
  repeat_type?: ReminderRepeatType;
  notify_method: ReminderNotifyMethod;
  source_type?: ReminderSourceType;
  source_id?: string | null;
}

export interface UpdateReminderRequest {
  title?: string;
  content?: string;
  remind_time?: string;
  repeat_type?: ReminderRepeatType;
  notify_method?: ReminderNotifyMethod;
  is_enabled?: boolean;
  last_triggered_at?: string | null;
}
