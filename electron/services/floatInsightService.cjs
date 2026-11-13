/**
 * 悬浮球「不定时弹窗」内容生产者（方案见 doc/悬浮球互动弹窗升级方案.md）。
 *
 * 定位：所有定时/事件气泡的唯一生产者，渲染层 float-pet.cjs 只负责渲染。
 * 约束：
 * - 业务数据只读：todos/reminders 走 sqliteService 独立只读连接，写路径零改动；
 *   check_ins 是云端表，主进程不碰，打卡状态由渲染层每日快照推来。
 * - 天气/黄历同理：渲染层预格式化成一行文案推快照，主进程永不自己发请求、不自己拼字段。
 * - 无内容保持安静，没有任何语录兜底；任一数据源不可用静默跳过对应场景。
 * - 气泡通道 float-pet-card、按钮分发 actions.cjs 全部复用，本文件不新增渲染层机制。
 */
const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { loadSettings } = require('../lib/config.cjs');
const sqliteService = require('./sqliteService.cjs');
const { nextOccurrence } = require('./reminderRecurrence.cjs');

const getFloatWindow = () => {
  try { return require('../window/floatWindow.cjs').getFloatWindow(); } catch { return null; }
};
const card = (text, actions = [], ttl = 8000) => {
  const win = getFloatWindow();
  if (win && !win.isDestroyed()) win.webContents.send('float-pet-card', { text, actions, ttl });
};

// ── 设置读取：与 floatFeatureService 同口径（缺失键默认开，0/false 为关）──
const enabled = (name) => loadSettings()[name] !== 0 && loadSettings()[name] !== false;
const num = (value, fallback, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

// ── 频控状态 ──
const GLOBAL_MIN_INTERVAL_MS = 10 * 60 * 1000; // 全局最小间隔，防事件风暴刷屏
const SCENE_COOLDOWN_MS = 20 * 60 * 1000;      // 同类场景冷却
const REMINDER_SOON_MS = 60 * 60 * 1000;       // 临近提醒窗口：未来 60 分钟
const WEATHER_STALE_MS = 30 * 60 * 1000;       // 天气快照过期阈值
let lastAnyCardAt = 0;
const lastSceneAt = new Map();
let lastAllDoneDate = '';                      // 「待办清空」每天最多一次
let lastWeeklyDigestDate = '';                 // 周摘要当天只推一次
let inspectTimer = null;
let lastInspectAt = 0;

// ── 时间工具：项目内提醒时间统一用本地 naive 字符串（见 reminderScheduler 注释）──
const pad2 = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayStr = () => dateStr(new Date());
const dayPart = (d) => String(d).slice(0, 10); // due_date / completed_at 可能是 datetime，取日期部分比较

function isQuietHours() {
  const raw = String(loadSettings().floatInsightQuietHours || '22-8');
  const m = raw.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  const start = m ? Number(m[1]) : 22;
  const end = m ? Number(m[2]) : 8;
  const h = new Date().getHours();
  return start <= end ? (h >= start && h < end) : (h >= start || h < end);
}

// ── 数据采集（全部只读，失败返回空态，不抛出）──

// todos：行内 JSON，字段口径对齐 src/types/todo.ts（is_completed / due_date / completed_at / title）
async function collectTodos() {
  try {
    const rows = await sqliteService.readAllTableRows(app.getPath('userData'), 'todos');
    const today = todayStr();
    const pending = [];
    const overdue = [];
    let doneThisWeek = 0;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // 周一
    const weekStartStr = dateStr(weekStart);
    for (const t of rows) {
      if (!t || typeof t !== 'object') continue;
      if (t.is_completed) {
        const doneDay = dayPart(String(t.completed_at || ''));
        if (doneDay >= weekStartStr && doneDay <= today) doneThisWeek++;
        continue;
      }
      const due = t.due_date ? dayPart(String(t.due_date)) : '';
      if (due && due < today) overdue.push(t);
      else pending.push(t); // 无截止日期或今天及以后都归入「待办」口径
    }
    return { pending, overdue, doneThisWeek };
  } catch {
    return null; // sqlite 未就绪/锁定：跳过待办场景
  }
}

// reminders：复用 readAllReminders 的跨库只读汇总 + reminderRecurrence 的递归计算
async function collectReminders() {
  try {
    const byId = await sqliteService.readAllReminders(app.getPath('userData'));
    const now = Date.now();
    const soon = [];
    for (const r of byId.values()) {
      if (!r || r.enabled === false || !r.remind_time) continue;
      const next = nextOccurrence(r.remind_time, r.repeat_type || 'none');
      const at = new Date(next).getTime();
      if (Number.isFinite(at) && at >= now && at - now <= REMINDER_SOON_MS) {
        soon.push({ title: String(r.title || '提醒'), inMin: Math.max(1, Math.ceil((at - now) / 60000)) });
      }
    }
    soon.sort((a, b) => a.inMin - b.inMin);
    return soon;
  } catch {
    return [];
  }
}

// 文件中转站：主进程自有 index.json；保留期口径与 floatFeatureService.cleanupShelf 一致
function collectShelf() {
  try {
    const file = path.join(app.getPath('userData'), 'float-shelf', 'index.json');
    if (!fs.existsSync(file)) return { expiring: 0 };
    const items = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!Array.isArray(items)) return { expiring: 0 };
    const days = num(loadSettings().floatShelfRetentionDays, 7, 1, 90);
    const lifetimeMs = days * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expiring = items.filter((item) => {
      const left = Number(item && item.addedAt) + lifetimeMs - now;
      return left > 0 && left <= 24 * 60 * 60 * 1000;
    }).length;
    return { expiring };
  } catch {
    return { expiring: 0 };
  }
}

// 每日快照：渲染层推送的预格式化内容（天气/黄历/打卡），主进程只做过期判断
const snapshotPath = () => path.join(app.getPath('userData'), 'daily-snapshot.json');
function readSnapshot() {
  try {
    const file = snapshotPath();
    if (!fs.existsSync(file)) return {};
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {}; // 非法 JSON：下次推送覆盖，不阻断
  }
}
function writeSnapshot(next) {
  try {
    const tmp = snapshotPath() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(next));
    fs.renameSync(tmp, snapshotPath());
  } catch { /* 快照仅是缓存，写失败静默 */ }
}
function getWeather() {
  const w = readSnapshot().weather;
  if (!w || typeof w.summary !== 'string' || !w.summary) return null;
  if (Date.now() - Number(w.updatedAt || 0) > WEATHER_STALE_MS) return null;
  return w.summary.slice(0, 40);
}
function getAlmanac() {
  const a = readSnapshot().almanac;
  // 黄历按天有效：只认今天推送的
  if (!a || typeof a.line !== 'string' || !a.line || a.date !== todayStr()) return null;
  return a.line.slice(0, 40);
}
function getCheckIn() {
  const c = readSnapshot().checkIn;
  if (!c || c.date !== todayStr()) return null;
  return {
    checkedToday: Boolean(c.checkedToday),
    streak: Number(c.streak) || 0,
    weekCount: Number(c.weekCount) || 0,
  };
}

// ── 卡片构建 ──
const truncate = (s, n) => {
  const str = String(s || '').replace(/[\r\n]+/g, ' ').trim();
  return str.length > n ? str.slice(0, n) : str;
};

// 场景 1/2 合并：1~3 条给标题速览，更多给计数概览（同一冷却键，避免重复播报）
function buildTodoCard(todos) {
  const list = todos.pending;
  if (list.length === 0) return null;
  if (list.length <= 3) {
    const titles = list.map((t) => truncate(t.title, 12)).filter(Boolean).join(' / ');
    if (titles) return { scene: 'todo', text: `待办：${titles}`, actions: [{ label: '去处理', action: 'nav:todo' }] };
  }
  return { scene: 'todo', text: `今天还有 ${list.length} 条待办没完成`, actions: [{ label: '查看待办', action: 'nav:todo' }] };
}

function buildOverdueCard(todos) {
  if (todos.overdue.length === 0) return null;
  return { scene: 'overdue', text: `有 ${todos.overdue.length} 条待办已经过了截止日`, actions: [{ label: '去处理', action: 'nav:todo' }] };
}

function buildReminderCard(soon) {
  if (soon.length === 0) return null;
  const first = soon[0];
  return { scene: 'reminder', text: `${first.inMin} 分钟后：${truncate(first.title, 16)}`, actions: [{ label: '查看全部', action: 'nav:todo' }] };
}

function buildCheckInCard(checkIn) {
  if (!checkIn || checkIn.checkedToday) return null;
  return { scene: 'checkin', text: '今天还没打卡哦，点一下就好', actions: [{ label: '去打卡', action: 'nav:home' }] };
}

function buildStreakCard(checkIn) {
  if (!checkIn || !checkIn.checkedToday || checkIn.streak < 2) return null;
  return { scene: 'streak', text: `已连续打卡 ${checkIn.streak} 天，继续保持！`, actions: [] };
}

function buildWeatherCard() {
  const summary = getWeather();
  if (!summary) return null;
  return { scene: 'weather', text: summary, actions: [{ label: '看详情', action: 'nav:home' }] };
}

function buildAlmanacCard() {
  const line = getAlmanac();
  if (!line) return null;
  return { scene: 'almanac', text: line, actions: [] };
}

function buildShelfCard(shelf) {
  if (!shelf.expiring) return null;
  return { scene: 'shelf', text: `中转站的 ${shelf.expiring} 个文件明天到期清理`, actions: [{ label: '去看看', action: 'ai:shelf' }] };
}

function buildWeeklyDigestCard(todos, checkIn) {
  const now = new Date();
  if (now.getDay() !== 5 || lastWeeklyDigestDate === todayStr()) return null; // 仅周五、当天一次
  if (todos.doneThisWeek === 0 && !(checkIn && checkIn.weekCount > 0)) return null;
  const parts = [];
  if (todos.doneThisWeek > 0) parts.push(`完成 ${todos.doneThisWeek} 条待办`);
  if (checkIn && checkIn.weekCount > 0) parts.push(`打卡 ${checkIn.weekCount} 天`);
  return { scene: 'weekly', text: `本周${parts.join('，')}`, actions: [{ label: '查看待办', action: 'nav:todo' }], mark: () => { lastWeeklyDigestDate = todayStr(); } };
}

function buildAllDoneCard(todos) {
  if (todos.pending.length > 0 || todos.overdue.length > 0) return null;
  if (todos.doneThisWeek === 0 || lastAllDoneDate === todayStr()) return null; // 今天没有完成记录就不起哄
  return { scene: 'alldone', text: '今日待办清空，好耶！', actions: [{ label: '再记一条', action: 'ai:capture' }], mark: () => { lastAllDoneDate = todayStr(); } };
}

// ── 仲裁：守卫 + 冷却，事件/巡检共用 ──
function guardsPass() {
  if (!enabled('floatInsightEnabled')) return false;
  if (loadSettings().isLockEnabled === 1) return false;
  if (isQuietHours()) return false;
  const win = getFloatWindow();
  return Boolean(win && !win.isDestroyed());
}

function tryPush(cardDef, { bypassCooldown = false } = {}) {
  if (!cardDef) return false;
  if (!guardsPass()) return false;
  const now = Date.now();
  if (!bypassCooldown) {
    if (now - lastAnyCardAt < GLOBAL_MIN_INTERVAL_MS) return false;
    if (now - (lastSceneAt.get(cardDef.scene) || 0) < SCENE_COOLDOWN_MS) return false;
  }
  card(cardDef.text, cardDef.actions, cardDef.ttl || 8000);
  lastAnyCardAt = now;
  lastSceneAt.set(cardDef.scene, now);
  if (typeof cardDef.mark === 'function') cardDef.mark();
  return true;
}

// ── 定时巡检：按优先级挑本轮第一个有内容的场景 ──
async function inspect() {
  if (!guardsPass()) return;
  const todos = enabled('floatInsightTodoEnabled') ? await collectTodos() : null;
  const checkIn = enabled('floatInsightCheckInEnabled') ? getCheckIn() : null;

  const candidates = [];
  if (enabled('floatInsightReminderEnabled')) candidates.push(buildReminderCard(await collectReminders()));
  if (todos) candidates.push(buildOverdueCard(todos));
  candidates.push(buildCheckInCard(checkIn));
  if (todos) candidates.push(buildTodoCard(todos));
  if (enabled('floatInsightShelfEnabled')) candidates.push(buildShelfCard(collectShelf()));
  candidates.push(buildStreakCard(checkIn));
  if (enabled('floatInsightWeatherEnabled')) {
    candidates.push(buildWeatherCard());
    candidates.push(buildAlmanacCard());
  }
  if (todos) candidates.push(buildWeeklyDigestCard(todos, checkIn));
  if (todos) candidates.push(buildAllDoneCard(todos));

  for (const candidate of candidates) {
    if (candidate && tryPush(candidate)) return;
  }
}

// ── 事件触发：用户操作成功的即时反馈（不受冷却限制，但受总开关/锁屏/免打扰约束）──
function notifyEvent(type, payload = {}) {
  if (!guardsPass()) return;
  if (type === 'capture:done') {
    tryPush({ scene: 'capture', text: payload.kind === 'note' ? '已存成笔记' : '已加入待办', actions: [], ttl: 4000 }, { bypassCooldown: true });
    return;
  }
  if (type === 'checkin:done') {
    const streak = Number(payload.streak) || 0;
    tryPush({
      scene: 'checkin-done',
      text: streak > 1 ? `打卡成功！已连续 ${streak} 天` : '打卡成功！',
      actions: [],
      ttl: 5000,
    }, { bypassCooldown: true });
  }
}

// ── 启动卡：取代渲染层入场欢迎语，时段称呼 + 真实概览 ──
async function pushStartupCard() {
  if (!guardsPass()) return;
  const h = new Date().getHours();
  const greet = h < 5 ? '夜深了' : h < 11 ? '早安' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  const parts = [];
  const actions = [];
  const todos = enabled('floatInsightTodoEnabled') ? await collectTodos() : null;
  if (todos) {
    const count = todos.pending.length + todos.overdue.length;
    if (count > 0) {
      parts.push(`${count} 条待办`);
      actions.push({ label: '查看待办', action: 'nav:todo' });
    }
  }
  const weather = enabled('floatInsightWeatherEnabled') ? getWeather() : null;
  if (weather) parts.push(weather);
  const checkIn = enabled('floatInsightCheckInEnabled') ? getCheckIn() : null;
  if (checkIn && !checkIn.checkedToday) {
    parts.push('未打卡');
    actions.push({ label: '去打卡', action: 'nav:home' });
  }
  const text = parts.length > 0 ? `${greet}！${parts.join(' · ')}` : `${greet}！今天也是清爽的一天`;
  // 启动卡不进冷却，但也只推一次（窗口每次加载完成触发一回）
  card(text, actions.slice(0, 3), 8000);
  lastAnyCardAt = Date.now();
}

// ── IPC 与调度注册（唯一入口）──
let registered = false;

function registerFloatInsightIpc() {
  if (registered) return;
  registered = true;

  // 渲染层每日快照：天气/黄历/打卡，合并写、字段独立过期
  ipcMain.on('float:daily-snapshot', (_event, payload) => {
    if (!payload || typeof payload !== 'object') return;
    const next = readSnapshot();
    for (const key of ['weather', 'almanac', 'checkIn']) {
      if (payload[key] && typeof payload[key] === 'object') next[key] = payload[key];
    }
    writeSnapshot(next);
  });

  // 渲染层轻量事件：打卡成功等即时反馈
  ipcMain.on('float:insight-event', (_event, payload) => {
    if (!payload || typeof payload.type !== 'string') return;
    notifyEvent(payload.type, payload);
  });

  rescheduleInspect();
}

/**
 * 重新计算下一到期时间并安排调度。
 * - lastInspectAt === 0 时立即执行一次（首次启动语义）。
 * - 每次 inspect() 完成后自续调用，保证任意时刻最多一个定时器和一次执行。
 * - 设置变更/锁屏/悬浮窗状态变化时可被外部调用来立即响应新间隔。
 */
function rescheduleInspect() {
  if (inspectTimer) {
    clearTimeout(inspectTimer);
    inspectTimer = null;
  }
  const intervalMs = num(loadSettings().floatInsightIntervalMin, 30, 15, 120) * 60 * 1000;
  const elapsed = Date.now() - lastInspectAt;
  const delay = lastInspectAt === 0 ? 0 : Math.max(0, intervalMs - elapsed);
  inspectTimer = setTimeout(() => {
    lastInspectAt = Date.now();
    inspect()
      .catch(() => { /* 采集失败本轮跳过，按当前间隔继续 */ })
      .finally(() => rescheduleInspect());
  }, delay);
  if (inspectTimer && typeof inspectTimer.unref === 'function') inspectTimer.unref();
}

module.exports = { registerFloatInsightIpc, rescheduleInspect, notifyEvent, pushStartupCard };
