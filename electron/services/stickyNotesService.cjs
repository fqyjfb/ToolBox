// 便签本地存储：主进程唯一写入方。
// 页面、悬浮球面板、钉桌面窗口都通过 IPC 读写这里，避免多端各存一份导致不一致。
// 文件损坏时备份原文件并以空数据启动，绝不阻塞应用。
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, screen } = require('electron');

const FILE_NAME = 'sticky-notes.json';
const DRAFT_FILE_NAME = 'sticky-drafts.json';
const MAX_NOTES = 1000;
const MAX_PINNED = 50;
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
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(Math.min(Math.max(width, 200), 1200)),
    height: Math.round(Math.min(Math.max(height, 160), 1200)),
  };
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
    // 启动时裁剪所有钉住便签的 bounds 到可见区域内，修复历史上显示器插拔/缩放变化后可能留下的离屏坐标
    clipAllPinnedToWorkArea();
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.error('[StickyNotes] 数据文件读取失败，已备份并重建:', error.message);
      backupCorruptedFile(filePath);
    }
    cache = { version: 1, notes: [] };
  }
  return cache;
};

// 把 bounds 裁剪到当前所有显示器 workArea 并集内，保留 8px 边距方便边缘拖动
const clipBoundsToWorkArea = (bounds) => {
  if (!bounds) return bounds;
  const displays = screen.getAllDisplays();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  displays.forEach((display) => {
    const area = display.workArea;
    minX = Math.min(minX, area.x);
    minY = Math.min(minY, area.y);
    maxX = Math.max(maxX, area.x + area.width);
    maxY = Math.max(maxY, area.y + area.height);
  });
  if (!Number.isFinite(minX)) return bounds;
  const MARGIN = 8;
  const clipped = {
    x: Math.max(minX - MARGIN, Math.min(maxX - bounds.width - MARGIN, bounds.x)),
    y: Math.max(minY - MARGIN, Math.min(maxY - bounds.height - MARGIN, bounds.y)),
    width: bounds.width,
    height: bounds.height,
  };
  // 只有变化时才返回新对象，避免触发不必要的引用变更
  if (clipped.x === bounds.x && clipped.y === bounds.y) return bounds;
  return clipped;
};

// 启动时一次性修复所有钉住便签的离屏坐标 + 补历史缺失的默认 bounds（P2-1 listPinned 迁移纯化）
const clipAllPinnedToWorkArea = () => {
  const notes = cache?.notes;
  if (!notes) return;
  let changed = false;
  notes.forEach((note) => {
    if (!note.pinned) return;
    // 迁移：旧版本钉住时未写入 bounds，统一补一个不重叠的默认位置
    if (!note.bounds) {
      note.bounds = nextDefaultBounds(note.id);
      changed = true;
    }
    // 裁剪到可见区域内，修复显示器插拔/缩放变化后可能留下的离屏坐标
    const clipped = clipBoundsToWorkArea(note.bounds);
    if (clipped !== note.bounds) {
      note.bounds = clipped;
      changed = true;
    }
  });
  if (changed) {
    // 数据修复，不 broadcast 避免启动时刷一次墙
    void persist();
  }
};

// 串行写入：先写 tmp 再 rename，避免进程中断留下半截 JSON
// inQueue=true 时调用方已持有 writeQueue 锁，直接写文件；
// inQueue=false 时独立入队（clipAllPinnedToWorkArea 在 load() 里第一次调用就是这个场景）。
// 不管哪种，返回的 Promise resolve 代表磁盘落盘完成。
const persist = async (inQueue = false) => {
  const json = JSON.stringify(cache);
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
  if (!inQueue) {
    writeQueue = writeQueue.then(run, run).catch((error) => {
      console.error('[StickyNotes] 写入失败:', error.message);
    });
  }
  return run();
};

// ── 草稿持久化：保存失败时写入本地临时草稿，下次编辑时优先恢复 ──
// 草稿独立存储：不进主 writeQueue（丢了也不影响正式数据），单独文件避免污染主表
const getDraftsFilePath = () => path.join(app.getPath('userData'), DRAFT_FILE_NAME);

let draftsCache = null;
const loadDrafts = () => {
  if (draftsCache) return draftsCache;
  try {
    const raw = fs.readFileSync(getDraftsFilePath(), 'utf8');
    const parsed = typeof raw === 'string' && raw.trim() ? JSON.parse(raw) : {};
    draftsCache = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    draftsCache = {};
  }
  return draftsCache;
};

const persistDrafts = () => {
  if (!draftsCache) return;
  try {
    fs.writeFileSync(getDraftsFilePath(), JSON.stringify(draftsCache));
  } catch (error) {
    console.error('[StickyNotes] 草稿持久化失败:', error.message);
  }
};

const saveDraft = (id, content) => {
  if (!id || typeof content !== 'string') return { ok: false };
  const drafts = loadDrafts();
  drafts[id] = { content, savedAt: Date.now() };
  persistDrafts();
  return { ok: true };
};

const loadDraft = (id) => {
  if (!id) return { ok: false };
  const drafts = loadDrafts();
  const draft = drafts[id];
  if (!draft || typeof draft.content !== 'string') return { ok: false };
  return { ok: true, content: draft.content };
};

const clearDraft = (id) => {
  if (!id || !draftsCache) return { ok: false };
  if (draftsCache[id]) {
    delete draftsCache[id];
    persistDrafts();
  }
  return { ok: true };
};

// 原子化执行：把 读 → 改 cache → persist → broadcast 的完整链路包进 writeQueue，
// 保证多个并发 IPC 间不会互相基于同一份旧快照修改。
// 返回值是 fn() 自身的 return（如 { ok: true, note: {...} }），透传给调用方。
const runExclusive = async (fn) => {
  writeQueue = writeQueue.then(() => fn()).catch((error) => {
    console.error('[StickyNotes] 原子操作异常:', error.message);
    // 拒绝后 writeQueue 自身进入稳定态（不再 reject），让后续调用仍能排队
    return undefined;
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
  // load() 已在首次启动时完成迁移（补默认 bounds）和裁剪，这里纯读。
  return load().notes.filter((note) => note.pinned);
};

const get = (id) => {
  const note = findNote(id);
  return note ? { ok: true, note: { ...note } } : { ok: false, error: '便签不存在' };
};

const create = async (input = {}) => {
  // 同步校验：快速失败，不占写队列
  const content = typeof input.content === 'string' ? input.content : '';
  if (!content.trim()) return { ok: false, error: '内容不能为空' };
  if (content.length > MAX_CONTENT) return { ok: false, error: `单条便签不能超过 ${MAX_CONTENT} 字` };

  return runExclusive(async () => {
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
    await persist(true);
    broadcast({ action: 'created', id: note.id });
    return { ok: true, note: { ...note } };
  });
};

const update = async (input = {}) => {
  return runExclusive(async () => {
    // 在写锁内重新查找，保证拿到最新快照
    const note = findNote(input.id);
    if (!note) return { ok: false, error: '便签不存在' };

    // 乐观并发校验：调用方传入自己已知的 updatedAt，与磁盘上当前值不一致则说明
    // 另一窗口已在此期间修改过这条便签，返回冲突让调用方提示用户
    if (Number.isFinite(input.updatedAt) && input.updatedAt !== note.updatedAt) {
      return {
        ok: false,
        conflict: true,
        error: '此便签已被其他窗口修改，请刷新后重试',
        serverNote: { ...note },
      };
    }

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
    await persist(true);
    broadcast({ action: 'updated', id: note.id, clientId: input.clientId });
    clearDraft(input.id); // 更新成功 → 清掉可能存在的草稿
    return { ok: true, note: { ...note } };
  });
};

const remove = async (id) => {
  return runExclusive(async () => {
    const notes = load().notes;
    const index = notes.findIndex((note) => note.id === id);
    if (index < 0) return { ok: false, error: '便签不存在' };

    const removed = notes[index];
    notes.splice(index, 1);
    await persist(true);
    // 便签墙自动根据 listPinned 结果判断是否销毁
    if (removed.pinned) {
      try {
        const windowModule = require('../window/stickyNoteWallWindow.cjs');
        const remainingPinned = notes.filter((note) => note.pinned);
        if (!remainingPinned.length) {
          windowModule.destroyWall();
        }
      } catch (error) {
        console.error('[StickyNotes] 清理便签墙失败:', error.message);
      }
    }
    broadcast({ action: 'removed', id });
    clearDraft(id); // 删除便签 → 清掉对应草稿
    return { ok: true };
  });
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
const setPinned = async (input = {}) => {
  return runExclusive(async () => {
    const note = findNote(input.id);
    if (!note) return { ok: false, error: '便签不存在' };

    const pinned = Boolean(input.pinned);
    // 钉住数量上限（钉住时检查，取消钉住不检查）
    if (pinned && !note.pinned) {
      const currentPinned = load().notes.filter((item) => item.pinned).length;
      if (currentPinned >= MAX_PINNED) {
        return { ok: false, error: `最多同时钉住 ${MAX_PINNED} 条便签` };
      }
    }
    note.pinned = pinned;
    // 首次钉住必须有位置，否则渲染层只能落到默认坐标，多条便签会互相重叠
    if (pinned) {
      if (!note.bounds) note.bounds = nextDefaultBounds(note.id);
    } else {
      note.bounds = null;
    }
    note.updatedAt = Date.now();
    await persist(true);

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
  });
};

const saveBounds = async (input = {}) => {
  return runExclusive(async () => {
    const note = findNote(input.id);
    if (!note || !note.pinned) return { ok: false, error: '便签不在钉住状态' };
    // 合并式更新：渲染层只上报变化字段（拖拽 x/y、调宽 width）
    const base = note.bounds || { x: 120, y: 120, width: 280, height: 200 };
    let bounds = normalizeBounds({ ...base, ...(input.bounds || {}) });
    if (!bounds) return { ok: false, error: '窗口位置数据非法' };
    // 持久化前裁剪到可见区域内，防止显示器变化期间写入离屏坐标
    bounds = clipBoundsToWorkArea(bounds);
    note.bounds = bounds;
    await persist(true);
    // saveBounds 不广播——广播会让便签墙自己全量刷新（性能开销），
    // 且 bounds 变更后会触发 hit rect 重新上报，主进程看门狗已处理穿透状态
    return { ok: true, note: { ...note } };
  });
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
  // P1-3 草稿持久化：保存失败时兜底，下次编辑时恢复
  saveDraft,
  loadDraft,
  clearDraft,
};
