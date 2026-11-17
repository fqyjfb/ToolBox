// 便签本地存储：主进程唯一写入方。
// 页面、悬浮球面板、钉桌面窗口都通过 IPC 读写这里，避免多端各存一份导致不一致。
// 文件损坏时备份原文件并以空数据启动，绝不阻塞应用。
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const FILE_NAME = 'sticky-notes.json';
const MAX_NOTES = 1000;
const MAX_CONTENT = 20000;
const MAX_TITLE = 100;
const VALID_COLORS = new Set(['amber', 'blue', 'green', 'gray', 'rose', 'purple', 'cyan', 'orange']);
const ID_PATTERN = /^sn_[a-z0-9]+_[a-z0-9]{4,8}$/;

let cache = null;
let writeQueue = Promise.resolve();

const getFilePath = () => path.join(app.getPath('userData'), FILE_NAME);

const deriveTitle = (content) => {
  const firstLine = String(content || '').split('\n').find((line) => line.trim()) || '';
  return firstLine.replace(/^[#*>\-\s]+/, '').trim().slice(0, 60) || '无标题便签';
};

// 坐标必需，宽高可缺省（渲染层拖拽只上报 x/y、调宽只上报 width）
const normalizeBounds = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const width = Number.isFinite(Number(raw.width)) ? Number(raw.width) : 280;
  const height = Number.isFinite(Number(raw.height)) ? Number(raw.height) : 200;
  const bounds = {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(Math.min(Math.max(width, 200), 1200)),
    height: Math.round(Math.min(Math.max(height, 160), 1200)),
  };
  const displayId = Number(raw.displayId);
  if (Number.isFinite(displayId)) bounds.displayId = Math.round(displayId);
  return bounds;
};

const normalizeNote = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && ID_PATTERN.test(raw.id) ? raw.id : '';
  const content = typeof raw.content === 'string' ? raw.content : '';
  if (!id || !content.trim()) return null;

  const pinned = raw.pinned === true;
  const title = typeof raw.title === 'string' && raw.title.trim()
    ? raw.title.trim().slice(0, MAX_TITLE)
    : deriveTitle(content);
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt;

  return {
    id,
    title,
    content: content.slice(0, MAX_CONTENT),
    color: VALID_COLORS.has(raw.color) ? raw.color : 'amber',
    pinned,
    bounds: pinned ? normalizeBounds(raw.bounds) : null,
    createdAt,
    updatedAt,
  };
};

const backupCorruptedFile = (filePath) => {
  try {
    fs.renameSync(filePath, filePath.replace(/\.json$/, `.bak-${Date.now()}.json`));
  } catch (error) {
    console.error('[StickyNotes] 备份损坏文件失败:', error.message);
  }
};

const load = () => {
  if (cache) return cache;
  const filePath = getFilePath();
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const notes = Array.isArray(parsed && parsed.notes)
      ? parsed.notes.map(normalizeNote).filter(Boolean)
      : [];
    cache = { version: 1, notes };
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.error('[StickyNotes] 数据文件读取失败，已备份并重建:', error.message);
      backupCorruptedFile(filePath);
    }
    cache = { version: 1, notes: [] };
  }
  return cache;
};

// 串行写入：先写 tmp 再 rename，避免进程中断留下半截 JSON
const persist = () => {
  const json = JSON.stringify(load(), null, 2);
  const run = async () => {
    const filePath = getFilePath();
    const tmpPath = `${filePath}.tmp`;
    const handle = await fs.promises.open(tmpPath, 'w');
    try {
      await handle.writeFile(json, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.promises.rename(tmpPath, filePath);
  };
  writeQueue = writeQueue.then(run, run).catch((error) => {
    console.error('[StickyNotes] 写入失败:', error.message);
  });
  return writeQueue;
};

const broadcast = (payload) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.isDestroyed()) return;
    try {
      win.webContents.send('sticky-notes:changed', payload);
    } catch (error) {
      // 窗口正在销毁时发送会抛错，忽略即可
    }
  });
};

const sortNotes = (notes) => notes.slice().sort((a, b) => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return b.updatedAt - a.updatedAt;
});

const findNote = (id) => load().notes.find((note) => note.id === id) || null;

const newId = () => {
  const random = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `sn_${Date.now().toString(36)}_${random}`;
};

const list = () => sortNotes(load().notes);

const listPinned = () => {
  const pinnedNotes = load().notes.filter((note) => note.pinned);
  // 历史数据迁移：旧版本钉住时未写入 bounds，统一补一个不重叠的默认位置
  let migrated = false;
  pinnedNotes.forEach((note) => {
    if (note.bounds) return;
    note.bounds = nextDefaultBounds(note.id);
    migrated = true;
  });
  if (migrated) persist();
  return pinnedNotes;
};

const get = (id) => {
  const note = findNote(id);
  return note ? { ok: true, note: { ...note } } : { ok: false, error: '便签不存在' };
};

const create = (input = {}) => {
  const content = typeof input.content === 'string' ? input.content : '';
  if (!content.trim()) return { ok: false, error: '内容不能为空' };
  if (content.length > MAX_CONTENT) return { ok: false, error: `单条便签不能超过 ${MAX_CONTENT} 字` };

  const notes = load().notes;
  if (notes.length >= MAX_NOTES) return { ok: false, error: `便签数量已达上限（${MAX_NOTES} 条）` };

  const now = Date.now();
  const note = {
    id: newId(),
    title: typeof input.title === 'string' && input.title.trim()
      ? input.title.trim().slice(0, MAX_TITLE)
      : deriveTitle(content),
    content,
    color: VALID_COLORS.has(input.color) ? input.color : 'amber',
    pinned: false,
    bounds: null,
    createdAt: now,
    updatedAt: now,
  };
  notes.push(note);
  persist();
  broadcast({ action: 'created', id: note.id });
  return { ok: true, note: { ...note } };
};

const update = (input = {}) => {
  const note = findNote(input.id);
  if (!note) return { ok: false, error: '便签不存在' };

  const previousTitle = note.title;
  const previousAutoTitle = deriveTitle(note.content);

  if (typeof input.content === 'string') {
    if (!input.content.trim()) return { ok: false, error: '内容不能为空' };
    if (input.content.length > MAX_CONTENT) return { ok: false, error: `单条便签不能超过 ${MAX_CONTENT} 字` };
    note.content = input.content;
  }

  if (typeof input.title === 'string') {
    note.title = input.title.trim()
      ? input.title.trim().slice(0, MAX_TITLE)
      : deriveTitle(note.content);
  } else if (previousTitle === previousAutoTitle) {
    // 标题仍是自动取自首行时，正文变化后同步更新，避免列表标题过期
    note.title = deriveTitle(note.content);
  }

  if (VALID_COLORS.has(input.color)) note.color = input.color;

  note.updatedAt = Date.now();
  persist();
  broadcast({ action: 'updated', id: note.id, clientId: input.clientId });
  return { ok: true, note: { ...note } };
};

const remove = (id) => {
  const notes = load().notes;
  const index = notes.findIndex((note) => note.id === id);
  if (index < 0) return { ok: false, error: '便签不存在' };

  notes.splice(index, 1);
  persist();
  // 便签墙自动根据 listPinned 结果判断是否销毁
  try {
    const windowModule = require('../window/stickyNoteWallWindow.cjs');
    const remainingPinned = notes.filter((note) => note.pinned);
    if (!remainingPinned.length) {
      windowModule.destroyWall();
    }
  } catch (error) {
    console.error('[StickyNotes] 清理便签墙失败:', error.message);
  }
  broadcast({ action: 'removed', id });
  return { ok: true };
};

// 钉住时分配级联错位的默认位置，避免多条便签叠在同一坐标
const nextDefaultBounds = (excludeId) => {
  const used = load().notes.filter((item) => item.pinned && item.id !== excludeId && item.bounds);
  const step = 32;
  const isFree = (x, y) =>
    !used.some((item) => Math.abs(item.bounds.x - x) < 24 && Math.abs(item.bounds.y - y) < 24);
  let index = 0;
  while (index < 20 && !isFree(120 + index * step, 120 + index * step)) index += 1;
  return normalizeBounds({
    x: 120 + index * step,
    y: 120 + index * step,
    width: 280,
    height: 200,
  });
};

// 便签墙是单例窗口，有钉住便签 → openWall，全部取消钉住 → destroyWall
// 具体每条便签的显示/隐藏由渲染层根据广播刷新 DOM
const setPinned = (input = {}) => {
  const note = findNote(input.id);
  if (!note) return { ok: false, error: '便签不存在' };

  const pinned = Boolean(input.pinned);
  note.pinned = pinned;
  // 首次钉住必须有位置，否则渲染层只能落到默认坐标，多条便签会互相重叠
  if (pinned) {
    if (!note.bounds) note.bounds = nextDefaultBounds(note.id);
  } else {
    note.bounds = null;
  }
  note.updatedAt = Date.now();
  persist();

  if (!input.silent) {
    try {
      const windowModule = require('../window/stickyNoteWallWindow.cjs');
      if (pinned) {
        windowModule.openWall();
      } else {
        const remaining = load().notes.filter((item) => item.pinned && item.id !== note.id);
        if (!remaining.length) {
          windowModule.destroyWall();
        }
      }
    } catch (error) {
      console.error('[StickyNotes] 操作便签墙失败:', error.message);
    }
  }
  broadcast({ action: 'pinned-changed', id: note.id });
  return { ok: true, note: { ...note } };
};

const saveBounds = (input = {}) => {
  const note = findNote(input.id);
  if (!note || !note.pinned) return { ok: false, error: '便签不在钉住状态' };
  // 合并式更新：渲染层只上报变化字段（拖拽 x/y、调宽 width）
  const base = note.bounds || { x: 120, y: 120, width: 280, height: 200 };
  const bounds = normalizeBounds({ ...base, ...(input.bounds || {}) });
  if (!bounds) return { ok: false, error: '窗口位置数据非法' };
  note.bounds = bounds;
  persist();
  return { ok: true, note: { ...note } };
};

module.exports = {
  list,
  listPinned,
  get,
  create,
  update,
  remove,
  setPinned,
  saveBounds,
};
