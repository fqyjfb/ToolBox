const { BrowserWindow, dialog, screen, shell, nativeTheme, powerMonitor } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const { execFile } = require('child_process');
const { loadSettings, saveSettings, getNetworkConfig, invalidateNetworkConfigCache, isDarkTheme } = require('../lib/config.cjs');
const ShortcutManager = require('../lib/shortcutManager.cjs');
const notesService = require('../services/notesService.cjs');
const systemInfoService = require('../services/systemInfoService.cjs');
const { getFloatWindow } = require('./floatWindow.cjs');
const { getFileIcon, isSupportedFileType, getShortcutInfo, getCacheFilePath } = require('../lib/iconExtractor.cjs');
const { getAppIcon } = require('../lib/appIcon.cjs');

// 快启动扫描统一过滤规则（桌面扫描与开始菜单扫描共享，保证整体去重一致）
const QUICK_LAUNCH_SKIP_DIRS = ['startup', 'help', 'documentation', 'maintenance', 'readme', 'uninstall'];
const QUICK_LAUNCH_SKIP_PATTERNS = [
  'uninstall', 'unins', 'uninst', '卸载', 'setup', 'readme',
  'crashreport', 'updater', 'update', 'upgrade', 'patch', 'checkforupdates',
  'redist', 'vcredist', 'dxsetup', 'dotnet', 'msicuu', 'helper', 'crash', 'license',
  'documentation', 'manual', 'tutorial', 'register', 'support', 'cleanup', 'repair',
  '安装', '升级',
  // 快速启动栏无目标系统项（显示桌面/窗口切换器，兼容 Shows/Show 两种命名）
  'shows desktop', 'show desktop', 'window switcher'
];
const shouldSkipQuickLaunchEntry = (entryName) => {
  const base = entryName.toLowerCase().replace(/\.(exe|lnk|bat|cmd|url|appref-ms)$/i, '');
  return QUICK_LAUNCH_SKIP_PATTERNS.some(p => base.includes(p));
};

// 过滤 Windows 系统目录（C:\Windows）下的系统自带应用，不添加进快启动
const isWindowsSystemPath = (targetPath) => {
  const systemRoot = (process.env.SystemRoot || process.env.windir || 'C:\\Windows').toLowerCase();
  const lower = targetPath.toLowerCase();
  return lower === systemRoot || lower.startsWith(systemRoot + path.sep);
};

// MSI 广告快捷方式目标检测：目标位于 C:\Windows\Installer\ 下（MSI 间接启动机制的入口 exe，
// 如 CorelDRAW/Office 等 MSI 安装应用），属于第三方应用入口而非系统自带应用
const isWindowsInstallerPath = (targetPath) => {
  const systemRoot = (process.env.SystemRoot || process.env.windir || 'C:\\Windows').toLowerCase();
  return targetPath.toLowerCase().startsWith(systemRoot + '\\installer\\');
};

// 快启动扫描共享核心（桌面扫描与已安装应用扫描统一使用）：
// 递归收集候选（.lnk/.exe，排除 .url——URL 快捷方式不作为应用添加）→ 逐项解析校验 → 实时进度推送
// 统一约定：命名以快捷方式名称为主；显示名 + 目标路径双重去重；保留快捷方式启动参数；
// 跳过卸载/更新/帮助等无用项、Windows 系统目录与失效快捷方式（目标不存在）
const scanQuickLaunchPaths = async (event, scanPaths) => {
  const logger = require('../logs/logger.cjs');
  // 阶段一：递归收集候选文件
  const candidates = [];
  const collectDir = (dir, depth = 0) => {
    if (depth > 3) return;
    let entries;
    try { entries = fs.readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      let stat;
      try { stat = fs.statSync(fullPath); } catch { continue; }
      if (stat.isDirectory()) {
        if (QUICK_LAUNCH_SKIP_DIRS.some(d => entry.toLowerCase().includes(d))) continue;
        collectDir(fullPath, depth + 1);
      } else {
        const lower = fullPath.toLowerCase();
        if (!lower.endsWith('.lnk') && !lower.endsWith('.exe')) continue;
        if (shouldSkipQuickLaunchEntry(entry)) continue;
        candidates.push({ entry, fullPath });
      }
    }
  };
  scanPaths.forEach(dir => { if (fs.existsSync(dir)) collectDir(dir); });

  // 阶段二：逐项解析目标并校验，实时推送进度
  const total = candidates.length;
  const results = [];
  const seenTargets = new Set();
  const seenNames = new Set();
  let processed = 0;
  const sendProgress = (current) => {
    const percent = total > 0 ? Math.round((current / total) * 100) : 100;
    try { event.sender.send('scan-installed-apps-progress', { current, total, percent }); } catch {}
  };
  sendProgress(0);

  for (const { entry, fullPath } of candidates) {
    processed++;
    const displayName = entry.replace(/\.(exe|lnk)$/i, '');
    if (seenNames.has(displayName.toLowerCase())) { sendProgress(processed); continue; }
    seenNames.add(displayName.toLowerCase());

    let targetPath = fullPath;
    let appArgs = '';
    if (fullPath.toLowerCase().endsWith('.lnk')) {
      try {
        const info = await getShortcutInfo(fullPath);
        // 失效快捷方式（目标不存在）或解析异常时不添加
        if (!info.targetPath) { sendProgress(processed); continue; }
        if (isWindowsInstallerPath(info.targetPath)) {
          // MSI 广告快捷方式：目标位于 Windows\Installer，按系统路径规则会被误杀；
          // 保留 .lnk 本身，通过 ShellExecute 走 MSI 原生机制启动真实应用
          targetPath = fullPath;
          appArgs = '';
        } else {
          targetPath = info.targetPath;
          appArgs = info.args;
        }
      } catch {
        sendProgress(processed);
        continue;
      }
    }
    // 目标必须是真实存在的 .exe（.lnk 目标已由 PowerShell Test-Path 验证；裸 .exe 现校验）；
    // 保留的 MSI 广告快捷方式 .lnk 例外（走 ShellExecute 机制，不经存在性/系统路径校验）
    const lowerTarget = targetPath.toLowerCase();
    const isExe = lowerTarget.endsWith('.exe');
    if (!isExe && !lowerTarget.endsWith('.lnk')) { sendProgress(processed); continue; }
    if (isExe) {
      try { if (!fs.existsSync(targetPath)) { sendProgress(processed); continue; } } catch { sendProgress(processed); continue; }
      if (isWindowsSystemPath(targetPath)) { sendProgress(processed); continue; }
      // 快捷方式名称干净但目标为升级/卸载等程序（如 xxx.lnk -> update.exe）时跳过
      if (shouldSkipQuickLaunchEntry(path.basename(targetPath))) { sendProgress(processed); continue; }
    }
    if (seenTargets.has(lowerTarget)) { sendProgress(processed); continue; }
    seenTargets.add(lowerTarget);
    results.push({ name: displayName, path: targetPath, args: appArgs || undefined });
    sendProgress(processed);
  }

  logger.addLog('info', `[QuickLaunch] 扫描完成: 候选 ${total} 项，保留 ${results.length} 项`, 'scan');
  return results;
};

let mainWindow = null;
let memoryCleanupTimer = null;
let autoLockTimer = null;
let lastActivityTime = Date.now();
let isQuitting = false;

// 小窗（compact）尺寸约束，单位 DIP
const COMPACT_WINDOW_SIZE = { width: 320, height: 725 };
const COMPACT_MIN_SIZE = { width: 280, height: 480 };
// 上限 480 必须恒小于 Tailwind md 断点 768：保证小窗内页面永远命中移动端样式分支
const COMPACT_MAX_WIDTH = 480;

// 当前窗口模式；largeBounds = 进入小窗前的大窗尺寸快照，切回时原样恢复
let windowMode = 'large';
let largeBounds = null;

const shortcutManager = new ShortcutManager();
// P2: 快启动全局热键映射表（appId -> accelerator），置于模块作用域以便退出时统一注销
const quickLaunchHotkeys = new Map();

// 解析大窗默认尺寸（与 createWindow 取值口径一致，避免两处默认值不一致）
const resolveLargeWindowSize = () => {
  const raw = loadSettings().defaultWindowSize;
  const size = typeof raw === 'string'
    ? (() => { try { return JSON.parse(raw); } catch { return null; } })()
    : (raw || null);
  return {
    width: (size && typeof size.width === 'number') ? size.width : 1160,
    height: (size && typeof size.height === 'number') ? size.height : 800,
  };
};

// 小窗 ⇄ 大窗切换的唯一出口（渲染层 IPC 与任何原生入口都走这里，模式持久化到 settings）
// 注意：原生 API 的 getSize() 返回 [width, height] 数组，统一转成 { width, height } 后再落地，
// 避免上层按对象取值拿到 undefined 导致 setSize 抛错、模式状态无法推进（窗口卡死在小窗尺寸）
const toSizeObject = (size) => {
  if (Array.isArray(size)) return { width: size[0], height: size[1] };
  if (size && typeof size === 'object') return { width: size.width, height: size.height };
  return null;
};
const isValidSize = (size) =>
  !!size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;

// 校验还原用的窗口尺寸：宽高须为有效正数；小窗模式下还要落进小窗的宽高约束，
// 否则 setBounds 会被当前的最小/最大尺寸限制改写，记录与实际不一致
const resolveDockRestoreSize = (bounds) => {
  if (!isValidSize(bounds)) return null;
  if (windowMode !== 'compact') return { width: bounds.width, height: bounds.height };
  return {
    width: Math.min(Math.max(bounds.width, COMPACT_MIN_SIZE.width), COMPACT_MAX_WIDTH),
    height: Math.max(bounds.height, COMPACT_MIN_SIZE.height),
  };
};

const applyWindowMode = (mode) => {
  if (!mainWindow || (mode !== 'compact' && mode !== 'large') || mode === windowMode) return;
  // 切模式会重设尺寸并居中，先退出停靠（同步清空吸附记录），避免停靠状态与居中后的位置冲突
  clearEdgeDock();

  try {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();

    if (mode === 'compact') {
      // 快照进入小窗前的大窗尺寸，切回时原样恢复；快照无效时回退默认大窗尺寸
      const snapshot = toSizeObject(mainWindow.getSize());
      largeBounds = isValidSize(snapshot) ? snapshot : null;
      mainWindow.setMinimumSize(COMPACT_MIN_SIZE.width, COMPACT_MIN_SIZE.height);
      mainWindow.setMaximumSize(COMPACT_MAX_WIDTH, 0); // 高度 0 = 不限制
      mainWindow.setSize(COMPACT_WINDOW_SIZE.width, COMPACT_WINDOW_SIZE.height, true);
      mainWindow.center();
    } else {
      mainWindow.setMinimumSize(0, 0);   // 解除下限（与现状一致）
      mainWindow.setMaximumSize(0, 0);   // 解除上限（Electron：传 0 移除约束）
      const target = isValidSize(largeBounds) ? largeBounds : resolveLargeWindowSize();
      mainWindow.setSize(target.width, target.height, true);
      mainWindow.center();
    }
  } catch (error) {
    // 尺寸调整失败也要让模式状态与渲染层保持一致，否则后续切换会被 mode === windowMode 短路挡掉
    console.error('[Window] applyWindowMode failed:', error);
  }

  windowMode = mode;
  const settings = loadSettings();
  settings.windowMode = mode;
  saveSettings(settings);
};

// 检查锁定状态，如果已锁定则聚焦锁定窗口
const checkLockAndShowMain = (callback) => {
  const settings = loadSettings();
  if (settings.isLockEnabled === 1) {
    require('./lockWindow.cjs').toggleLock();
    return false;
  }
  if (callback) callback();
  return true;
};

const shortcutFunctions = {
  softwareExit: () => { require('electron').app.quit(); },
  softwareWindowVisibilityController: () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        checkLockAndShowMain(() => {
          mainWindow.show();
          mainWindow.focus();
        });
      }
    }
  },
  isMenuVisible: () => {
    const settings = loadSettings();
    settings.isMenuVisible = settings.isMenuVisible === 1 ? 0 : 1;
    saveSettings(settings);
    mainWindow?.webContents.send('setting-changed', { name: 'isMenuVisible', value: settings.isMenuVisible });
  },
  softwareSetting: () => {
    checkLockAndShowMain(() => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('navigate-to', '/settings');
      }
    });
  },
  windowTopmostToggle: () => {
    if (mainWindow) {
      const isTopmost = mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(!isTopmost);
    }
  },
  restoreDefaultWindow: () => {
    if (mainWindow) {
      clearEdgeDock(); // 恢复默认尺寸并居中，先退出停靠（同步清空吸附记录）
      // 小窗模式下仅恢复小窗尺寸并居中，不做默认尺寸判断
      if (windowMode === 'compact') {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        mainWindow.setSize(COMPACT_WINDOW_SIZE.width, COMPACT_WINDOW_SIZE.height, true);
        mainWindow.center();
        return;
      }
      const [width, height] = mainWindow.getSize();
      const raw = loadSettings().defaultWindowSize;
      const origin = typeof raw === 'string'
        ? (() => { try { return JSON.parse(raw); } catch { return null; } })()
        : (raw || null);
      const originW = (origin && typeof origin.width === 'number') ? origin.width : 1160;
      const originH = (origin && typeof origin.height === 'number') ? origin.height : 800;
      if (width === originW && height === originH) {
        mainWindow.maximize();
      } else {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        checkLockAndShowMain(() => {
          if (!mainWindow.isVisible()) mainWindow.show();
          mainWindow.setSize(originW, originH, true);
          mainWindow.center();
        });
      }
    }
  },
  currentPageRefresher: () => {
    if (mainWindow) {
      mainWindow.webContents.reload();
    }
  },
  windowMinimize: () => {
    if (mainWindow) {
      if (isWindowEdgeDocked()) { toggleEdgeDockWindow(); return; } // 停靠态最小化即折叠（吸附期不占用任务栏）
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      mainWindow.minimize();
    }
  },
  windowMaximizer: () => {
    if (mainWindow) {
      if (windowMode === 'compact') return; // 小窗不支持最大化
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  },
  lockToggle: () => {
    const { loadSettings } = require('../lib/config.cjs');
    const settings = loadSettings();

    if (settings.isLockEnabled === 1) {
      require('./lockWindow.cjs').toggleLock();
    } else {
      require('./lockWindow.cjs').lockOrPrompt();
    }
  },
};

const initShortcuts = () => {
  const { loadShortcuts } = require('../lib/config.cjs');
  shortcutManager.unregisterAll();
  const shortcuts = loadShortcuts();
  shortcuts.forEach((shortcut) => {
    if (shortcut.isOpen === 0) return;
    if (!shortcutManager.isRegistered(shortcut.cmd)) {
      shortcutManager.register(shortcut.cmd, shortcutFunctions[shortcut.name].bind(this), shortcut.isGlobal === 1);
    }
  });
};

const updateShortcut = (shortcut, oldShortcut) => {
  if (shortcutManager.isRegistered(shortcut.cmd)) {
    return false;
  }
  shortcutManager.unregister(oldShortcut.cmd);
  shortcutManager.register(shortcut.cmd, shortcutFunctions[shortcut.name].bind(this), shortcut.isGlobal === 1);
  return true;
};

const isDisableShortcuts = (shortcut) => {
  if (shortcut.isOpen === 0 && shortcutManager.isRegistered(shortcut.cmd)) {
    shortcutManager.unregister(shortcut.cmd);
    return true;
  }
  if (shortcut.isOpen === 1 && !shortcutManager.isRegistered(shortcut.cmd)) {
    shortcutManager.register(shortcut.cmd, shortcutFunctions[shortcut.name].bind(this), shortcut.isGlobal === 1);
    return true;
  }
  return true;
};

const startMemoryOptimization = () => {
  stopMemoryOptimization();
  const settings = loadSettings();
  if (!settings.isMemoryOptimizationEnabled) return;

  const cleanupInterval = 5 * 60 * 1000;
  const cleanup = () => {
    try {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.executeJavaScript('window.gc && window.gc();');
      }
    } catch (error) {
      console.error('[MEMORY] Memory cleanup error:', error);
    }
  };
  memoryCleanupTimer = setInterval(cleanup, cleanupInterval);
  if (memoryCleanupTimer && memoryCleanupTimer.unref) memoryCleanupTimer.unref();
};

const stopMemoryOptimization = () => {
  if (memoryCleanupTimer) {
    clearInterval(memoryCleanupTimer);
    memoryCleanupTimer = null;
  }
};

const stopAutoLock = () => {
  if (autoLockTimer) {
    clearInterval(autoLockTimer);
    autoLockTimer = null;
  }
};

const startAutoLock = () => {
  stopAutoLock();
  const settings = loadSettings();
  if (!settings.isAutoLockEnabled || !settings.lockPassword) return;

  const threshold = (settings.autoLockTimeout || 600) * 1000;
  const checkInterval = Math.max(5000, threshold / 10);

  autoLockTimer = setInterval(() => {
    const currentSettings = loadSettings();
    
    if (!currentSettings.isAutoLockEnabled || !currentSettings.lockPassword) {
      stopAutoLock();
      return;
    }

    if (currentSettings.isLockEnabled === 1) {
      return;
    }

    if (process.platform === 'win32') {
      // 系统级空闲时长（秒）。powerMonitor.getSystemIdleTime() 内部同样取 GetLastInputInfo，
      // 与原先 spawn PowerShell 读 LASTINPUTINFO 的语义完全一致，但不再每个 tick 拉起子进程。
      const idleMs = powerMonitor.getSystemIdleTime() * 1000;
      const currentThreshold = (currentSettings.autoLockTimeout || 600) * 1000;

      if (idleMs >= 0 && idleMs >= currentThreshold) {
        require('./lockWindow.cjs').lock();
      }
    } else {
      const elapsed = Date.now() - lastActivityTime;
      const currentThreshold = (currentSettings.autoLockTimeout || 600) * 1000;
      if (elapsed >= currentThreshold) {
        require('./lockWindow.cjs').lock();
      }
    }
  }, checkInterval);
};

const resetAutoLockTimer = () => {
  lastActivityTime = Date.now();
};

// ===== 边缘吸附 + 贴边自动隐藏 =====
// 拖动停止 150ms 后判定贴边：对齐到工作区左/右/顶部边缘（只平移单轴，不改尺寸，大窗/小窗均生效）。
// 停靠后混合事件驱动：展开态由渲染层光标跨界事件（IPC 转发）驱动折叠/展开，零轮询；
// 隐藏态由主进程低频轮询光标，进入感应区停留后展开；折叠/展开为主进程逐帧插值动画。
// 用户再次拖动窗口或关闭设置即退出停靠。
const EDGE_HIDE_MARGIN = 32;         // 折叠时移出屏幕的余量（DIP）：留出富余覆盖 DWM 在窗口矩形外合成的内容（窗口阴影/圆角补偿）与 DIP→物理像素取整误差，确保屏幕边缘零可见残留
const EDGE_TRIGGER_WIDTH = 4;        // 隐藏时光标触发展开的感应区宽度（DIP）：距屏幕边 4px 内即触发展开计时
const EDGE_SNAP_THRESHOLD = 30;      // 吸附判定距离（DIP，按显示缩放比放大）
const EDGE_HIDE_DELAY_MS = 500;      // 光标离开窗口后收回的延迟
const EDGE_POLL_INTERVAL_MS = 200;   // 隐藏态光标位置轮询间隔
const EDGE_TRIGGER_DWELL_MS = 50;    // 感应区停留时长，过滤快速划过
const EDGE_ANIM_DURATION = 220;      // 折叠/展开动画时长，置 0 即瞬时移动
const EDGE_ANIM_FRAME_MS = 16;       // 动画步进间隔，约 60fps

let snapTimer = null;                // 拖动停止后的吸附判定定时器
let edgePollTimer = null;            // 隐藏态光标位置轮询定时器
let edgeDockedEdge = null;           // 当前停靠边：'left' | 'right' | 'top' | null
let edgeHidden = false;              // 是否处于贴边隐藏态（窗口完全滑出屏幕不可见）
let edgeSelfMoveUntil = 0;           // 自身 setBounds 引发的 move 忽略窗口期
let edgeAnim = null;                 // 当前动画句柄 { timer }，同一时刻至多一个
let edgeHideTimer = null;            // 光标离开后的延迟折叠定时器
let edgeTriggerAt = 0;               // 光标进入感应区的时刻（0 = 不在感应区内）
let edgeZoneArmed = false;           // 感应区武装标记：折叠后光标须先离开感应区再进入才可停留触发
let edgeTopmost = false;             // 隐藏态置顶标记：由吸附管理切换，不覆盖用户手动置顶
let edgeUserDragging = false;        // 用户拖拽中标记（WM_ENTERSIZEMOVE/EXITSIZEMOVE 维护）：拖拽期间不做吸附判定
let edgeImeComposing = false;        // 输入法组合态标记：输入中禁止自动折叠（IME 候选窗夺焦/光标在外均不收回）

// 停靠状态落盘：吸附时记录「模式 + 边 + 位置尺寸」，退出吸附即清空，供下次启动还原。
// 隐藏态窗口位于屏幕外，其坐标不作为还原依据（保留吸附时的展开位记录）；
// 窗口已销毁（退出应用）时不改写记录，否则退出流程会把上次吸附状态清空，导致重启后无法还原。
const persistDockState = () => {
  if (edgeHidden) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const settings = loadSettings();
  settings.windowDockState = edgeDockedEdge
    ? { mode: windowMode, edge: edgeDockedEdge, bounds: mainWindow.getBounds() }
    : null;
  saveSettings(settings);
};

const stopEdgePoll = () => {
  if (edgePollTimer) {
    clearInterval(edgePollTimer);
    edgePollTimer = null;
  }
};

const startEdgePoll = () => {
  stopEdgePoll();
  edgePollTimer = setInterval(pollEdgeWindowState, EDGE_POLL_INTERVAL_MS);
  if (edgePollTimer.unref) edgePollTimer.unref();
};

const cancelEdgeAnimation = () => {
  if (edgeAnim) {
    clearTimeout(edgeAnim.timer);
    edgeAnim = null;
  }
};

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3); // 展开：起步快减速入位
const easeInCubic = (t) => t * t * t;               // 折叠：缓起加速离场

// 从当前位置向 (targetX, targetY) 逐帧插值（静止轴传当前值即可），动画全程屏蔽自身引发的 move 事件
const startEdgeAnimation = (targetX, targetY, easing, onDone) => {
  cancelEdgeAnimation();
  const from = mainWindow.getBounds();
  const startTime = Date.now();
  edgeSelfMoveUntil = startTime + EDGE_ANIM_DURATION + 200;
  const step = () => {
    if (mainWindow.isMinimized()) {
      // 最小化瞬间中止动画，避免逐帧 setBounds 污染还原位置导致窗口状态错乱
      edgeAnim = null;
      return;
    }
    const t = Math.min(1, (Date.now() - startTime) / EDGE_ANIM_DURATION);
    const k = easing(t);
    mainWindow.setBounds({
      x: Math.round(from.x + (targetX - from.x) * k),
      y: Math.round(from.y + (targetY - from.y) * k),
      width: from.width,
      height: from.height
    });
    if (t < 1) {
      edgeAnim = { timer: setTimeout(step, EDGE_ANIM_FRAME_MS) };
    } else {
      edgeAnim = null;
      if (onDone) onDone();
    }
  };
  edgeAnim = { timer: setTimeout(step, EDGE_ANIM_FRAME_MS) };
};

const clearEdgeDock = () => {
  const wasDocked = !!edgeDockedEdge;
  cancelEdgeAnimation();
  if (edgeHideTimer) {
    clearTimeout(edgeHideTimer);
    edgeHideTimer = null;
  }
  edgeTriggerAt = 0;
  edgeZoneArmed = false;
  if (edgeTopmost && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(false); // 退出停靠还原隐藏态置顶
    edgeTopmost = false;
  }
  if (edgeDockedEdge && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSkipTaskbar(false); // 退出停靠还原任务栏图标
  }
  edgeDockedEdge = null;
  edgeImeComposing = false; // 退出停靠重置组合态，防止渲染层重载后残留 true 导致重停靠后永不折叠
  stopEdgePoll();
  if (snapTimer) {
    clearTimeout(snapTimer);
    snapTimer = null;
  }
  // 仅在真正退出停靠时落盘（move 事件会高频调用本函数，未停靠时不做无谓写入）
  if (wasDocked) persistDockState();
};

const getDisplayForBounds = (bounds) => screen.getDisplayNearestPoint({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2
});

// 只平移单轴调整窗口位置（x/y 传 null 表示该轴保持不变），并短暂屏蔽自身引发的 move 事件
const setEdgeWindowPos = (x, y, bounds) => {
  edgeSelfMoveUntil = Date.now() + 300;
  mainWindow.setBounds({
    ...bounds,
    x: x === null ? bounds.x : x,
    y: y === null ? bounds.y : y
  });
};

// 停靠展开态的窗口位置（左/右对齐工作区左右缘，顶部对齐顶缘）
const getEdgeShownPos = (bounds) => {
  const { workArea } = getDisplayForBounds(bounds);
  if (edgeDockedEdge === 'left') return { x: workArea.x, y: bounds.y };
  if (edgeDockedEdge === 'right') return { x: workArea.x + workArea.width - bounds.width, y: bounds.y };
  return { x: bounds.x, y: workArea.y };
};

// 光标是否位于窗口当前边界内（getCursorScreenPoint 异常时按不在窗口内处理）
const isCursorInsideWindow = () => {
  let cursor;
  try {
    cursor = screen.getCursorScreenPoint();
  } catch {
    return false;
  }
  const bounds = mainWindow.getBounds();
  return cursor.x >= bounds.x && cursor.x <= bounds.x + bounds.width
    && cursor.y >= bounds.y && cursor.y <= bounds.y + bounds.height;
};

// 贴边隐藏：完全滑出屏幕不可见（水平停靠只平移 x，顶部停靠只平移 y；动画完成后再启动隐藏态轮询）
const hideEdgeWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized() || !mainWindow.isVisible() || !edgeDockedEdge) return;
  if (edgeHideTimer) {
    clearTimeout(edgeHideTimer);
    edgeHideTimer = null;
  }
  edgeTriggerAt = 0;
  edgeZoneArmed = false; // 折叠时光标常停留在感应区内，解除武装防止立即二次展开
  edgeHidden = true;
  stopEdgePoll();
  if (!mainWindow.isAlwaysOnTop()) {
    mainWindow.setAlwaysOnTop(true); // 隐藏态保持置顶：展开滑入瞬间即在其他应用（含最大化窗口）之上，无被遮挡的中间态
    edgeTopmost = true;
  }
  const bounds = mainWindow.getBounds();
  // 展开位按 workArea 对齐（避让任务栏），折叠位必须按整块屏幕外缘收起：
  // workArea 是扣除任务栏等保留区后的可用区，当停靠边正是任务栏所在边（顶部最常见）时，
  // 「移出 workArea」仍落在屏幕范围内，而折叠态窗口位于置顶层，会压在任务栏之上，
  // 在桌面顶部露出窗口本体与阴影构成的暗带。物理屏幕矩形（display.bounds）才是真正的屏幕边界。
  const screenBounds = getDisplayForBounds(bounds).bounds;
  if (edgeDockedEdge === 'left') {
    startEdgeAnimation(screenBounds.x - bounds.width - EDGE_HIDE_MARGIN, bounds.y, easeInCubic, startEdgePoll);
  } else if (edgeDockedEdge === 'right') {
    startEdgeAnimation(screenBounds.x + screenBounds.width + EDGE_HIDE_MARGIN, bounds.y, easeInCubic, startEdgePoll);
  } else {
    startEdgeAnimation(bounds.x, screenBounds.y - bounds.height - EDGE_HIDE_MARGIN, easeInCubic, startEdgePoll);
  }
};

// 贴边展开：滑回工作区内完整显示（停轮询，交回渲染层事件驱动）
const showEdgeWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized() || !edgeDockedEdge) return;
  stopEdgePoll();
  edgeHidden = false;
  edgeTriggerAt = 0;
  if (edgeTopmost) {
    mainWindow.setAlwaysOnTop(false); // 还原隐藏态置顶（用户手动置顶不受影响）
    edgeTopmost = false;
  }
  mainWindow.moveTop(); // 展开覆盖其他应用（含最大化窗口）显示，不抢焦点
  const { x, y } = getEdgeShownPos(mainWindow.getBounds());
  startEdgeAnimation(x, y, easeOutCubic);
};

// 停靠窗口显示切换（托盘左键 / 标题栏最小化按钮 / 全局最小化快捷键共用）：
// 折叠 ⇄ 展开；最小化先还原（restore 事件接管展开）；被隐藏先恢复显示（focus 接管展开）
const toggleEdgeDockWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed() || !edgeDockedEdge) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
    return;
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
    return;
  }
  if (edgeHidden) {
    showEdgeWindow();
    mainWindow.focus(); // 显式唤出接管焦点，便于直接操作
  } else {
    hideEdgeWindow();
  }
};

// 由悬浮球菜单等入口唤出主窗口：停靠折叠态先展开，再显示并取焦点
const showMainWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (edgeDockedEdge && edgeHidden) {
    showEdgeWindow();
    mainWindow.focus();
    return;
  }
  mainWindow.show();
  mainWindow.focus();
};

const isWindowEdgeDocked = () => !!edgeDockedEdge;

// 停靠隐藏态轮询：光标进入停靠边感应区（纵向/横向落在窗口范围内）并停留 → 展开
const pollEdgeWindowState = () => {
  if (!mainWindow || mainWindow.isDestroyed() || !edgeDockedEdge) {
    stopEdgePoll();
    return;
  }
  if (mainWindow.isMinimized() || !mainWindow.isVisible()) return;

  let cursor;
  try {
    cursor = screen.getCursorScreenPoint();
  } catch {
    return;
  }
  const bounds = mainWindow.getBounds();
  const { workArea } = screen.getDisplayNearestPoint(cursor);
  const inXRange = cursor.x >= bounds.x && cursor.x <= bounds.x + bounds.width;
  const inYRange = cursor.y >= bounds.y && cursor.y <= bounds.y + bounds.height;
  let inZone = false;
  if (edgeDockedEdge === 'left') {
    inZone = cursor.x <= workArea.x + EDGE_TRIGGER_WIDTH && inYRange;
  } else if (edgeDockedEdge === 'right') {
    inZone = cursor.x >= workArea.x + workArea.width - EDGE_TRIGGER_WIDTH && inYRange;
  } else {
    inZone = cursor.y <= workArea.y + EDGE_TRIGGER_WIDTH && inXRange;
  }
  if (!inZone) {
    edgeTriggerAt = 0;
    edgeZoneArmed = true; // 光标处于感应区外时（重新）武装：须再次进入并停留才可触发
    return;
  }
  if (!edgeZoneArmed) return; // 折叠后光标仍停留在感应区内，须先离开再进入，防止立即二次展开
  if (!edgeTriggerAt) {
    edgeTriggerAt = Date.now(); // 进入感应区，开始停留计时
    return;
  }
  if (Date.now() - edgeTriggerAt >= EDGE_TRIGGER_DWELL_MS) {
    edgeTriggerAt = 0;
    showEdgeWindow();
  }
};

// 进入停靠管理：按给定边对齐到工作区边缘（只平移单轴，不改尺寸），接管任务栏与折叠轮询
const dockToEdge = (edge) => {
  const bounds = mainWindow.getBounds();
  const workArea = getDisplayForBounds(bounds).workArea;
  if (edge === 'left') {
    setEdgeWindowPos(workArea.x, null, bounds);
  } else if (edge === 'right') {
    setEdgeWindowPos(workArea.x + workArea.width - bounds.width, null, bounds);
  } else {
    setEdgeWindowPos(null, workArea.y, bounds);
  }
  edgeDockedEdge = edge;
  edgeHidden = false; // 停靠从展开态开始
  mainWindow.setSkipTaskbar(true); // 停靠期不占用任务栏（含 Alt+Tab），由贴边感应与托盘接管唤出
  startEdgePoll();
};

// 拖动停止后的吸附判定：贴边则对齐并进入停靠管理，未贴边则保持原位
const snapWindowToEdge = () => {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMaximized()) return;
  if (edgeDockedEdge) return; // 已在停靠管理中，避免隐藏态被误判为未贴边

  const bounds = mainWindow.getBounds();
  const display = getDisplayForBounds(bounds);
  const workArea = display.workArea;
  const threshold = EDGE_SNAP_THRESHOLD * (display.scaleFactor || 1);

  const leftDistance = bounds.x - workArea.x;
  const rightDistance = (workArea.x + workArea.width) - (bounds.x + bounds.width);
  const topDistance = bounds.y - workArea.y;

  let snapEdge = null;
  if (Math.abs(leftDistance) <= threshold) snapEdge = 'left';
  else if (Math.abs(rightDistance) <= threshold) snapEdge = 'right';
  else if (Math.abs(topDistance) <= threshold) snapEdge = 'top';
  if (!snapEdge) return;

  dockToEdge(snapEdge);
  persistDockState();
};

// 还原上次退出的吸附状态：吸附开关开启、模式一致且记录有效时按当前工作区重新对齐；
// 未吸附 / 记录无效则不处理，窗口按创建时的默认位置（居中）启动
const restoreDockState = () => {
  const settings = loadSettings();
  if (!settings.isWindowEdgeAdsorption) return;
  const saved = settings.windowDockState;
  if (!saved || saved.mode !== windowMode) return;
  if (saved.edge !== 'left' && saved.edge !== 'right' && saved.edge !== 'top') return;

  const bounds = saved.bounds;
  const size = resolveDockRestoreSize(bounds);
  if (!size) return;

  // 记录时的显示器可能已变化（分辨率调整 / 外接屏拔除）：按最近显示器的工作区重新夹取，
  // 保证还原后窗口一定落在可见区域内，再交给 dockToEdge 按边对齐（不直接沿用旧坐标）
  const workArea = screen.getDisplayNearestPoint({
    x: (Number.isFinite(bounds.x) ? bounds.x : 0) + size.width / 2,
    y: (Number.isFinite(bounds.y) ? bounds.y : 0) + size.height / 2,
  }).workArea;
  const width = Math.min(size.width, workArea.width);
  const height = Math.min(size.height, workArea.height);
  const x = Number.isFinite(bounds.x) ? bounds.x : workArea.x;
  const y = Number.isFinite(bounds.y) ? bounds.y : workArea.y;

  edgeSelfMoveUntil = Date.now() + 500; // 还原期抑制 move 判定，避免自身 setBounds 被当成用户拖动
  mainWindow.setBounds({
    x: Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - width),
    y: Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - height),
    width,
    height,
  });
  dockToEdge(saved.edge);
};

// 主窗口 move 入口：用户拖动即退出停靠，停止拖动后重新判定吸附
const handleMainWindowMove = () => {
  if (!loadSettings().isWindowEdgeAdsorption) return;
  if (edgeUserDragging) return; // 拖拽中由 WM_EXITSIZEMOVE 统一判定吸附，避免拖拽中途停顿被吸附抢位置
  if (Date.now() < edgeSelfMoveUntil) return; // 吸附 / 隐藏自身的位置调整，忽略
  clearEdgeDock();
  snapTimer = setTimeout(snapWindowToEdge, 150);
};

// 关闭吸附设置 / 窗口销毁时退出停靠；处于隐藏态先瞬时恢复完整显示（需在清空停靠边前执行，
// getEdgeShownPos 依赖未清空的 edgeDockedEdge；不走动画以免被随后的 clearEdgeDock 中途取消）
const resetEdgeSnap = () => {
  if (edgeHidden && mainWindow && !mainWindow.isDestroyed()) {
    const bounds = mainWindow.getBounds();
    const { x, y } = getEdgeShownPos(bounds);
    setEdgeWindowPos(x, y, bounds);
  }
  clearEdgeDock();
};

const createWindow = (onReadyCallback, showOnReady = true) => {
  const { app } = require('electron');

  // 窗口底色取当前主题底色（与 src/styles/theme.css 的 --color-bg-primary 一致），
  // 避免窗口出现早于页面首帧时闪一下白屏
  // 同步给原生 UI（托盘菜单、系统对话框等），否则它们只跟随系统、不跟随应用内主题设置
  nativeTheme.themeSource = loadSettings().systemTheme || 'system';
  const useDarkBackground = isDarkTheme();

  const rawWindowSize = loadSettings().defaultWindowSize;
  const defaultWindowSize = typeof rawWindowSize === 'string'
    ? (() => { try { return JSON.parse(rawWindowSize); } catch { return null; } })()
    : (rawWindowSize || null);

  // 按上次模式开窗：settings 无 windowMode 字段（旧配置）时回退大窗，避免首帧闪烁
  windowMode = loadSettings().windowMode === 'compact' ? 'compact' : 'large';
  const initialSize = windowMode === 'compact'
    ? COMPACT_WINDOW_SIZE
    : {
        width: (defaultWindowSize && typeof defaultWindowSize.width === 'number') ? defaultWindowSize.width : 1160,
        height: (defaultWindowSize && typeof defaultWindowSize.height === 'number') ? defaultWindowSize.height : 800,
      };

  mainWindow = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    frame: false,
    titleBarStyle: 'hidden',
    // Windows 下 DWM 阴影/系统边框线由 WS_THICKFRAME 样式触发，hasShadow 与运行时 setHasShadow 均无法移除；
    // 贴边停靠要求边缘零痕迹，必须以 thickFrame: false 创建（同时移除系统原生 Snap，避免与自定义边缘吸附冲突）；
    // 由此导致的方角（Electron 在 thickFrame 关闭时强制 rounded_corner_=false，roundedCorners 选项被覆盖）由下方 applyWin11RoundedCorners 恢复
    thickFrame: false,
    icon: getAppIcon(),
    backgroundColor: useDarkBackground ? '#16181D' : '#FFFFFF',
    show: false,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      nativeWindowOpen: true,
    },
  });

  // 恢复 Win11 窗口圆角：thickFrame: false 时 Electron 强制方角且未暴露运行时圆角 API，
  // 绕过它直接设置 DWM 圆角偏好为 ROUND（与 Electron 内部 SetRoundedCorners 同一 API；
  // Win10 无此属性会静默失败，方角即系统常态）。属性一次设置持续有效，仅启动时执行一次。
  const applyWin11RoundedCorners = () => {
    const buf = mainWindow.getNativeWindowHandle();
    const hwnd = process.arch === 'x64' ? buf.readBigUInt64LE(0) : buf.readUInt32LE(0);
    const script = [
      '$v = 2', // DWMWCP_ROUND
      '$d = Add-Type -MemberDefinition \'[DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr h, int a, ref int v, int s);\' -Name Dwm -Namespace Win32 -PassThru',
      '[void]$d::DwmSetWindowAttribute([IntPtr]::new(' + hwnd + '), 33, [ref]$v, 4)', // 33 = DWMWA_WINDOW_CORNER_PREFERENCE
    ].join('\n');
    execFile('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], () => {});
  };

  // T09 / Phase 4：文件监听的事件推送目标 = 主窗口（notes-fs-changed 走 webContents.send）。
  // 必须在建窗之后注入：registerIpcHandlers 先于 createWindow 执行，那时主窗口还不存在；
  // 而且这里只能用模块级的 mainWindow —— open-internal 那个 internalWindow 是另一个作用域的局部变量。
  require('../services/notesWatcherService.cjs').setTargetWindow(mainWindow);

  // 小窗模式开窗：应用尺寸约束（大窗约束与现状一致，无需额外设置）
  if (windowMode === 'compact') {
    mainWindow.setMinimumSize(COMPACT_MIN_SIZE.width, COMPACT_MIN_SIZE.height);
    mainWindow.setMaximumSize(COMPACT_MAX_WIDTH, 0);
  }

  // 还原上次退出的吸附状态（未吸附或记录不可用时保持默认居中启动）
  restoreDockState();

  let indexPath;
  if (app.isPackaged) {
    const possiblePaths = [
      path.join(__dirname, '../../dist/index.html'),
      path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
      path.join(process.resourcesPath, 'dist', 'index.html')
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        indexPath = p;
        break;
      }
    }
    if (indexPath) {
      mainWindow.loadURL(url.format({
        pathname: indexPath,
        protocol: 'file:',
        slashes: true,
      }));
    } else {
      mainWindow.loadURL('data:text/html,<h1>Error</h1><p>Could not find index.html.</p>');
    }
  } else {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('did-finish-load', () => {
    // 圆角设置放在页面加载完成后执行：属性一次设置持续有效，且仍早于下面的 show()，
    // 视觉与原先在建窗时同步调用完全一致，但不再与 loadURL 争抢启动关键路径。
    applyWin11RoundedCorners();
    setTimeout(() => {
      if (showOnReady) {
        mainWindow.show();
      }
      initShortcuts();
      startAutoLock();
      startMemoryOptimization(); // 开机即按当前设置启动内存优化（此前仅切换设置时启动，重启后不生效）

      if (onReadyCallback) {
        onReadyCallback();
      }
    }, 100);
  });

  // 主页面加载失败（打包后 index.html 缺失 / 损坏等）时兜底把窗口显示出来：
  // 否则 did-finish-load 永远不会触发，窗口一直 show=false，变成「进程在、界面不出来」。
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    console.error('[Main] 主页面加载失败:', errorCode, errorDescription, validatedURL);
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  // 渲染进程崩溃降级：停靠展开态的折叠依赖渲染层光标跨界事件转发，进程已死则退出停靠管理，
  // 窗口保持展开位置不再自动隐藏；隐藏态由主进程轮询与焦点驱动，不受影响
  mainWindow.webContents.on('render-process-gone', () => {
    if (edgeDockedEdge && !edgeHidden) clearEdgeDock();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    stopAutoLock();
    clearEdgeDock();
    mainWindow = null;
  });

  // 最小化：非停靠态隐藏进托盘；停靠态放行系统最小化（Windows 下事件无法取消：系统已完成
  // 最小化，事件内做位置调整会与最小化/还原流程冲突，导致还原后窗口状态错乱无法交互），
  // 与常规最小化行为一致；清理进行中的折叠定时/动画，避免还原后窗口被误折叠。
  // 还原展开由 restore / focus 处理器负责
  mainWindow.on('minimize', (event) => {
    if (edgeDockedEdge) {
      if (edgeHideTimer) {
        clearTimeout(edgeHideTimer);
        edgeHideTimer = null;
      }
      cancelEdgeAnimation();
      return;
    }
    event.preventDefault();
    mainWindow.hide();
  });

  // 边缘吸附与贴边隐藏的入口挂载（核心逻辑见模块级 handleMainWindowMove / snapWindowToEdge）
  mainWindow.on('move', handleMainWindowMove);

  // 停靠态下拖边改尺寸时同步更新吸附记录，保证还原尺寸与退出时一致
  mainWindow.on('resized', () => {
    if (edgeDockedEdge) persistDockState();
  });

  // 用户拖拽边界（Windows 窗口消息，程序性 setBounds 不触发，吸附/折叠动画不受影响）：
  // 拖拽开始立即退出停靠并取消进行中的自移动画（修复停靠态拖出时动画/吸附与用户拖拽抢位置导致窗口乱飞）；
  // 拖拽结束统一做吸附判定
  mainWindow.hookWindowMessage(0x0231 /* WM_ENTERSIZEMOVE */, () => {
    edgeUserDragging = true;
    if (!loadSettings().isWindowEdgeAdsorption) return;
    cancelEdgeAnimation();
    clearEdgeDock();
  });
  mainWindow.hookWindowMessage(0x0232 /* WM_EXITSIZEMOVE */, () => {
    edgeUserDragging = false;
    if (!loadSettings().isWindowEdgeAdsorption) return;
    if (snapTimer) clearTimeout(snapTimer);
    snapTimer = setTimeout(snapWindowToEdge, 150);
  });

  // 隐藏态被系统被动夺焦（其他应用逐一最小化后焦点转移）时拒绝焦点不展开：
  // 停靠态已不占任务栏/Alt+Tab，focus 无用户主动唤出路径；立即 blur 避免焦点滞留隐藏窗口
  mainWindow.on('focus', () => {
    if (edgeDockedEdge && edgeHidden) mainWindow.blur();
  });

  // 从最小化还原（任务栏 / Win+D 等）：停靠隐藏态自动展开（focus 若先于还原完成触发，
  // 会被 showEdgeWindow 的 isMinimized 守卫拦截，此处兜底保证展开）
  mainWindow.on('restore', () => {
    if (!edgeDockedEdge || !edgeHidden) return;
    showEdgeWindow();
  });

  // 失焦收回：停靠展开态被切走（点击其他应用 / Alt+Tab）且光标已在窗外时折叠；
  // 光标仍在窗口内（自家子窗口、文件对话框等夺焦）不折叠，交回渲染层 mouseleave 流程；
  // IME 组合中候选窗夺焦不折叠（输入中途收回会打断输入，由 compositionend 补偿判定）
  mainWindow.on('blur', () => {
    if (!edgeDockedEdge || edgeHidden) return;
    if (edgeImeComposing) return;
    if (isCursorInsideWindow()) return;
    hideEdgeWindow();
  });
};

let ipcHandlersRegistered = false;

const registerIpcHandlers = () => {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;
  
  const { ipcMain } = require('electron');
  const { loadShortcuts, saveShortcuts, loadFloatConfig, loadFloatConfigWithIcons, saveFloatConfig, getDefaultFloatConfig, clearIconCacheByType, clearAllIconCache, resolveIconUrls, getIconCacheStats } = require('../lib/config.cjs');
  
  const { registerPluginIpc } = require('../ipc/pluginIpc.cjs');
  registerPluginIpc();

  const getUpdateErrorMessage = (error) => {
    const errorStr = error instanceof Error ? error.message : String(error);
    
    if (errorStr.includes('network') || errorStr.includes('connect')) {
      return '网络连接失败，请检查网络后重试';
    }
    
    if (errorStr.includes('timeout')) {
      return '连接超时，请稍后重试';
    }
    
    if (errorStr.includes('404') || errorStr.includes('not found')) {
      return '未找到更新信息，请稍后重试';
    }
    
    if (errorStr.includes('permission') || errorStr.includes('access denied')) {
      return '没有写入权限，请以管理员身份运行';
    }
    
    if (errorStr.includes('disk') || errorStr.includes('space')) {
      return '磁盘空间不足，请清理后重试';
    }
    
    if (errorStr.includes('EOF')) {
      return '下载文件不完整，请重试';
    }
    
    return errorStr || '更新失败，请稍后重试';
  };

  // 标题栏最小化按钮：停靠态切换「折叠 ⇄ 展开」（吸附期不占用任务栏，真实最小化将无从还原）；
  // 非停靠态走系统最小化（由 minimize 事件转入托盘）
  ipcMain.on('window-minimize', () => {
    if (isWindowEdgeDocked()) toggleEdgeDockWindow();
    else mainWindow.minimize();
  });

  // 边缘吸附停靠态：渲染层光标跨界事件转发（mouseleave → 延迟折叠；mouseenter → 取消折叠）
  ipcMain.on('edge-snap:cursor-left', () => {
    if (!edgeDockedEdge || edgeHidden) return; // 未停靠 / 已折叠时忽略渲染层事件
    if (edgeHideTimer) clearTimeout(edgeHideTimer);
    edgeHideTimer = setTimeout(() => {
      edgeHideTimer = null;
      if (edgeImeComposing) return; // IME 输入中不折叠，待 compositionend 补偿判定
      hideEdgeWindow();
    }, EDGE_HIDE_DELAY_MS);
  });

  // 输入法组合态：输入中抑制自动折叠；输入结束时补偿判定（失焦且光标在窗外 → 延迟折叠兜底）
  ipcMain.on('edge-snap:ime-state', (_event, composing) => {
    edgeImeComposing = !!composing;
    if (edgeImeComposing || !edgeDockedEdge || edgeHidden || !mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isFocused() || isCursorInsideWindow()) return;
    if (edgeHideTimer) clearTimeout(edgeHideTimer);
    edgeHideTimer = setTimeout(hideEdgeWindow, EDGE_HIDE_DELAY_MS);
  });

  ipcMain.on('edge-snap:cursor-enter', () => {
    if (edgeHideTimer) {
      clearTimeout(edgeHideTimer);
      edgeHideTimer = null;
    }
    if (edgeDockedEdge && edgeHidden) showEdgeWindow();
  });

  ipcMain.on('window-maximize', () => {
    if (windowMode === 'compact') return; // 小窗模式不提供最大化
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window-mode-set', (_event, mode) => { applyWindowMode(mode); });
  ipcMain.on('window-close', () => { mainWindow.hide(); });
  ipcMain.on('open-external', (event, url) => { shell.openExternal(url); });

  ipcMain.on('open-file', (event, filePath) => {
    shell.openPath(filePath).catch((error) => { console.error('Failed to open file:', error); });
  });

  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '可执行文件', extensions: ['exe', 'bat', 'cmd', 'lnk'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // 桌面扫描：用户桌面 + 公共桌面（Windows 实际显示的桌面为两者合并）
  // 命名/去重/进度/规则与已安装应用扫描完全一致（共享 scanQuickLaunchPaths）
  ipcMain.handle('scan-desktop-apps', async (event) => {
    const { app } = require('electron');
    try {
      return await scanQuickLaunchPaths(event, [
        app.getPath('desktop'),
        path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop')
      ]);
    } catch (error) {
      return [];
    }
  });

  const logger = require('../logs/logger.cjs');

  const normalizePath = (inputPath) => {
    if (!inputPath) return null;
    
    let normalized = inputPath.trim();
    normalized = normalized.replace(/\//g, '\\');
    
    if (normalized.startsWith('\\')) {
      normalized = normalized.substring(1);
    }
    
    const unixDriveMatch = normalized.match(/^([A-Za-z]):\\/);
    if (!unixDriveMatch) {
      const driveMatch = inputPath.match(/^\/([A-Za-z])\//);
      if (driveMatch) {
        normalized = `${driveMatch[1]}:\\${inputPath.substring(3).replace(/\//g, '\\')}`;
      }
    }
    
    return normalized;
  };

  ipcMain.handle('get-dropped-files', async (event, filePaths) => {
    const result = [];

    logger.addLog('debug', `[QuickLaunch] 接收到 ${filePaths.length} 个文件路径`, 'drag-drop');

    for (const filePath of filePaths) {
      if (!filePath || !filePath.trim()) {
        continue;
      }

      logger.addLog('debug', `[QuickLaunch] 处理文件: ${filePath}`, 'drag-drop');

      if (isSupportedFileType(filePath)) {
        const targetPath = filePath.toLowerCase().endsWith('.lnk')
          ? (await getShortcutInfo(filePath)).targetPath
          : filePath;

        if (fs.existsSync(targetPath)) {
          logger.addLog('debug', `[QuickLaunch] 路径存在: ${targetPath}`, 'drag-drop');
          result.push(targetPath);
        } else {
          logger.addLog('warn', `[QuickLaunch] 路径不存在: ${targetPath}`, 'drag-drop');
        }
      } else {
        logger.addLog('debug', `[QuickLaunch] 路径扩展名不支持: ${filePath}`, 'drag-drop');
      }
    }

    logger.addLog('info', `[QuickLaunch] getDroppedFiles 返回 ${result.length} 个有效路径`, 'drag-drop');
    return result;
  });

  ipcMain.handle('get-file-icon', async (event, filePath) => {
    return await getFileIcon(filePath);
  });

  ipcMain.handle('file-exists', (event, filePath) => {
    return fs.existsSync(filePath);
  });

  // P1: 启动应用（带可选参数 / 工作目录 / 管理员 / 窗口模式）
  ipcMain.handle('launch-app-with-options', async (event, options) => {
    const { path: filePath, args, workingDir, runAsAdmin, windowMode } = options || {};
    if (!filePath) return { success: false, error: '路径不能为空' };

    const normalized = normalizePath(filePath);
    if (!normalized) return { success: false, error: '路径无效' };

    // 构造 PowerShell Start-Process 命令
    const parts = [`Start-Process -FilePath '${normalized.replace(/'/g, "''")}'`];
    if (args) parts.push(`-ArgumentList '${args.replace(/'/g, "''")}'`);
    if (workingDir) parts.push(`-WorkingDirectory '${workingDir.replace(/'/g, "''")}'`);
    if (windowMode === 'minimized') parts.push('-WindowStyle Minimized');
    if (windowMode === 'maximized') parts.push('-WindowStyle Maximized');
    if (runAsAdmin) parts.push('-Verb RunAs');

    return new Promise((resolve) => {
      execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-Command', parts.join(' ')], { timeout: 10000 }, (error) => {
        if (error) {
          logger.addLog('warn', `[QuickLaunch] 启动失败: ${error.message}`, 'launch');
          resolve({ success: false, error: error.message });
        } else {
          logger.addLog('info', `[QuickLaunch] 启动成功: ${normalized}`, 'launch');
          resolve({ success: true });
        }
      });
    });
  });

  // P1: 在资源管理器中定位文件
  ipcMain.handle('reveal-in-folder', (event, filePath) => {
    if (!filePath) return false;
    const normalized = normalizePath(filePath);
    if (!normalized) return false;
    try {
      require('child_process').execFile('explorer.exe', ['/select,', normalized], (error) => {
        if (error) {
          logger.addLog('warn', `[QuickLaunch] 定位失败: ${error.message}`, 'reveal');
        } else {
          logger.addLog('info', `[QuickLaunch] 定位文件: ${normalized}`, 'reveal');
        }
      });
      return true;
    } catch (e) {
      logger.addLog('warn', `[QuickLaunch] 定位异常: ${e.message}`, 'reveal');
      return false;
    }
  });

  // 已安装应用扫描：开始菜单（系统/用户）+ 快速启动栏（含任务栏固定项）
  // 命名/去重/进度/规则与桌面扫描完全一致（共享 scanQuickLaunchPaths）
  ipcMain.handle('scan-installed-apps', async (event) => {
    const { app } = require('electron');
    return scanQuickLaunchPaths(event, [
      path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(app.getPath('appData'), 'Microsoft', 'Internet Explorer', 'Quick Launch')
    ]);
  });

  // P2: 全局快捷键启动应用
  ipcMain.handle('register-quick-launch-hotkey', (event, { appId, accelerator, appPath }) => {
    if (!appId || !accelerator || !appPath) {
      return { success: false, error: '参数不完整' };
    }
    // 注销旧绑定
    if (quickLaunchHotkeys.has(appId)) {
      shortcutManager.unregister(quickLaunchHotkeys.get(appId));
    }
    // 检查冲突（已注册且非本应用）
    if (shortcutManager.isRegistered(accelerator) && quickLaunchHotkeys.get(appId) !== accelerator) {
      return { success: false, error: '快捷键已被占用' };
    }
    shortcutManager.register(accelerator, () => {
      shell.openPath(appPath);
    }, true);
    quickLaunchHotkeys.set(appId, accelerator);
    logger.addLog('info', `[QuickLaunch] 注册热键: ${accelerator} -> ${appPath}`, 'hotkey');
    return { success: true };
  });

  ipcMain.handle('unregister-quick-launch-hotkey', (event, appId) => {
    if (quickLaunchHotkeys.has(appId)) {
      const acc = quickLaunchHotkeys.get(appId);
      shortcutManager.unregister(acc);
      quickLaunchHotkeys.delete(appId);
      logger.addLog('info', `[QuickLaunch] 注销热键: ${acc}`, 'hotkey');
    }
    return true;
  });

  // 暴露批量注册接口，供 main.cjs 启动时加载
  ipcMain.handle('get-quick-launch-hotkeys', () => {
    return Array.from(quickLaunchHotkeys.entries()).map(([appId, accelerator]) => ({ appId, accelerator }));
  });

  // P2: 配置导出 / 导入
  ipcMain.handle('export-quick-launch-config', async (event, content) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出快启动配置',
      defaultPath: 'quick-launch-config.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (result.canceled) return null;
    try {
      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { success: true, filePath: result.filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('import-quick-launch-config', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入快启动配置',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    try {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8');
      const data = JSON.parse(content);
      if (!Array.isArray(data.apps) || !Array.isArray(data.categories)) {
        return { error: '配置文件格式不正确' };
      }
      // 校验每条 app 必须有 id/path/name
      for (const app of data.apps) {
        if (!app.id || !app.path || !app.name) {
          return { error: '应用数据字段缺失' };
        }
      }
      return data;
    } catch (e) {
      return { error: `读取失败: ${e.message}` };
    }
  });

  ipcMain.handle('get-autostart-status', () => {
    const settings = require('electron').app.getLoginItemSettings();
    return settings.openAtLogin;
  });

  ipcMain.handle('set-autostart-status', (event, enable) => {
    require('electron').app.setLoginItemSettings({ args: [], openAtLogin: enable, path: process.execPath });
    const settings = loadSettings();
    settings.isAutoLaunch = enable ? 1 : 0;
    saveSettings(settings);
    return true;
  });

  ipcMain.handle('get-settings', () => {
    const settings = loadSettings();
    return Object.keys(settings).map(key => ({ name: key, value: settings[key] }));
  });

  ipcMain.handle('get-float-config', () => { return loadFloatConfig(); });

  ipcMain.handle('get-float-config-with-icons', async () => {
    try {
      return await loadFloatConfigWithIcons();
    } catch (error) {
      console.error('Failed to load float config with icons:', error);
      return loadFloatConfig();
    }
  });

  ipcMain.handle('clear-icon-cache', async (_event, { type }) => {
    try {
      if (type === 'all') {
        clearAllIconCache();
      } else {
        clearIconCacheByType(type);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 远程图标统一解析入口：返回 { 原始url: local-media 地址 | null }。
  // 渲染层只用返回的本地地址渲染，拿不到就显示兜底图标，避免国内网络下破图。
  ipcMain.handle('icon:resolve', async (_event, { urls, type }) => {
    try {
      return await resolveIconUrls(urls, type);
    } catch (error) {
      console.error('Failed to resolve icons:', error);
      return {};
    }
  });

  ipcMain.handle('get-icon-cache-stats', () => {
    return getIconCacheStats();
  });

  ipcMain.handle('update-float-config', (event, config) => {
    saveFloatConfig(config);
    const floatWindow = getFloatWindow();
    if (floatWindow) {
      floatWindow.webContents.send('float-config-changed', config);
    }
    return { code: 0, msg: '悬浮球配置已更新' };
  });

  ipcMain.handle('reset-float-config', () => {
    saveFloatConfig(getDefaultFloatConfig());
    return { code: 0, msg: '悬浮球配置已重置' };
  });

  ipcMain.handle('update-setting', (event, setting) => {
    const settings = loadSettings();
    settings[setting.name] = setting.value;
    saveSettings(settings);

    if (setting.name === 'isAutoLaunch') {
      require('electron').app.setLoginItemSettings({ args: [], openAtLogin: setting.value === 1, path: process.execPath });
    }

    if (setting.name === 'isMemoryOptimizationEnabled') {
      startMemoryOptimization();
    }

    // 关闭边缘吸附时退出停靠管理；若窗口正贴边隐藏，先恢复完整显示
    if (setting.name === 'isWindowEdgeAdsorption' && !setting.value) {
      resetEdgeSnap();
    }

    if (setting.name === 'isAutoLockEnabled' || setting.name === 'autoLockTimeout') {
      startAutoLock();
      if (setting.name === 'isAutoLockEnabled') {
        resetAutoLockTimer();
      }
    }

    if (setting.name === 'networkConfig') {
      invalidateNetworkConfigCache();
    }

    // 主题：切完后原生 UI 与悬浮球窗口都要跟着变（主窗口由下面的 setting-changed 自行处理）
    if (setting.name === 'systemTheme') {
      nativeTheme.themeSource = setting.value || 'system';
      const floatWindow = getFloatWindow();
      floatWindow?.webContents.send('theme-changed', { isDark: nativeTheme.shouldUseDarkColors });
      require('./tray.cjs').refreshTrayMenu();
    }

    mainWindow?.webContents.send('setting-changed', { name: setting.name, value: setting.value });
    return { code: 0, msg: '设置已更新' };
  });

  ipcMain.handle('network:test', async (event, { url, timeout }) => {
    const start = Date.now();
    if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
      return { ok: false, statusCode: 0, latencyMs: 0, error: '无效的 URL' };
    }
    const lib = url.startsWith('https') ? require('https') : require('http');
    return await new Promise((resolve) => {
      const req = lib.get(url, { timeout: timeout || 8000 }, (res) => {
        res.destroy();
        resolve({ ok: res.statusCode < 400, statusCode: res.statusCode, latencyMs: Date.now() - start, error: null });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, statusCode: 0, latencyMs: Date.now() - start, error: '请求超时' });
      });
      req.on('error', (err) => {
        resolve({ ok: false, statusCode: 0, latencyMs: Date.now() - start, error: err.message });
      });
    });
  });

  ipcMain.handle('clear-cache', async () => {
    try {
      const userDataPath = require('electron').app.getPath('userData');
      const cacheFolders = [
        path.join(userDataPath, 'icon-cache'),
        path.join(userDataPath, 'Cache'),
        path.join(userDataPath, 'Code Cache'),
        path.join(userDataPath, 'GPUCache'),
        path.join(userDataPath, 'Service Worker')
      ];
      cacheFolders.forEach(folder => {
        if (fs.existsSync(folder)) {
          try { fs.rmSync(folder, { recursive: true, force: true }); } catch (folderError) {}
        }
      });
      fs.mkdirSync(path.join(userDataPath, 'icon-cache'), { recursive: true });
      if (mainWindow && mainWindow.webContents) {
        try {
          await mainWindow.webContents.session.clearCache();
        } catch (sessionError) {}
      }
      return { code: 0, msg: '缓存已清除' };
    } catch (error) {
      return { code: -1, msg: '清除缓存失败: ' + error.message };
    }
  });

  ipcMain.handle('restart-app', async () => {
    try {
      const { app } = require('electron');
      app.relaunch();
      app.exit(0);
      return { code: 0, msg: '应用重启中...' };
    } catch (error) {
      return { code: -1, msg: '重启失败: ' + error.message };
    }
  });

  ipcMain.handle('get-user-data-path', () => {
    return require('electron').app.getPath('userData');
  });

  ipcMain.handle('open-user-data-folder', async () => {
    const userDataPath = require('electron').app.getPath('userData');
    await shell.openPath(userDataPath);
    return { success: true };
  });

  ipcMain.handle('get-shortcuts', () => { return loadShortcuts(); });

  ipcMain.handle('update-shortcut', (event, shortcut) => {
    const shortcuts = loadShortcuts();
    const index = shortcuts.findIndex(s => s.id === shortcut.id);
    if (index !== -1) {
      const oldShortcut = { ...shortcuts[index] };
      shortcuts[index] = { ...shortcuts[index], ...shortcut };
      saveShortcuts(shortcuts);

      let success = true;
      let message = '快捷键已更新';

      if (shortcut.flag) {
        success = isDisableShortcuts(shortcuts[index]);
        if (success) { message = '快捷键状态已更新'; }
      } else {
        success = updateShortcut(shortcuts[index], oldShortcut);
        if (!success) { message = '快捷键已被占用'; }
      }
      return { code: success ? 0 : -1, msg: message, data: shortcuts[index] };
    }
    return { code: -1, msg: '快捷键不存在' };
  });

  ipcMain.handle('reset-shortcuts', () => {
    const { defaultShortcuts } = require('../lib/config.cjs');
    const newShortcuts = [...defaultShortcuts];
    saveShortcuts(newShortcuts);
    initShortcuts();
    return { code: 0, msg: '已恢复默认快捷键' };
  });

  ipcMain.handle('get-version', async () => {
    const appUpdateConfig = getNetworkConfig().appUpdate;
    let newVersion = '未知';
    let downloadUrl = appUpdateConfig.repoUrl;

    try {
      const https = require('https');
      const checkUrl = new URL(appUpdateConfig.checkUrl);
      const options = {
        hostname: checkUrl.hostname,
        path: checkUrl.pathname + checkUrl.search,
        headers: { 'User-Agent': 'ToolBox-App' },
        timeout: appUpdateConfig.requestTimeout
      };

      const response = await new Promise((resolve, reject) => {
        const req = https.get(options, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            const redirectUrl = res.headers.location;
            if (!redirectUrl) {
              reject(new Error('重定向URL无效'));
              return;
            }
            res.destroy();
            const redirectOptions = {
              hostname: new URL(redirectUrl).hostname,
              path: new URL(redirectUrl).pathname + new URL(redirectUrl).search,
              headers: { 'User-Agent': 'ToolBox-App' },
              timeout: appUpdateConfig.requestTimeout
            };
            https.get(redirectOptions, (redirectRes) => {
              let data = '';
              redirectRes.on('data', (chunk) => { data += chunk; });
              redirectRes.on('end', () => resolve(data));
              redirectRes.on('error', reject);
            }).on('error', reject);
            return;
          }

          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => resolve(data));
          res.on('error', reject);
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('请求超时'));
        });

        req.on('error', reject);
      });

      const release = JSON.parse(response);

      if (release.tag_name) {
        newVersion = release.tag_name.replace('v', '');
      }

      if (release.assets && release.assets.length > 0) {
        const installer = release.assets.find(a => a.name.endsWith('.exe'));
        if (installer) {
          downloadUrl = installer.browser_download_url;
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', getUpdateErrorMessage(error));
    }

    return {
      version: require('electron').app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      newVersion: newVersion,
      github: appUpdateConfig.repoUrl,
      download: downloadUrl
    };
  });

  ipcMain.handle('download-update', async (event, url) => {
    try {
      const https = require('https');
      const http = require('http');
      const downloadPath = path.join(require('electron').app.getPath('downloads'), 'ToolBox-Setup.exe');
      
      return new Promise((resolve, reject) => {
        const download = (currentUrl) => {
          const protocol = currentUrl.startsWith('https') ? https : http;
          const parsedUrl = new URL(currentUrl);
          
          const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            headers: {
              'User-Agent': 'ToolBox-App',
              'Accept': '*/*'
            },
            timeout: 30000
          };
          
          protocol.get(options, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
              const redirectUrl = response.headers.location;
              if (!redirectUrl) {
                reject({ code: -1, msg: '重定向URL无效' });
                return;
              }
              response.destroy();
              download(redirectUrl);
              return;
            }
            
            if (response.statusCode !== 200) {
              reject({ code: -1, msg: `下载失败，HTTP状态码: ${response.statusCode}` });
              return;
            }
            
            const totalSize = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedSize = 0;
            const file = fs.createWriteStream(downloadPath);
            
            response.on('data', (chunk) => {
              downloadedSize += chunk.length;
              if (totalSize > 0) {
                const progress = Math.round((downloadedSize / totalSize) * 100);
                event.sender.send('update-download-progress', progress);
              }
            });
            
            response.pipe(file);
            
            file.on('finish', () => {
              file.close();
              event.sender.send('update-download-progress', 100);
              resolve({ code: 0, msg: '下载完成', path: downloadPath });
            });
            
            file.on('error', (err) => {
              fs.unlink(downloadPath, () => {});
              reject({ code: -1, msg: `文件写入失败: ${err.message}` });
            });
          }).on('error', (err) => {
            fs.unlink(downloadPath, () => {});
            reject({ code: -1, msg: `网络请求失败: ${err.message}` });
          }).on('timeout', () => {
            fs.unlink(downloadPath, () => {});
            reject({ code: -1, msg: '下载超时，请重试' });
          });
        };
        
        download(url);
      });
    } catch (error) {
      return { code: -1, msg: `下载失败: ${error.message}` };
    }
  });

  ipcMain.handle('install-update', async (event, filePath) => {
    try {
      return new Promise((resolve, reject) => {
        execFile(filePath, [], (error) => {
          if (error) {
            reject({ code: -1, msg: `安装启动失败: ${error.message}` });
          } else {
            setTimeout(() => {
              require('electron').app.exit(0);
            }, 500);
            resolve({ code: 0, msg: '安装程序已启动，请等待安装完成' });
          }
        });
      });
    } catch (error) {
      return { code: -1, msg: `安装失败: ${error.message}` };
    }
  });

  ipcMain.on('open-internal', (event, urlPath) => {
    const { BrowserWindow, Menu, MenuItem, nativeImage, app } = require('electron');
    
    const internalWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      title: 'ToolBox 浏览器',
      icon: getAppIcon(),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    internalWindow.loadURL(urlPath);
    const menu = new Menu();
    menu.append(new MenuItem({
      label: '导航',
      submenu: [
        { label: '后退', accelerator: 'Alt+左箭头', click: () => { if (internalWindow.webContents.canGoBack()) { internalWindow.webContents.goBack(); } }, enabled: false },
        { label: '前进', accelerator: 'Alt+右箭头', click: () => { if (internalWindow.webContents.canGoForward()) { internalWindow.webContents.goForward(); } }, enabled: false },
        { type: 'separator' },
        { label: '刷新', accelerator: 'F5', click: () => { internalWindow.webContents.reload(); } },
        { label: '停止', accelerator: 'Esc', click: () => { internalWindow.webContents.stop(); } },
      ]
    }));
    menu.append(new MenuItem({
      label: '编辑',
      submenu: [
        { label: '复制', accelerator: 'Ctrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'Ctrl+V', role: 'paste' },
        { label: '剪切', accelerator: 'Ctrl+X', role: 'cut' },
        { type: 'separator' },
        { label: '全选', accelerator: 'Ctrl+A', role: 'selectAll' },
      ]
    }));
    menu.append(new MenuItem({
      label: '查看',
      submenu: [
        { label: '重新加载', accelerator: 'Ctrl+R', click: () => { internalWindow.webContents.reload(); } },
        { type: 'separator' },
        { label: '开发者工具', accelerator: 'F12', click: () => { internalWindow.webContents.toggleDevTools(); } },
        { type: 'separator' },
        { label: '全屏', accelerator: 'F11', click: () => { internalWindow.setFullScreen(!internalWindow.isFullScreen()); } },
      ]
    }));
    menu.append(new MenuItem({
      label: '窗口',
      submenu: [
        { label: '最小化', accelerator: 'Ctrl+M', click: () => { internalWindow.minimize(); } },
        { label: '最大化', accelerator: 'Ctrl+Shift+M', click: () => { if (internalWindow.isMaximized()) { internalWindow.unmaximize(); } else { internalWindow.maximize(); } } },
        { type: 'separator' },
        { label: '关闭', accelerator: 'Ctrl+W', click: () => { internalWindow.close(); } },
      ]
    }));
    menu.append(new MenuItem({
      label: '帮助',
      submenu: [
        { label: '关于 ToolBox', click: () => {} },
      ]
    }));
    internalWindow.setMenu(menu);
    internalWindow.webContents.on('did-navigate', () => {
      menu.items[0].submenu.items[0].enabled = internalWindow.webContents.canGoBack();
      menu.items[0].submenu.items[1].enabled = internalWindow.webContents.canGoForward();
    });
  });

  ipcMain.handle('notes-has-root-path', () => notesService.hasRootPath());
  ipcMain.handle('notes-get-root-path', () => notesService.getRootPath());
  ipcMain.handle('notes-set-root-path', (event, rootPath) => notesService.setRootPath(rootPath));
  // 视图根 / 对话根仅用于文件操作越界放行，与主根相互独立，不影响扫描与取树
  ipcMain.handle('notes-set-view-path', (event, viewPath) => notesService.setViewPath(viewPath));
  ipcMain.handle('notes-set-chat-path', (event, chatPath) => notesService.setChatRootPath(chatPath));
  ipcMain.handle('notes-select-folder', async () => notesService.selectFolder());
  ipcMain.handle('notes-validate-folder', (event, folderPath) => notesService.validateFolder(folderPath));
  ipcMain.handle('notes-scan-folder', (event, rootPath) => notesService.scanFolder(rootPath));
  ipcMain.handle('notes-get-file-tree', () => notesService.getFileTree());
  ipcMain.handle('notes-create-folder', (event, parentPath, name) => notesService.createFolder(parentPath, name));
  ipcMain.handle('notes-create-folder-force', (event, parentPath, name, mode) => notesService.createFolderForce(parentPath, name, mode));
  ipcMain.handle('notes-create-note', (event, parentPath, name, content) => notesService.createNote(parentPath, name, content));
  ipcMain.handle('notes-create-note-force', (event, parentPath, name, mode, content) => notesService.createNoteForce(parentPath, name, mode, content));
  ipcMain.handle('notes-read-file', (event, filePath) => notesService.readFile(filePath));
  ipcMain.handle('notes-save-file', (event, filePath, content) => notesService.saveFile(filePath, content));
  ipcMain.handle('notes-rename-item', (event, oldPath, newName) => notesService.renameItem(oldPath, newName));
  ipcMain.handle('notes-delete-item', (event, itemPath) => notesService.deleteItem(itemPath));
  ipcMain.handle('notes-trash-item', async (event, itemPath) => notesService.trashItem(itemPath));
  ipcMain.handle('notes-index-all', (event, rootPath) => notesService.indexAllNotes(rootPath));
  ipcMain.handle('notes-open-file-in-folder', (event, filePath) => notesService.openFileInFolder(filePath));
  ipcMain.handle('notes-read-file-as-buffer', (event, filePath) => notesService.readFileAsBuffer(filePath));
  ipcMain.handle('notes-move-item', (event, itemPath, targetFolderPath) => notesService.moveItem(itemPath, targetFolderPath));
  ipcMain.handle('notes-copy-item', (event, sourcePath) => notesService.copyItem(sourcePath));
  ipcMain.handle('notes-send-item', (event, sourcePath, target) => notesService.sendItem(sourcePath, target));
  ipcMain.handle('notes-import-dropped-files', (event, rootPath, filePaths) => notesService.importDroppedFiles(rootPath, filePaths));
  require('../ipc/notesIpc.cjs').registerNotesIpc();

  ipcMain.handle('ip-info:query', async (event, ip) => {
    const https = require('https');
    return new Promise((resolve) => {
      const url = ip ? `https://ipinfo.io/${ip}/json` : 'https://ipinfo.io/json';
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.error) {
              resolve({ error: true, reason: result.error.message || '查询失败' });
            } else {
              const [latitude, longitude] = result.loc ? result.loc.split(',').map(Number) : [0, 0];
              resolve({
                ip: result.ip || '',
                version: result.ip?.includes(':') ? 'IPv6' : 'IPv4',
                city: result.city || '',
                region: result.region || '',
                country_name: result.country || '',
                country_code: result.country || '',
                timezone: result.timezone || '',
                currency: '',
                currency_name: '',
                postal: result.postal || '',
                latitude,
                longitude,
                org: result.org || '',
                asn: result.asn || '',
                languages: '',
              });
            }
          } catch (error) {
            resolve({ error: true, reason: '解析数据失败' });
          }
        });
      }).on('error', (error) => {
        resolve({ error: true, reason: error.message });
      });
    });
  });

  ipcMain.handle('system-info:get', () => {
    return systemInfoService.getSystemInfo();
  });
};

// P2: 应用退出时统一注销所有快启动全局热键
const cleanupQuickLaunchHotkeys = () => {
  if (quickLaunchHotkeys.size === 0) return;
  for (const accelerator of quickLaunchHotkeys.values()) {
    try { shortcutManager.unregister(accelerator); } catch {}
  }
  quickLaunchHotkeys.clear();
};

module.exports = {
  createWindow,
  registerIpcHandlers,
  startMemoryOptimization,
  stopMemoryOptimization,
  startAutoLock,
  stopAutoLock,
  resetAutoLockTimer,
  getMainWindow: () => mainWindow,
  showMainWindow: () => showMainWindow(),
  isWindowEdgeDocked: () => isWindowEdgeDocked(),
  toggleEdgeDockWindow: () => toggleEdgeDockWindow(),
  setIsQuitting: (val) => { isQuitting = val; },
  cleanupQuickLaunchHotkeys,
};
