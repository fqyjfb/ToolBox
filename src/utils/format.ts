export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const pad2 = (value: number) => String(value).padStart(2, '0');

export const formatMonthDay = (date: Date) => `${pad2(date.getMonth() + 1)}月${pad2(date.getDate())}日`;

/** MM月DD日 星期X；weekdayStyle='long' 输出「星期日」，默认「周日」 */
export function formatMonthDayWeek(date: Date, weekdayStyle: 'short' | 'long' = 'short') {
  const names = weekdayStyle === 'long'
    ? ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${formatMonthDay(date)} ${names[date.getDay()]}`;
}

export function getDayName(dateStr: string, opts?: { includeAfterTomorrow?: boolean }): string {
  const includeAfterTomorrow = opts?.includeAfterTomorrow ?? true;
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const afterTomorrow = new Date(today);
  afterTomorrow.setDate(today.getDate() + 2);
  const afterTomorrowStr = afterTomorrow.toISOString().split('T')[0];

  if (dateStr === todayStr) return '今天';
  if (dateStr === tomorrowStr) return '明天';
  if (includeAfterTomorrow && dateStr === afterTomorrowStr) return '后天';

  const date = new Date(dateStr);
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return weekDays[date.getDay()];
}