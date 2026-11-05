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

/** YYYY-MM-DD（本地时区）；value 可为 Date 或时间戳毫秒 */
export function formatDateYMD(value: Date | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** MM/DD */
export function formatShortDate(date: Date): string {
  return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

/** YYYY-MM-DD HH:mm:ss（本地时区）；timestamp 为秒，ms 为 true 时为毫秒 */
export function formatDateTime(timestamp: number, ms: boolean = false): string {
  const date = new Date(ms ? timestamp : timestamp * 1000);
  return `${formatDateYMD(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** 相对时间：毫秒时间戳 → 「X 前 / X 后」（秒/分钟/小时/天/月/年，负差值为未来） */
export function formatRelativeTime(timestampMs: number, now: number = Date.now()): string {
  const diff = now - timestampMs;
  const absDiff = Math.abs(diff);

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  let text;
  if (seconds < 60) text = `${seconds} 秒`;
  else if (minutes < 60) text = `${minutes} 分钟`;
  else if (hours < 24) text = `${hours} 小时`;
  else if (days < 30) text = `${days} 天`;
  else if (months < 12) text = `${months} 个月`;
  else text = `${years} 年`;

  return diff < 0 ? `${text}后` : `${text}前`;
}