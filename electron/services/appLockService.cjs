// 应用锁核心服务：外部应用联动锁定/恢复的业务编排。
// - 配置持久化：userData/appLock.json（独立于 settings.json，结构化数组不适合键值式 settings）
// - 锁定 = 进程挂起（ntProcessController，koffi 直调 ntdll）+ 窗口遮罩标识（appLockOverlayWindow）
// - 挂载点：lockWindow.cjs 的 lock()/unlock()/checkLockOnStartup() 三处钩子（fire-and-forget，
//   本模块内部自吞异常，任何失败都不影响锁定/解锁主流程）
// - 崩溃自愈：runtime.lockedPids 落盘，启动时无条件恢复（宁可多恢复，不可把用户进程永久冻结）
const { app, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { loadSettings } = require('../lib/config.cjs');
const nt = require('../lib/ntProcessController.cjs');

const CONFIG_VERSION = 1;
const WATCH_INTERVAL_MS = 5000;

let configCache = null;
let lockedActive = false; // 本应用是否处于锁定态（由钩子维护）
let watchTimer = null;
let quitHookInstalled = false;

const getConfigPath = () => path.join(app.getPath('userData'), 'appLock.json');

const buildDefaultConfig = () => ({
  version: CONFIG_VERSION,
  masterEnabled: true,
  apps: [],
  runtime: { lockedPids: {} },
});

function normalizeConfig(parsed) {
  const config = buildDefaultConfig();
  if (parsed && typeof parsed === 'object') {
    config.masterEnabled = parsed.masterEnabled !== false;
    if (Array.isArray(parsed.apps)) {
      config.apps = parsed.apps
        .filter((a) => a && typeof a === 'object' && a.id && a.exePath)
        .map((a) => ({
          id: String(a.id),
          name: String(a.name || '').slice(0, 40),
          exePath: String(a.exePath),
          processNames: Array.isArray(a.processNames)
            ? a.processNames.map(nt.sanitizeProcessName).filter(Boolean)
            : [nt.sanitizeProcessName(nt.resolveProcessName(a.exePath))].filter(Boolean),
          // 图标为 PNG 裸 base64（与快启动 QuickLaunchItem.icon 同约定）
          icon: typeof a.icon === 'string' ? a.icon : '',
          enabled: a.enabled !== false,
          addedAt: Number(a.addedAt) || Date.now(),
        }));
    }
    if (parsed.runtime && typeof parsed.runtime.lockedPids === 'object' && parsed.runtime.lockedPids) {
      for (const [appId, entry] of Object.entries(parsed.runtime.lockedPids)) {
        if (entry && Array.isArray(entry.pids)) {
          config.runtime.lockedPids[appId] = {
            pids: entry.pids.filter((pid) => Number.isInteger(pid) && pid > 0),
            processNames: Array.isArray(entry.processNames) ? entry.processNames.map(String) : [],
            partial: Boolean(entry.partial),
          };
        }
      }
    }
  }
  return config;
}

function loadConfig() {
  if (configCache) return configCache;
  try {
    configCache = normalizeConfig(JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8')));
  } catch {
    // 文件不存在或损坏：回默认空配置，不崩主进程
    configCache = buildDefaultConfig();
  }
  return configCache;
}

function saveConfig() {
  if (!configCache) return;
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(configCache, null, 2));
  } catch (error) {
    console.error('[AppLock] 配置写入失败:', error.message);
  }
}

const getOverlay = () => require('../window/appLockOverlayWindow.cjs');

const normalize = (name) => String(name || '').toLowerCase().replace(/\.exe$/, '').trim();

/** 当前锁定快照（供遮罩层消费） */
const buildOverlaySnapshot = () => {
  const config = loadConfig();
  const snapshot = [];
  for (const appEntry of config.apps) {
    const entry = config.runtime.lockedPids[appEntry.id];
    if (entry && entry.pids.length) {
      snapshot.push({
        appId: appEntry.id,
        name: appEntry.name,
        pids: entry.pids,
        partial: entry.partial,
      });
    }
  }
  return snapshot;
};

/** 锁定单个应用条目：找运行中 PID → 挂起 → 记录快照。未运行返回 false（静默跳过） */
async function lockAppEntry(appEntry) {
  const config = loadConfig();
  const pids = await nt.findPidsByNames(appEntry.processNames);
  if (!pids.length) return false;

  const { ok } = await nt.suspendPids(pids);
  config.runtime.lockedPids[appEntry.id] = {
    pids: ok,
    processNames: appEntry.processNames,
    partial: ok.length < pids.length,
  };
  if (!ok.length) {
    console.warn(`[AppLock] ${appEntry.name} 挂起失败（可能以管理员权限运行），仅保留遮罩提示`);
  }
  return true;
}

/** 恢复单个应用条目：PID 复用防护（镜像名不匹配则跳过），再清理快照 */
async function resumeAppEntry(appId) {
  const config = loadConfig();
  const entry = config.runtime.lockedPids[appId];
  if (!entry) return;

  let images = null;
  try { images = await nt.listAllProcessImages(); } catch { images = null; }

  // PID 存在且镜像名与记录一致才恢复：PID 已失效→无事可做；被复用→绝不误恢复无关进程。
  // 镜像枚举不可用时退回无条件恢复（NtResumeProcess 对未挂起进程无副作用）
  let targets;
  if (images) {
    targets = entry.pids.filter((pid) => {
      const image = images.get(pid);
      return image && entry.processNames.some((n) => normalize(n) === image);
    });
  } else {
    targets = entry.pids;
  }
  if (targets.length) await nt.resumePids(targets);
  delete config.runtime.lockedPids[appId];
}

function scheduleWatch() {
  if (!lockedActive) return;
  if (watchTimer) clearTimeout(watchTimer);
  watchTimer = setTimeout(() => {
    watchTimer = null;
    watchTick()
      .catch((error) => console.error('[AppLock] 轮询异常:', error.message))
      .finally(() => {
        if (lockedActive) scheduleWatch();
      });
  }, WATCH_INTERVAL_MS);
}

function startWatchTimer() {
  if (watchTimer) return;
  scheduleWatch();
}

function stopWatchTimer() {
  if (watchTimer) {
    clearTimeout(watchTimer);
    watchTimer = null;
  }
}

/** 轮询兜底：捕获锁定期间新启动的应用；清理进程已退出的快照；刷新遮罩（覆盖同一应用新开的窗口） */
async function watchTick() {
  if (!lockedActive) { stopWatchTimer(); return; }
  const config = loadConfig();

  // 一次 tasklist 全量镜像：用于清理"进程已被用户关闭"的快照
  let images = null;
  try { images = await nt.listAllProcessImages(); } catch { images = null; }

  for (const [appId, entry] of Object.entries(config.runtime.lockedPids)) {
    if (images) {
      const alive = entry.pids.filter((pid) => {
        const image = images.get(pid);
        return image && entry.processNames.some((n) => normalize(n) === image);
      });
      if (entry.pids.length && !alive.length) delete config.runtime.lockedPids[appId];
      else if (alive.length) entry.pids = alive;
    }
  }

  for (const appEntry of config.apps) {
    if (!appEntry.enabled || config.runtime.lockedPids[appEntry.id]) continue;
    await lockAppEntry(appEntry);
  }

  saveConfig();
  getOverlay().syncOverlays(buildOverlaySnapshot());
}

// ── 挂载点 API（lockWindow.cjs 钩子调用） ─────────────────────────────────────

let lockedNotification = null;

/** 锁定成功后弹常驻通知：解释被挂起应用窗口/托盘图标点击无响应属正常，避免误以为卡死 */
function notifyLocked(names) {
  if (!names.length) return;
  try {
    closeLockedNotification();
    const preview = names.slice(0, 3).join('、');
    const suffix = names.length > 3 ? ` 等 ${names.length} 个应用` : '';
    lockedNotification = new Notification({
      title: '应用已锁定',
      body: `${preview}${suffix}已被挂起，窗口与托盘图标点击无响应属正常，解锁 ToolBox 后自动恢复`,
      timeoutType: 'never',
      silent: true,
    });
    lockedNotification.show();
  } catch { /* 通知不可用仅忽略，不影响锁定主流程 */ }
}

/** 收起常驻通知（解锁 / 退出锁定时调用；无通知时为空操作） */
function closeLockedNotification() {
  try { lockedNotification?.close(); } catch { /* 已关闭仅忽略 */ }
  lockedNotification = null;
}

/** 本应用进入锁定态（仅手动锁入口调用；启动/重启即锁场景不联动，见 lockWindow.cjs） */
function onAppLocked() {
  try {
    const config = loadConfig();
    if (lockedActive || !config.masterEnabled) return;
    lockedActive = true;
    ensureQuitHook();

    const run = async () => {
      const lockedNames = [];
      for (const appEntry of config.apps) {
        if (!appEntry.enabled) continue;
        await lockAppEntry(appEntry);
        // 仅统计确实挂起成功的应用，避免管理员权限目标误报「已被挂起」
        if (config.runtime.lockedPids[appEntry.id]?.pids?.length) lockedNames.push(appEntry.name);
      }
      saveConfig();
      getOverlay().syncOverlays(buildOverlaySnapshot());
      startWatchTimer();
      notifyLocked(lockedNames);
    };
    run().catch((error) => console.error('[AppLock] 联动锁定失败:', error.message));
  } catch (error) {
    console.error('[AppLock] 联动锁定入口异常:', error.message);
  }
}

/** 本应用退出锁定态：最先销毁遮罩（解锁瞬间无残留），再恢复进程、停轮询 */
function onAppUnlocking() {
  try {
    lockedActive = false;
    stopWatchTimer();
    getOverlay().destroyAllOverlays();
    closeLockedNotification();

    const config = loadConfig();
    const ids = Object.keys(config.runtime.lockedPids);
    if (!ids.length) return;

    const run = async () => {
      for (const appId of ids) await resumeAppEntry(appId);
      saveConfig();
    };
    run().catch((error) => console.error('[AppLock] 联动恢复失败:', error.message));
  } catch (error) {
    console.error('[AppLock] 联动恢复入口异常:', error.message);
  }
}

/**
 * 启动自愈：上次会话（锁定中崩溃/强杀）遗留的挂起进程无条件恢复。
 * 由 appLockIpc 注册时触发；即使 masterEnabled 已被关掉也必须恢复。
 */
async function recoverOnStartup() {
  const config = loadConfig();
  const ids = Object.keys(config.runtime.lockedPids);
  if (!ids.length) return { recovered: 0 };

  let images = null;
  try { images = await nt.listAllProcessImages(); } catch { images = null; }

  let recovered = 0;
  for (const appId of ids) {
    const entry = config.runtime.lockedPids[appId];
    const targets = (entry.pids || []).filter((pid) => {
      const image = images ? images.get(pid) : null;
      return image && entry.processNames.some((n) => normalize(n) === image);
    });
    if (targets.length) {
      await nt.resumePids(targets);
      recovered += targets.length;
    }
  }
  config.runtime.lockedPids = {};
  saveConfig();
  if (recovered) console.info(`[AppLock] 启动自愈：已恢复 ${recovered} 个上次遗留的挂起进程`);
  return { recovered };
}

/** 应用正常退出兜底：强制终止所有被联动挂起的外部进程，防止成为孤儿；
 * 恢复逻辑由下次启动时 recoverOnStartup 负责（崩溃/强杀残留场景）。 */
function ensureQuitHook() {
  if (quitHookInstalled) return;
  quitHookInstalled = true;
  app.on('before-quit', () => {
    try {
      const config = loadConfig();
      const pids = Object.values(config.runtime.lockedPids)
        .flatMap((entry) => entry.pids || []);
      if (pids.length) {
        nt.terminatePids(pids);
        config.runtime.lockedPids = {};
        saveConfig();
      }
    } catch { /* 退出兜底失败交给下次启动自愈 */ }
  });
}

// ── 配置管理 API（appLockIpc 调用） ───────────────────────────────────────────

function getConfig() {
  const config = loadConfig();
  return {
    masterEnabled: config.masterEnabled,
    apps: config.apps.map(({ id, name, exePath, processNames, icon, enabled, addedAt }) => ({
      id, name, exePath, processNames, icon, enabled, addedAt,
    })),
  };
}

function setMasterEnabled(enabled) {
  const config = loadConfig();
  const next = Boolean(enabled);
  if (config.masterEnabled === next) return { success: true };
  config.masterEnabled = next;
  saveConfig();

  if (!next && lockedActive) {
    // 总开关关闭：立即恢复所有联动锁定的进程并撤掉遮罩（本应用保持锁定态）
    onAppUnlocking();
  } else if (next && !lockedActive && loadSettings().isLockEnabled === 1) {
    // 锁定态下重新打开总开关：立即执行一次联动
    onAppLocked();
  }
  return { success: true };
}

function resolveApp(exePath) {
  const name = nt.resolveProcessName(exePath);
  if (!name) return { name: '', processNames: [], protected: true };
  return { name, processNames: [name], protected: nt.isProtectedName(name) };
}

function addApp(payload) {
  const config = loadConfig();
  const exePath = String((payload && payload.exePath) || '').trim();
  if (!exePath) return { success: false, error: '缺少应用路径' };

  const resolved = resolveApp(exePath);
  if (!resolved.name) return { success: false, error: '无效的应用路径' };
  if (resolved.protected) return { success: false, error: '系统关键进程不允许锁定' };

  const processNames = Array.isArray(payload.processNames) && payload.processNames.length
    ? [...new Set(payload.processNames.map(nt.sanitizeProcessName).filter(Boolean))]
    : resolved.processNames;
  if (!processNames.length || processNames.some(nt.isProtectedName)) {
    return { success: false, error: '系统关键进程不允许锁定' };
  }

  const exists = config.apps.some((a) => a.exePath.toLowerCase() === exePath.toLowerCase());
  if (exists) return { success: false, error: '该应用已在列表中' };

  const appEntry = {
    id: crypto.randomUUID(),
    name: String(payload.name || resolved.name).slice(0, 40),
    exePath,
    processNames,
    icon: typeof payload.icon === 'string' ? payload.icon : '',
    enabled: true,
    addedAt: Date.now(),
  };
  config.apps.push(appEntry);
  saveConfig();

  // 锁定态下添加（轮询兜底前的即时生效）
  if (lockedActive) {
    lockAppEntry(appEntry)
      .then(() => { saveConfig(); getOverlay().syncOverlays(buildOverlaySnapshot()); })
      .catch((error) => console.error('[AppLock] 新增应用联动失败:', error.message));
  }
  return { success: true, app: appEntry };
}

async function removeApp(id) {
  const config = loadConfig();
  const index = config.apps.findIndex((a) => a.id === id);
  if (index < 0) return { success: false, error: '应用不存在' };

  // 移除前先恢复（若正被联动锁定）
  if (config.runtime.lockedPids[id]) await resumeAppEntry(id);
  config.apps.splice(index, 1);
  saveConfig();
  if (lockedActive) getOverlay().syncOverlays(buildOverlaySnapshot());
  return { success: true };
}

async function toggleApp(id, enabled) {
  const config = loadConfig();
  const appEntry = config.apps.find((a) => a.id === id);
  if (!appEntry) return { success: false, error: '应用不存在' };

  const next = Boolean(enabled);
  if (appEntry.enabled === next) return { success: true };

  if (!next && lockedActive && config.runtime.lockedPids[id]) {
    // 单条关闭：锁定态下立即恢复该应用
    await resumeAppEntry(id);
    if (lockedActive) getOverlay().syncOverlays(buildOverlaySnapshot());
  }
  appEntry.enabled = next;
  saveConfig();

  if (next && lockedActive && !config.runtime.lockedPids[id]) {
    // 单条开启（锁定态下）：立即联动
    await lockAppEntry(appEntry);
    saveConfig();
    getOverlay().syncOverlays(buildOverlaySnapshot());
  }
  return { success: true };
}

/** 各应用运行/锁定状态（设置页轮询） */
async function getStatus() {
  const config = loadConfig();
  const result = [];
  for (const appEntry of config.apps) {
    const entry = config.runtime.lockedPids[appEntry.id];
    let pids = [];
    try { pids = await nt.findPidsByNames(appEntry.processNames); } catch { pids = []; }
    result.push({
      appId: appEntry.id,
      running: pids.length > 0,
      locked: Boolean(entry && entry.pids.length),
      partial: Boolean(entry && entry.partial),
      blocked: Boolean(entry && !entry.pids.length), // 挂起失败（如管理员权限）
      pids: entry ? entry.pids : pids,
    });
  }
  return result;
}

module.exports = {
  onAppLocked,
  onAppUnlocking,
  recoverOnStartup,
  getConfig,
  setMasterEnabled,
  resolveApp,
  addApp,
  removeApp,
  toggleApp,
  getStatus,
};
