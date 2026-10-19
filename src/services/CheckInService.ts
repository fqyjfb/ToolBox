import { supabase } from './supabase';
import { logError } from './loggerService';
import { queryKeys } from '../queries/keys';
import type { BaseEntity } from '../types/common';

/** 签到记录：仅存云端 check_ins 表，每个用户每天一条，check_in_date 为本地时区 YYYY-MM-DD */
export interface CheckInRecord extends BaseEntity {
  check_in_date: string;
}

/** 取本地时区当天日期串（YYYY-MM-DD），不用 toISOString 避免 UTC 跨日误差 */
const localDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 计算连续签到天数：以最近一条为锚点，锚点不是今天/昨天则已连续中断计 0 */
export const calcStreak = (records: CheckInRecord[]): number => {
  if (records.length === 0) return 0;
  const days = new Set(records.map(r => r.check_in_date));
  const cursor = new Date();
  if (!days.has(localDateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDateStr(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(localDateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

export const checkInService = {
  async listCheckIns(userId: string): Promise<CheckInRecord[]> {
    try {
      const { data, error } = await supabase
        .from('check_ins')
        .select('*')
        .eq('user_id', userId)
        .order('check_in_date', { ascending: false });
      if (error) throw error;
      return (data || []) as CheckInRecord[];
    } catch (error) {
      logError('获取签到记录失败', 'CheckInService', error as Error);
      return [];
    }
  },

  /** 今日签到：仅写云端；幂等，已签（含唯一约束冲突）返回 alreadyChecked=true */
  async checkInToday(userId: string): Promise<{ success: boolean; alreadyChecked?: boolean; error?: string }> {
    if (!navigator.onLine) {
      return { success: false, error: '当前处于离线状态，签到需联网后重试' };
    }
    try {
      const today = localDateStr(new Date());
      const existing = await this.listCheckIns(userId);
      if (existing.some(r => r.check_in_date === today)) {
        return { success: true, alreadyChecked: true };
      }
      const { error } = await supabase
        .from('check_ins')
        .insert({ user_id: userId, check_in_date: today });
      // 多端并发同天时由 UNIQUE(user_id, check_in_date) 兜底，视为已签到
      if (error && error.code !== '23505') throw error;
      return { success: true, alreadyChecked: error?.code === '23505' };
    } catch (error) {
      logError('签到失败', 'CheckInService', error as Error);
      return { success: false, error: error instanceof Error ? error.message : '签到失败' };
    }
  },
};

// 头部签到按钮：当天签到状态 + 连续天数，随写操作 invalidate 刷新
export const checkInStatusQuery = (userId: string) => ({
  queryKey: queryKeys.checkIn.status(userId),
  queryFn: async (): Promise<{ checkedToday: boolean; streak: number }> => {
    const records = await checkInService.listCheckIns(userId);
    return {
      checkedToday: records.some(r => r.check_in_date === localDateStr(new Date())),
      streak: calcStreak(records),
    };
  },
  enabled: !!userId,
});
