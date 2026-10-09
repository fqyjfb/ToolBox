// 重复提醒的下一次触发时间计算。
// 用 rrule 取代原手写 setDate/setMonth 推进：
// 1) 统一输出本地时间字符串 'YYYY-MM-DD HH:mm'，与 remind_time 存储格式一致，
//    不再出现 toISOString() 的 UTC 时间与本地 remind_time 混用导致的跨天错位；
// 2) 按 RFC 5545 语义跳过不存在的日期（1/31 的每月重复 → 3/31，而非 setMonth 溢出成 3/3）；
// 3) 周/月的星期与日期由 dtstart 自动推导，无需额外维护 byweekday/bymonthday。
// rrule.js 的 dtstart/after 均以本地时间（naive local）参与运算，不存在时区偏移问题。
const { RRule } = require('rrule');

const FREQ_BY_TYPE = {
  daily: RRule.DAILY,
  weekly: RRule.WEEKLY,
  monthly: RRule.MONTHLY,
};

const pad = (n) => String(n).padStart(2, '0');

// Date → 'YYYY-MM-DD HH:mm'（本地时间）
function toLocalString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 返回下一次触发的本地时间字符串；
// repeat_type 为 none/未知、或 remind_time 无法解析时原样返回，不做推进。
function nextOccurrence(remindTime, repeatType) {
  const dtstart = new Date(remindTime);
  const freq = FREQ_BY_TYPE[repeatType];
  if (!freq || Number.isNaN(dtstart.getTime())) return remindTime;

  const next = new RRule({ freq, interval: 1, dtstart }).after(new Date(), false);
  return next ? toLocalString(next) : remindTime;
}

module.exports = { nextOccurrence, toLocalString };
