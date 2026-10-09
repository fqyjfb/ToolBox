import { getDataAccessLayer } from './dataAccessLayer';
import { logError, logInfo } from './loggerService';
import { isElectron } from '../utils/environment';
import type { Reminder, CreateReminderRequest, UpdateReminderRequest } from '../types/reminder';

/**
 * 定时提醒服务层，模式与 TodoService/MemoService 一致：
 * - 通过 dataAccessLayer 执行 CRUD
 * - 创建/更新/删除后通过 IPC 通知主进程同步 Windows 计划任务
 */
export const reminderService = {
  async getReminders(userId: string): Promise<{ success: boolean; data?: Reminder[]; error?: string }> {
    try {
      const dal = getDataAccessLayer(userId);
      const { data } = await dal.list<Reminder>('reminders', {
        orderBy: { column: 'remind_time', ascending: true },
      });
      return { success: true, data };
    } catch (error) {
      logError('获取提醒列表失败', 'ReminderService', error as Error);
      return { success: false, error: error instanceof Error ? error.message : '获取提醒列表失败' };
    }
  },

  async createReminder(userId: string, req: CreateReminderRequest): Promise<{ success: boolean; data?: Reminder; error?: string }> {
    try {
      const dal = getDataAccessLayer(userId);
      const reminder = await dal.create<Reminder>('reminders', {
        title: req.title,
        content: req.content || '',
        remind_time: req.remind_time,
        repeat_type: req.repeat_type || 'none',
        notify_method: req.notify_method,
        is_enabled: true,
        last_triggered_at: null,
        source_type: req.source_type || 'manual',
        source_id: req.source_id ?? null,
      } as Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'updated_at'>);

      // 通知主进程注册 Windows 计划任务（失败不阻断业务流程）
      if (isElectron() && window.electron?.reminder) {
        try {
          await window.electron.reminder.schedule(reminder);
        } catch (e) {
          logError('注册计划任务失败', 'ReminderService', e as Error);
        }
      }

      logInfo(`创建提醒成功: ${req.title}`, 'ReminderService');
      return { success: true, data: reminder };
    } catch (error) {
      logError('创建提醒失败', 'ReminderService', error as Error);
      return { success: false, error: error instanceof Error ? error.message : '创建提醒失败' };
    }
  },

  async updateReminder(userId: string, id: string, req: UpdateReminderRequest): Promise<{ success: boolean; data?: Reminder; error?: string }> {
    try {
      const dal = getDataAccessLayer(userId);
      const current = await dal.get<Reminder>('reminders', id);
      const patch: UpdateReminderRequest = { ...req };

      // 改了提醒时间即视为重新武装：清掉上次触发时间。
      // 否则启动补偿的「本周期已弹过」判重（last_triggered_at >= remind_time）
      // 会把新时间误判为已触发而直接跳过，改完时间也不会再响。
      if (current && req.remind_time && req.remind_time !== current.remind_time) {
        patch.last_triggered_at = null;
      }

      const reminder = await dal.update<Reminder>('reminders', id, patch);

      // 通知主进程更新计划任务（先删除旧的再创建新的）
      if (isElectron() && window.electron?.reminder) {
        try {
          await window.electron.reminder.schedule(reminder);
        } catch (e) {
          logError('更新计划任务失败', 'ReminderService', e as Error);
        }
      }

      logInfo(`更新提醒成功: ID=${id}`, 'ReminderService');
      return { success: true, data: reminder };
    } catch (error) {
      logError('更新提醒失败', 'ReminderService', error as Error);
      return { success: false, error: error instanceof Error ? error.message : '更新提醒失败' };
    }
  },

  async deleteReminder(userId: string, id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const dal = getDataAccessLayer(userId);
      await dal.delete('reminders', id);

      // 通知主进程删除计划任务
      if (isElectron() && window.electron?.reminder) {
        try {
          await window.electron.reminder.remove(id);
        } catch (e) {
          logError('删除计划任务失败', 'ReminderService', e as Error);
        }
      }

      logInfo(`删除提醒成功: ID=${id}`, 'ReminderService');
      return { success: true };
    } catch (error) {
      logError('删除提醒失败', 'ReminderService', error as Error);
      return { success: false, error: error instanceof Error ? error.message : '删除提醒失败' };
    }
  },

  async searchReminders(userId: string, keyword: string): Promise<{ success: boolean; data?: Reminder[]; error?: string }> {
    try {
      const dal = getDataAccessLayer(userId);
      const { data } = await dal.search<Reminder>('reminders', keyword, ['title', 'content'], {
        orderBy: { column: 'remind_time', ascending: true },
      });
      return { success: true, data };
    } catch (error) {
      logError('搜索提醒失败', 'ReminderService', error as Error);
      return { success: false, error: error instanceof Error ? error.message : '搜索提醒失败' };
    }
  },
};
