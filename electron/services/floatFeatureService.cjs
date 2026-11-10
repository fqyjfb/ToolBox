/**
 * 悬浮球进阶功能（P1/P2）主进程服务。
 *
 * 设计约束：一个注册入口、一份设置读取、复用既有模块，不重复造轮子：
 * - 气泡/状态复用 floatWindow 的 float-pet-card / float:pet-state
 * - 动作分发复用 float/actions.cjs（含锁定态 guard）
 * - 剪贴板复用 clipboardIpc.subscribeClipboardText（不新增常驻轮询）
 * - 笔记落盘复用 notesService 的根目录门控
 * - 待办写入沿用 float:save-todo 的「转发主窗口渲染层」模式
 * - AI 请求复用 floatAssistantService 的模型解析 + aiIpc.handleChat
 *
 * 所有隐私类能力默认关闭，开关关闭时不监听、不发请求、不落盘。
 */
const { ipcMain, app, clipboard, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { loadSettings } = require('../lib/config.cjs');

const getFloatWindow = () => {
  try { return require('../window/floatWindow.cjs').getFloatWindow(); } catch { return null; }
};
const toBall = (channel, payload) => {
  const win = getFloatWindow();
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
};
const card = (text, actions = [], ttl = 6000) => toBall('float-pet-card', { text, actions, ttl });
const petState = (state, ttl) => toBall('float:pet-state', { state, ttl });
const enabled = (name) => loadSettings()[name] !== 0 && loadSettings()[name] !== false;
const num = (value, fallback, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

// ───────────────────────── P2-4 文件中转站 ─────────────────────────
const shelfDir = () => path.join(app.getPath('userData'), 'float-shelf');
const shelfIndexPath = () => path.join(shelfDir(), 'index.json');
const MAX_SHELF_BYTES = 200 * 1024 * 1024;

function readShelfIndex() {
  try {
    const file = shelfIndexPath();
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // 非法 JSON 自愈：下次写入时覆盖，不阻断启动
    return [];
  }
}

function writeShelfIndex(items) {
  fs.mkdirSync(shelfDir(), { recursive: true });
  const tmp = shelfIndexPath() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
  fs.renameSync(tmp, shelfIndexPath());
}

function removeShelfFile(item) {
  try { if (item && item.storedPath && fs.existsSync(item.storedPath)) fs.unlinkSync(item.storedPath); } catch { /* 已删除时忽略 */ }
}

function cleanupShelf(items) {
  const cfg = loadSettings();
  const days = num(cfg.floatShelfRetentionDays, 7, 1, 90);
  const maxItems = num(cfg.floatShelfMaxItems, 20, 1, 100);
  const deadline = Date.now() - days * 24 * 60 * 60 * 1000;
  const kept = items.filter(item => item && Number(item.addedAt) > deadline);
  kept.sort((a, b) => Number(b.addedAt) - Number(a.addedAt));
  const removed = kept.slice(maxItems);
  removed.forEach(removeShelfFile);
  return kept.slice(0, maxItems);
}

function shelfAdd(filePaths) {
  if (!enabled('floatShelfEnabled')) return { ok: false, error: '中转站已关闭' };
  if (!Array.isArray(filePaths) || filePaths.length === 0) return { ok: false, error: '没有文件' };
  const items = cleanupShelf(readShelfIndex());
  const added = [];
  const errors = [];
  for (const sourcePath of filePaths.slice(0, 20)) {
    try {
      if (!sourcePath || !fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) continue;
      const stat = fs.statSync(sourcePath);
      if (stat.size > MAX_SHELF_BYTES) { errors.push(`${path.basename(sourcePath)}：文件太大`); continue; }
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const safeName = path.basename(sourcePath).replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
      const storedPath = path.join(shelfDir(), `${id}__${safeName}`);
      fs.mkdirSync(shelfDir(), { recursive: true });
      fs.copyFileSync(sourcePath, storedPath); // 复制而非移动，源文件保持原样
      added.push({
        id, name: safeName, size: stat.size, ext: path.extname(safeName).toLowerCase(),
        addedAt: Date.now(), storedPath, sourcePath,
      });
    } catch (error) {
      errors.push(`${path.basename(String(sourcePath))}：${error.message}`);
    }
  }
  const next = cleanupShelf([...added, ...items]);
  writeShelfIndex(next);
  return { ok: true, added: added.length, items: next, errors };
}

function shelfList() {
  const items = readShelfIndex();
  return items.map(({ storedPath, sourcePath, ...rest }) => rest); // 不把本机路径下发给页面
}

function shelfRemove(id) {
  const items = readShelfIndex();
  const target = items.find(item => item.id === id);
  removeShelfFile(target);
  writeShelfIndex(items.filter(item => item.id !== id));
  return { ok: Boolean(target), items: shelfList() };
}

function shelfClear() {
  readShelfIndex().forEach(removeShelfFile);
  writeShelfIndex([]);
  return { ok: true, items: [] };
}

// 拖拽图标：优先文件自身缩略图 → 回退应用图标；绝不下发空 NativeImage（Windows 上会拖拽失败/异常）
function pickDragIcon(item) {
  try {
    if (item.ext.match(/^\.(png|jpg|jpeg|gif|webp|bmp)$/)) {
      const img = nativeImage.createFromPath(item.storedPath);
      if (img && !img.isEmpty()) return img.resize({ width: 32, height: 32 });
    }
  } catch { /* 损坏/不支持格式 → 走回退 */ }
  const appIcon = require('../lib/appIcon.cjs').getAppIcon();
  return appIcon ? appIcon.resize({ width: 32, height: 32 }) : null;
}

// startDrag 在 Windows 上是同步阻塞的（拖拽期间主进程不跑事件循环），
// 用标志位防止上一个拖拽未结束时再次进入
let shelfDragInFlight = false;

function shelfDragOut(event, id) {
  if (shelfDragInFlight) return;
  if (!enabled('floatShelfEnabled')) return;

  const panelWindow = require('../window/floatPanelWindow.cjs');
  const win = panelWindow.getPanelWindow();
  if (!win || win.isDestroyed()) return;
  if (!panelWindow.isPanelSender(event)) return;

  const item = readShelfIndex().find(entry => entry.id === id);
  if (!item) return;

  // 文件已被用户从磁盘删除 / 不是普通文件，都不进 startDrag
  let stat = null;
  try { stat = fs.statSync(item.storedPath); } catch { stat = null; }
  if (!stat || !stat.isFile()) {
    writeShelfIndex(readShelfIndex().filter(entry => entry.id !== id));
    return;
  }

  const icon = pickDragIcon(item);
  if (!icon) return;

  shelfDragInFlight = true;
  panelWindow.beginDragOut();               // 拖拽期间禁止失焦自动隐藏，避免源窗口被拆
  try {
    win.setAlwaysOnTop(false);              // 不遮挡落点
    event.sender.startDrag({ file: item.storedPath, icon }); // 同步阻塞，直到拖拽结束
  } catch (error) {
    console.error('[Float] shelfDragOut 失败:', error.message);
  } finally {
    if (!win.isDestroyed()) win.setAlwaysOnTop(true);
    panelWindow.endDragOut();
    shelfDragInFlight = false;
  }
}

// ───────────────────────── P2-1 命令面板 ─────────────────────────
let cachedTools = null;
function loadTools() {
  if (cachedTools) return cachedTools;
  try {
    const file = path.join(__dirname, '../generated/tools.json');
    // 仅在成功读到非空清单时缓存：文件缺失/损坏时返回空并保留重试机会，
    // 避免首次读取失败后被永久缓存为空列表（命令面板从此只剩静态动作）
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedTools = parsed;
        return cachedTools;
      }
    }
  } catch { /* 解析失败下次重试 */ }
  return [];
}

// 与 actions.cjs 已注册的前缀保持同口径：面板头部下拉 / 托盘 / 径向菜单能到的地方，
// 命令面板同样可达（不含 system:clear-recycle-bin/shutdown 等破坏性动作，避免误触发）
const STATIC_ACTIONS = [
  { id: 'ai:chat', label: 'AI 对话', group: '动作', action: 'ai:chat' },
  { id: 'ai:capture', label: '快速捕捉', group: '动作', action: 'ai:capture' },
  { id: 'ai:palette', label: '命令面板', group: '动作', action: 'ai:palette' },
  { id: 'ai:shelf', label: '文件中转站', group: '动作', action: 'ai:shelf' },
  { id: 'ai:screenshot', label: '截图问答', group: '动作', action: 'ai:screenshot' },
  { id: 'ai:selection', label: '划词取词', group: '动作', action: 'ai:selection' },
  { id: 'nav:settings', label: '打开设置', group: '动作', action: 'nav:settings' },
  { id: 'nav:home', label: '首页', group: '导航', action: 'nav:home' },
  { id: 'nav:todo', label: '待办事项', group: '导航', action: 'nav:todo' },
  { id: 'nav:tools', label: '工具中心', group: '导航', action: 'nav:tools' },
  { id: 'nav:quick', label: '快捷启动', group: '导航', action: 'nav:quick' },
  { id: 'nav:bookmark', label: '书签导航', group: '导航', action: 'nav:bookmark' },
];

const RECENT_PATH = () => path.join(app.getPath('userData'), 'floatPaletteRecent.json');
function readRecent() {
  try { const v = JSON.parse(fs.readFileSync(RECENT_PATH(), 'utf-8')); return Array.isArray(v) ? v : []; } catch { return []; }
}
function pushRecent(id) {
  const next = [id, ...readRecent().filter(item => item !== id)].slice(0, 10);
  try { fs.writeFileSync(RECENT_PATH(), JSON.stringify(next)); } catch { /* 忽略 */ }
}

// 上限只需盖住全部候选（33 工具 + 12 动作 = 45），此前 15 的硬上限导致
// 空查询时大部分工具永远不出现（列表不完整的主因）
const SEARCH_MAX_RESULTS = 50;

function searchAll(query) {
  const q = String(query || '').trim().toLowerCase();
  const candidates = [
    ...loadTools().map(t => ({
      id: `tool:${t.path}`, label: t.name || t.id, group: '工具', action: `tool:${t.path}`,
      // 英文 id 作为附加搜索词：输入 todo / notes / qr 等英文也能命中中文命名的工具
      keywords: String(t.id || ''),
    })),
    ...STATIC_ACTIONS,
  ];
  const recent = readRecent();
  const score = (label) => {
    const l = String(label || '').toLowerCase();
    if (!q) return 50;
    if (l === q) return 100;
    if (l.startsWith(q)) return 80;
    if (l.includes(q)) return 60;
    return 0;
  };
  return candidates
    .map(item => ({
      ...item,
      score: Math.max(score(item.label), item.keywords ? score(item.keywords) * 0.9 : 0)
        + (recent.indexOf(item.id) >= 0 ? 5 : 0),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, SEARCH_MAX_RESULTS);
}

// ───────────────────────── P1-1 / P1-6 剪贴板与场景卡片 ─────────────────────────
const CARRIER_RULES = [
  { carrier: '顺丰', re: /^SF\d{12,15}$/i },
  { carrier: '圆通', re: /^YT\d{13,15}$/i },
  { carrier: '中通', re: /^(75|78|68)\d{10,14}$/ },
  { carrier: '韵达', re: /^(31|43|46)\d{11,13}$/ },
  { carrier: '京东', re: /^JD[A-Z0-9]{10,20}$/i },
];
const REPLY_TEMPLATES = [
  { keys: ['发货', '什么时候', '物流'], text: '您好，已为您加急安排发货，稍后提供物流单号，请耐心等待～' },
  { keys: ['退款', '退货'], text: '您好，退款申请已收到，我们会在 24 小时内处理并告知进度，请放心～' },
  { keys: ['包邮', '优惠', '便宜'], text: '您好，当前店铺有活动优惠，下单即可享受，需要我帮您核对吗？' },
  { keys: ['发票', '开票'], text: '您好，可以开具电子发票，请把抬头和税号发我，我们尽快安排～' },
];

let lastClipboardText = '';
let lastHintAt = 0;
let unsubscribeClipboard = null;

const getLastClipboardText = () => lastClipboardText;

function handleClipboardText(raw) {
  const text = String(raw || '').trim();
  if (!text) return;
  const s = loadSettings();
  const maxLen = num(s.floatClipboardHintMaxLen, 2000, 20, 20000);
  const minLen = num(s.floatClipboardHintMinLen, 10, 5, maxLen);
  const cooldown = num(s.floatClipboardHintCooldownMs, 8000, 1000, 120000);
  const duplicated = text === lastClipboardText && Date.now() - lastHintAt < cooldown;
  const remember = () => { lastClipboardText = text; lastHintAt = Date.now(); };

  // 业务卡片优先于通用提示，且不受通用提示的最小长度限制（单号/短问句都可能很短）
  if (enabled('floatShopAssistantEnabled') && !duplicated && text.length <= maxLen) {
    const order = text.match(/[A-Za-z0-9-]{8,24}/g)?.find(token => CARRIER_RULES.some(rule => rule.re.test(token)));
    if (order) {
      const carrier = CARRIER_RULES.find(rule => rule.re.test(order)).carrier;
      remember();
      card(`识别到${carrier}单号 ${order}`, [
        { label: '查询物流', action: `shop:track:${carrier}:${order}` },
        { label: '复制单号', action: 'shop:copy-order' },
      ], 8000);
      return;
    }
    const replies = REPLY_TEMPLATES.filter(t => t.keys.some(k => text.includes(k))).slice(0, 3);
    if (replies.length > 0) {
      remember();
      card('买家消息 · 推荐话术', replies.map((r, i) => ({
        label: `回复${i + 1}`, action: `shop:reply:${i}`,
      })), 8000);
      lastReplies = replies.map(r => r.text);
      return;
    }
  }

  if (text.length < minLen || text.length > maxLen || duplicated) return;
  if (!enabled('floatClipboardHintEnabled')) return;
  remember();
  card(`已复制 ${text.length} 字`, [
    { label: '翻译', action: 'clipboard:translate' },
    { label: '总结', action: 'clipboard:summarize' },
    { label: '存笔记', action: 'clipboard:note' },
  ], 6000);
}

let lastReplies = [];

function syncClipboardSubscription() {
  const shouldListen = enabled('floatClipboardHintEnabled') || enabled('floatShopAssistantEnabled');
  if (shouldListen && !unsubscribeClipboard) {
    unsubscribeClipboard = require('../ipc/clipboardIpc.cjs').subscribeClipboardText(handleClipboardText);
  } else if (!shouldListen && unsubscribeClipboard) {
    unsubscribeClipboard();
    unsubscribeClipboard = null;
  }
}

// ───────────────────────── P1-2 快速捕捉 ─────────────────────────
const CAPTURE_PROMPT = [
  '把用户输入分类为 todo / reminder / note 三类，只输出严格 JSON，不要代码块、不要解释。',
  '格式：{"kind":"todo|reminder|note","title":"不超过40字","time":"ISO8601或空字符串","tags":[]}',
  '规则：含明确时间点 → reminder；含待办/记得/要买等动作但无时间 → todo；纯想法/信息 → note。',
  'tags 最多 3 个。',
].join('\n');

function parseCaptureDraft(raw) {
  const cleaned = String(raw || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    const kind = ['todo', 'reminder', 'note'].includes(obj.kind) ? obj.kind : 'note';
    return {
      kind,
      title: String(obj.title || '').replace(/[\r\n]/g, ' ').slice(0, 80),
      time: typeof obj.time === 'string' ? obj.time.slice(0, 40) : '',
      tags: Array.isArray(obj.tags) ? obj.tags.map(String).slice(0, 5) : [],
    };
  } catch { return null; }
}

async function callModel(messages, timeoutMs = 60000) {
  const service = require('./floatAssistantService.cjs');
  await service.ensureAIConfigSnapshot();
  const model = service.resolveModel();
  if (!model) throw new Error('还没有可用的 AI 模型，请前往 设置 → AI 设置 添加');
  const { handleChat } = require('../ipc/aiIpc.cjs');
  const result = await handleChat(null, {
    url: service.buildChatUrl(model),
    apiKey: model.api_key,
    body: { model: model.model_id, messages, stream: false },
    timeoutMs,
  });
  if (!result || !result.success || !result.content) throw new Error((result && result.error) || 'AI 未返回内容');
  return result.content;
}

async function captureClassify(text) {
  const input = String(text || '').trim();
  if (!input) return { ok: false, error: '内容为空' };
  let draft = null;
  try {
    draft = parseCaptureDraft(await callModel([
      { role: 'system', content: CAPTURE_PROMPT }, { role: 'user', content: input },
    ]));
    if (!draft) {
      draft = parseCaptureDraft(await callModel([
        { role: 'system', content: CAPTURE_PROMPT + ' 只输出 JSON，不要代码块。' },
        { role: 'user', content: input },
      ]));
    }
  } catch (error) {
    return { ok: false, error: error.message };
  }
  // 兜底：解析失败或时间缺失统一降级，避免写出错误结构的记录
  if (!draft || !draft.title) {
    return { ok: true, draft: { kind: 'note', title: input.slice(0, 40), time: '', tags: [] }, fallback: true, text: input };
  }
  if (draft.kind === 'reminder' && !draft.time) draft.kind = 'todo';
  return { ok: true, draft, fallback: false, text: input };
}

function captureCommit(draft, text) {
  const content = String(text || '').trim();
  if (!content) return { ok: false, error: '内容为空' };
  const kind = draft && draft.kind === 'note' ? 'note' : 'todo';
  const title = (draft && draft.title) || content.slice(0, 40);
  if (kind === 'note') {
    try {
      const notesService = require('./notesService.cjs');
      if (!notesService.hasRootPath()) return { ok: false, error: '还没有设置笔记目录' };
      const stamp = new Date();
      const pad = n => String(n).padStart(2, '0');
      const name = `快速捕捉 ${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}-${pad(stamp.getMinutes())}`;
      const result = notesService.createNoteForce('', name, 'rename', `${content}\n\n> 分类：${title}`);
      if (!result || !result.success) return { ok: false, error: (result && result.error) || '保存失败' };
    } catch (error) { return { ok: false, error: error.message }; }
  } else {
    // 与面板「存为待办」完全同一条路径：主进程不重复实现 todo 写入
    const { getMainWindow } = require('../window/mainWindow.cjs');
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return { ok: false, error: '主窗口未就绪' };
    const description = [content, draft && draft.time ? `时间：${draft.time}` : '', (draft && draft.tags || []).join(' / ')].filter(Boolean).join('\n');
    win.webContents.send('float-ai-save-todo', { title, description });
  }
  petState('happy', 3000);
  // 成功提示走洞察服务的统一仲裁（总开关/锁屏/免打扰），行为不变、只是过一道守卫
  try { require('./floatInsightService.cjs').notifyEvent('capture:done', { kind }); } catch { /* 服务未加载时静默 */ }
  return { ok: true, kind };
}

// ───────────────────────── P3 对话历史 ─────────────────────────
// 复用 history 作为唯一数据源：面板每次「一轮回复完成」后整段 upsert，文件只有几 KB
const HISTORY_VERSION = 1;
const MAX_HISTORY_SESSIONS = 50;
const MAX_HISTORY_MESSAGES = 12;          // 与渲染层 MAX_HISTORY 对齐，恢复后语义一致
const MAX_HISTORY_CONTENT = 4000;
const HISTORY_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const HISTORY_ID_RE = /^[a-z0-9-]{6,40}$/;

const historyPath = () => path.join(app.getPath('userData'), 'float-chat-history.json');

function sanitizeHistoryMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .slice(-MAX_HISTORY_MESSAGES)
    .map(item => {
      const message = { role: item.role, content: item.content.slice(0, MAX_HISTORY_CONTENT) };
      if (typeof item.label === 'string' && item.label) message.label = item.label.slice(0, 16);
      return message;
    });
}

function sanitizeHistorySession(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const messages = sanitizeHistoryMessages(raw.messages);
  if (!messages.length) return null;
  const id = HISTORY_ID_RE.test(String(raw.id || '')) ? String(raw.id) : '';
  if (!id) return null;
  const firstUser = messages.find(item => item.role === 'user');
  const fallbackTitle = firstUser
    ? `${firstUser.label ? `[${firstUser.label}] ` : ''}${firstUser.content}`
    : '新对话';
  const title = String(raw.title || fallbackTitle).replace(/\s+/g, ' ').trim().slice(0, 24) || '新对话';
  const createdAt = Number(raw.createdAt) || Date.now();
  const updatedAt = Number(raw.updatedAt) || createdAt;
  return { id, title, createdAt, updatedAt, messages };
}

function readChatHistory() {
  try {
    const file = historyPath();
    if (!fs.existsSync(file)) return { version: HISTORY_VERSION, sessions: [] };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const sessions = Array.isArray(parsed && parsed.sessions)
      ? parsed.sessions.map(sanitizeHistorySession).filter(Boolean)
      : [];
    return { version: HISTORY_VERSION, sessions };
  } catch {
    // 非法 JSON 自愈：下次写入时覆盖，不阻断面板
    return { version: HISTORY_VERSION, sessions: [] };
  }
}

function pruneHistorySessions(sessions) {
  const deadline = Date.now() - HISTORY_TTL_MS;
  return sessions
    .filter(item => item && Number(item.updatedAt) >= deadline)
    .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
    .slice(0, MAX_HISTORY_SESSIONS);
}

function writeChatHistory(sessions) {
  const file = historyPath();
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify({ version: HISTORY_VERSION, sessions }, null, 2));
  fs.renameSync(tmp, file);
}

// 列表只下发摘要，正文按需单条读取，避免一次性把全部内容送进渲染层
const summarizeHistory = (sessions) => sessions.map(item => ({
  id: item.id,
  title: item.title,
  updatedAt: item.updatedAt,
  messageCount: item.messages.length,
}));

function historyList() {
  return summarizeHistory(pruneHistorySessions(readChatHistory().sessions));
}

function historyGet(id) {
  const session = readChatHistory().sessions.find(item => item.id === id);
  return session ? { ok: true, session } : { ok: false, error: '记录不存在' };
}

function historySave(payload) {
  const messages = sanitizeHistoryMessages(payload && payload.messages);
  if (!messages.length) return { ok: false, error: '没有可保存的内容' };
  const now = Date.now();
  const rawId = String((payload && payload.id) || '');
  const id = HISTORY_ID_RE.test(rawId) ? rawId : `s-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const firstUser = messages.find(item => item.role === 'user');
  const fallbackTitle = firstUser
    ? `${firstUser.label ? `[${firstUser.label}] ` : ''}${firstUser.content}`
    : '新对话';
  const title = String((payload && payload.title) || fallbackTitle).replace(/\s+/g, ' ').trim().slice(0, 24) || '新对话';
  const sessions = pruneHistorySessions(readChatHistory().sessions);
  const session = {
    id,
    title,
    createdAt: Number(payload && payload.createdAt) || now,
    updatedAt: now,
    messages,
  };
  try {
    writeChatHistory(pruneHistorySessions([session, ...sessions.filter(item => item.id !== id)]));
  } catch (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id };
}

function historyRemove(id) {
  const sessions = pruneHistorySessions(readChatHistory().sessions).filter(item => item.id !== id);
  try {
    writeChatHistory(sessions);
  } catch (error) {
    return { ok: false, error: error.message, items: summarizeHistory(sessions) };
  }
  return { ok: true, items: summarizeHistory(sessions) };
}

function historyClear() {
  try {
    writeChatHistory([]);
  } catch (error) {
    return { ok: false, error: error.message, items: historyList() };
  }
  return { ok: true, items: [] };
}

// ───────────────────────── IPC 注册（唯一入口）─────────────────────────
let registered = false;

function registerFloatFeatureIpc() {
  if (registered) return;
  registered = true;
  syncClipboardSubscription();

  ipcMain.handle('float:shelf-add', (_event, paths) => shelfAdd(paths));
  ipcMain.handle('float:shelf-list', () => shelfList());
  ipcMain.handle('float:shelf-remove', (_event, id) => shelfRemove(id));
  ipcMain.handle('float:shelf-clear', () => shelfClear());
  ipcMain.on('float:shelf-drag-out', (event, id) => shelfDragOut(event, id));
  ipcMain.handle('float:search', (_event, query) => searchAll(query));
  ipcMain.handle('float:search-exec', (_event, payload = {}) => {
    if (typeof payload.id === 'string') pushRecent(payload.id);
    const { dispatch } = require('../window/float/actions.cjs');
    const result = dispatch(payload.action, {
      guard: (run) => {
        if (loadSettings().isLockEnabled === 1) {
          require('../window/lockWindow.cjs').toggleLock();
          return false;
        }
        run();
        return true;
      },
    });
    return { ok: true, result };
  });
  ipcMain.handle('float:capture-classify', (_event, text) => captureClassify(text));
  ipcMain.handle('float:capture-commit', (_event, payload = {}) => captureCommit(payload.draft, payload.text));

  // 对话历史只允许面板窗口调用（与 shelfDragOut 同一守卫口径）
  const isPanelEvent = (event) => {
    try { return require('../window/floatPanelWindow.cjs').isPanelSender(event); } catch { return false; }
  };
  ipcMain.handle('float:history-list', (event) => (
    isPanelEvent(event) ? { ok: true, items: historyList() } : { ok: false, error: '未授权' }
  ));
  ipcMain.handle('float:history-get', (event, id) => (
    isPanelEvent(event) ? historyGet(String(id || '')) : { ok: false, error: '未授权' }
  ));
  ipcMain.handle('float:history-save', (event, payload) => (
    isPanelEvent(event) ? historySave(payload) : { ok: false, error: '未授权' }
  ));
  ipcMain.handle('float:history-remove', (event, id) => (
    isPanelEvent(event) ? historyRemove(String(id || '')) : { ok: false, error: '未授权' }
  ));
  ipcMain.handle('float:history-clear', (event) => (
    isPanelEvent(event) ? historyClear() : { ok: false, error: '未授权' }
  ));
}

module.exports = {
  registerFloatFeatureIpc,
  syncClipboardSubscription,
  getLastClipboardText,
  getLastReplies: () => lastReplies,
  captureCommit,
};
