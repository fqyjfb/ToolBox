// 应用锁"已锁定"遮罩窗口管理：为被联动锁定的外部应用窗口叠加可见的锁定标识。
// - 真正的锁定由进程挂起保证（ntProcessController），遮罩只是视觉标识（fail-soft：
//   任何枚举/创建失败都只记日志，绝不影响锁定/解锁主流程，更不影响其他功能）。
// - 遮罩窗口：无边框透明置顶、点击穿透（setIgnoreMouseEvents）、不可聚焦、不进任务栏。
// - 定位：koffi 枚举目标 PID 的顶层可见窗口取物理像素边界，换算 DIP 后 setBounds；
//   1s 跟随定时器做全量幂等同步（移动跟随 / 最小化隐藏 / 关闭销毁 / 新窗口补盖）。
const { BrowserWindow, screen, app } = require('electron');
const path = require('path');
const fs = require('fs');
const nt = require('../lib/ntProcessController.cjs');

// 每个应用最多跟踪的顶层可见窗口数：防止异常应用创建海量窗口拖垮主进程
const MAX_WINDOWS_PER_APP = 4;
const FOLLOW_INTERVAL_MS = 1000;

// key: `${appId}:${hwnd}` → { win, appId, pid, hwnd, bounds }
const overlays = new Map();
// 当前锁定快照：[{ appId, name, pids, partial }]
let trackedApps = [];
let followTimer = null;

function getOverlayHtmlPath() {
  const devPath = path.join(__dirname, './appLockOverlay/overlay.html');
  if (app.isPackaged) {
    const packagedPath = path.join(process.resourcesPath, 'app', 'electron', 'window', 'appLockOverlay', 'overlay.html');
    if (fs.existsSync(packagedPath)) return packagedPath;
  }
  return devPath;
}

/** 物理像素矩形 → DIP 边界（Electron setBounds 使用 DIP；多显示器按目标点所在屏换算） */
function physRectToDipBounds(rect) {
  try {
    const topLeft = screen.screenToDipPoint({ x: rect.left, y: rect.top });
    const display = screen.getDisplayNearestPoint(topLeft);
    const scale = (display && display.scaleFactor) || 1;
    return {
      x: Math.round(topLeft.x),
      y: Math.round(topLeft.y),
      width: Math.max(1, Math.round((rect.right - rect.left) / scale)),
      height: Math.max(1, Math.round((rect.bottom - rect.top) / scale)),
    };
  } catch {
    return { x: rect.left, y: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top };
  }
}

function safeDestroy(win) {
  try {
    if (win && !win.isDestroyed()) win.destroy();
  } catch { /* 销毁失败仅忽略 */ }
}

function sameBounds(a, b) {
  return a && b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function createOverlayWindow(info) {
  const bounds = physRectToDipBounds(info.rect);
  const win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // 纯视觉遮罩：无 preload、无 IPC
    },
  });

  try { win.setIgnoreMouseEvents(true); } catch { /* 点击穿透失败仅降级体验 */ }
  try { win.setAlwaysOnTop(true, 'screen-saver'); } catch { /* 保持默认置顶 */ }

  win.loadFile(getOverlayHtmlPath(), {
    query: { name: info.name || '', partial: info.partial ? '1' : '0' },
  });
  win.once('ready-to-show', () => {
    try { if (!win.isDestroyed()) win.showInactive(); } catch { /* 忽略 */ }
  });
  return win;
}

/**
 * 按锁定快照全量幂等同步遮罩：
 * 快照变化（锁定/解锁/新进程）与 1s 跟随定时器共用同一入口。
 * @param {Array<{appId:string, name:string, pids:number[], partial:boolean}>} snapshotList
 */
function syncOverlays(snapshotList) {
  if (process.platform !== 'win32') return;
  try {
    const list = (snapshotList || []).filter((item) => item && item.pids && item.pids.length);
    trackedApps = list;
    if (!list.length || !nt.getWindowsAvailable()) {
      destroyAllOverlays();
      return;
    }

    // 期望态：每应用 Z 序最前的 N 个顶层可见窗口
    const desired = new Map();
    for (const item of list) {
      const windows = nt.findVisibleWindows(item.pids, MAX_WINDOWS_PER_APP);
      for (const w of windows) {
        desired.set(`${item.appId}:${w.hwnd}`, {
          appId: item.appId,
          pid: w.pid,
          hwnd: w.hwnd,
          rect: w.rect,
          name: item.name,
          partial: Boolean(item.partial),
        });
      }
    }

    // 销毁不再需要的遮罩
    for (const [key, entry] of overlays) {
      if (!desired.has(key)) {
        safeDestroy(entry.win);
        overlays.delete(key);
      }
    }

    // 创建缺失 / 校正位置
    for (const [key, info] of desired) {
      const bounds = physRectToDipBounds(info.rect);
      let entry = overlays.get(key);
      if (!entry || entry.win.isDestroyed()) {
        const win = createOverlayWindow(info);
        overlays.set(key, { win, appId: info.appId, pid: info.pid, hwnd: info.hwnd, bounds });
      } else if (!sameBounds(entry.bounds, bounds)) {
        entry.win.setBounds(bounds);
        entry.bounds = bounds;
      }
    }

    ensureFollowLoop();
  } catch (error) {
    console.error('[AppLock] 遮罩同步失败:', error.message);
  }
}

/** 1s 跟随定时器：复用全量幂等同步，覆盖移动/最小化/关闭/新窗口四种变化 */
function ensureFollowLoop() {
  if (followTimer || !overlays.size) return;
  followTimer = setInterval(() => {
    try {
      if (!overlays.size) { stopFollowLoop(); return; }
      syncOverlays(trackedApps);
    } catch { /* 跟随失败仅下一轮重试 */ }
  }, FOLLOW_INTERVAL_MS);
}

function stopFollowLoop() {
  if (followTimer) {
    clearInterval(followTimer);
    followTimer = null;
  }
}

/** 销毁全部遮罩并停止跟随（解锁 / masterEnabled 关闭 / 遮罩目标清空时调用） */
function destroyAllOverlays() {
  stopFollowLoop();
  for (const [, entry] of overlays) safeDestroy(entry.win);
  overlays.clear();
  trackedApps = [];
}

module.exports = {
  syncOverlays,
  destroyAllOverlays,
};
