export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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