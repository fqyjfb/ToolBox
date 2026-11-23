// 便签墙窗口：单例透明 BrowserWindow 承载全部钉住便签卡片。
// 穿透判定：渲染层 mousemove + elementFromPoint 作为快速路径 → IPC 切换；
//           主进程用「系统光标 + 卡片矩形」看门狗纠偏，覆盖 mousemove 丢失/桌面层转发失效；
//           拖拽/编辑/右键菜单期间 forceInteractive 强制可交互。
// 无论钉住多少条便签，只占 1 个渲染进程。
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, screen } = require('electron');
const { getAppIcon } = require('../lib/appIcon.cjs');
const desktopLayer = require('../lib/desktopLayer.cjs');

const REPORT_FRESH_MS = 300; // 渲染层上报超过该时长视为 mousemove 已中断
const WATCHDOG_INTERVAL_MS = 16; // 对齐一帧：消除鼠标移入后首次点击的穿透空窗
const MAX_HIT_RECTS = 200;

let wallWindow = null;
let interactiveState = true; // 当前是否可交互（非穿透）
let forceInteractive = false; // 拖拽/编辑期间强制可交互，优先级最高
let displayListenerBound = false; // screen 监听只绑定一次，避免窗口重建后重复注册
let desktopAttached = false; // 是否已挂到桌面层（Win+D 可见且不遮挡应用）
let hitRects = []; // 渲染层上报的卡片屏幕 DIP 矩形（看门狗命中依据）
let rendererOver = false; // 渲染层最近一次命中结果
let lastReportAt = 0; // 渲染层最近一次上报时间
let lastCursorPoint = { x: -1, y: -1 }; // 看门狗空转判断：光标未移动时无需重复命中测试
let watchdogTimer = null;

/**
 * 挂到桌面层：Win+D 后窗口仍在，但位于所有应用窗口之下。
 * 失败回退到 alwaysOnTop（Win+D 不消失，但会遮挡应用），功能不崩。
 */
const applyDesktopLayer = () => {
  if (!wallWindow || wallWindow.isDestroyed()) return;
  desktopAttached = desktopLayer.attach(wallWindow, computeWallBounds());
  if (!desktopAttached) {
    wallWindow.setAlwaysOnTop(true);
  }
};

const resolveIndexHtml = () => {
  const candidates = [
    path.join(__dirname, '../../dist/index.html'),
    path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
    path.join(process.resourcesPath, 'dist', 'index.html'),
  ];
  return candidates.find((item) => fs.existsSync(item)) || null;
};

// 窗口尺寸 = 所有显示器 workArea 并集（不含任务栏）。
// 便签卡片用桌面绝对坐标定位，渲染层按 origin 换算成窗口内坐标：
// 只有窗口覆盖整个虚拟桌面，卡片才能自由拖到任意位置而不被窗口边缘裁切。
// 窗口本身完全透明且默认鼠标穿透，不会遮挡桌面操作。
const computeWallBounds = () => {
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
  if (!Number.isFinite(minX)) {
    const primary = screen.getPrimaryDisplay().workArea;
    return { x: primary.x, y: primary.y, width: primary.width, height: primary.height };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

/** 窗口左上角对应的桌面坐标，渲染层用它把绝对坐标换算成窗口内坐标 */
const getWallOrigin = () => {
  if (!wallWindow || wallWindow.isDestroyed()) {
    const bounds = computeWallBounds();
    return { x: bounds.x, y: bounds.y };
  }
  const bounds = wallWindow.getBounds();
  return { x: bounds.x, y: bounds.y };
};

const notifyOriginChanged = () => {
  if (!wallWindow || wallWindow.isDestroyed()) return;
  wallWindow.webContents.send('sticky-wall:origin-changed', getWallOrigin());
};

const normalizeHitRects = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((rect) => rect
      && Number.isFinite(rect.left)
      && Number.isFinite(rect.top)
      && Number.isFinite(rect.right)
      && Number.isFinite(rect.bottom))
    .slice(0, MAX_HIT_RECTS)
    .map((rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }));
};

const refreshCursorOver = (point = screen.getCursorScreenPoint()) => {
  if (!wallWindow || wallWindow.isDestroyed() || hitRects.length === 0) return false;
  return hitRects.some((rect) => (
    point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom
  ));
};

const stopWatchdog = () => {
  lastCursorPoint = { x: -1, y: -1 };
  if (!watchdogTimer) return;
  clearInterval(watchdogTimer);
  watchdogTimer = null;
};

const watchdogTick = () => {
  if (!wallWindow || wallWindow.isDestroyed()) {
    stopWatchdog();
    return;
  }
  const point = screen.getCursorScreenPoint();
  // 光标未移动时命中结果不变，直接返回，避免每帧做无效矩形扫描
  if (point.x === lastCursorPoint.x && point.y === lastCursorPoint.y) return;
  lastCursorPoint = point;
  const nextOver = refreshCursorOver(point);
  // 渲染层上报新鲜时以渲染层为准；过期说明 mousemove 已中断，用系统光标纠偏
  if (Date.now() - lastReportAt > REPORT_FRESH_MS && nextOver !== interactiveState) {
    interactiveState = nextOver;
    applyInteractive();
  }
};

const ensureWatchdog = () => {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(watchdogTick, WATCHDOG_INTERVAL_MS);
  watchdogTimer.unref?.();
};

// 根据当前 · 渲染层上报 / 系统光标 / forceInteractive 统一决定是否穿透
const recomputeInteractive = () => {
  if (!wallWindow || wallWindow.isDestroyed()) return;
  const fresh = Date.now() - lastReportAt <= REPORT_FRESH_MS;
  interactiveState = fresh ? rendererOver : refreshCursorOver();
  if (wallWindow.isVisible()) applyInteractive();
};

// 根据当前 interactiveState + forceInteractive 决定是否穿透
const applyInteractive = () => {
  if (!wallWindow || wallWindow.isDestroyed()) return;
  const shouldInteractive = forceInteractive || interactiveState;
  // 只切 WS_EX_TRANSPARENT，不能走 setIgnoreMouseEvents(false)：
  // 它会连 WS_EX_LAYERED 一起删掉，桌面层子窗口失去 LAYERED 后不再逐像素透明，
  // 会变成不透明整屏把桌面图标全盖住。koffi 不可用时回退到 Electron 原生实现。
  if (!desktopLayer.setClickThrough(wallWindow, !shouldInteractive)) {
    wallWindow.setIgnoreMouseEvents(!shouldInteractive, { forward: true });
  }
};

const setInteractive = (value) => {
  rendererOver = Boolean(value);
  lastReportAt = Date.now();
  interactiveState = rendererOver;
  applyInteractive();
};

const setDragActive = (value) => {
  forceInteractive = Boolean(value);
  recomputeInteractive();
};

/**
 * 渲染层上报卡片命中矩形（屏幕 DIP）。看门狗用它判断系统光标是否在便签上，
 * 不依赖 mousemove 转发，解决桌面层子窗口/触摸设备上转发丢失导致的永久穿透。
 */
const setHitRects = (value) => {
  hitRects = normalizeHitRects(value);
  // 强制用系统光标复核一次：覆盖"便签刚出现时光标已停在其上、不会再有 mousemove"的情况
  lastReportAt = 0;
  recomputeInteractive();
};

const openWall = () => {
  if (wallWindow && !wallWindow.isDestroyed()) {
    if (!wallWindow.isVisible()) {
      // 隐藏转显示：统一复位并按系统光标复核，避免渲染层缓存与主进程状态失步
      showWall();
    } else if (!desktopAttached) {
      // 上次挂载失败（如 Explorer 重启过），下次打开时重试
      applyDesktopLayer();
      notifyOriginChanged();
    }
    return wallWindow;
  }

  const indexHtml = resolveIndexHtml();
  if (app.isPackaged && !indexHtml) {
    console.error('[StickyWall] 未找到渲染入口 index.html，便签墙窗口未创建');
    return null;
  }

  // 窗口覆盖整个虚拟桌面：卡片用绝对坐标定位，需要完整画布
  const wallBounds = computeWallBounds();
  wallWindow = new BrowserWindow({
    ...wallBounds,
    title: '便签',
    icon: getAppIcon(),
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    maximizable: false,
    fullscreenable: false,
    // 最终层级由 applyDesktopLayer 决定：挂到桌面层后位于所有应用之下，
    // Win+D 仍可见；挂载失败才回退置顶。
    alwaysOnTop: false,
    skipTaskbar: true,
    backgroundColor: '#00000000', // 完全透明
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'sticky-note-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // 桌面层子窗口会被 Win10 判为遮挡，关闭节流保证拖拽/悬停按帧响应
      backgroundThrottling: false,
    },
  });

  // 默认穿透。这里唯一的 setIgnoreMouseEvents 调用负责两件事：
  // 给窗口加上 WS_EX_LAYERED（透明合成的前提）+ WS_EX_TRANSPARENT，并装好鼠标转发
  // （转发是穿透状态下渲染层还能收到 mousemove 的前提）。
  // 之后的可交互切换只增删 WS_EX_TRANSPARENT，见 applyInteractive。
  interactiveState = false;
  forceInteractive = false;
  hitRects = [];
  rendererOver = false;
  lastReportAt = 0;
  wallWindow.setIgnoreMouseEvents(true, { forward: true });

  // 显示/隐藏期间同步看门狗启停，避免窗口隐藏后空转
  wallWindow.on('show', ensureWatchdog);
  wallWindow.on('hide', stopWatchdog);

  // blur 兜底：拖拽/菜单/编辑期间不清强制位，否则会中断指针捕获、造成拖拽「失焦」；
  // 其余场景清掉上报新鲜度后交给系统光标复核。
  wallWindow.on('blur', () => {
    if (forceInteractive) return;
    lastReportAt = 0;
    recomputeInteractive();
  });

  // close 事件：阻止默认，只隐藏。避免系统关机/重启时误取消钉住
  wallWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      hideWall();
    }
  });

  wallWindow.on('closed', () => {
    stopWatchdog();
    wallWindow = null;
    interactiveState = true;
    forceInteractive = false;
    desktopAttached = false;
    hitRects = [];
    rendererOver = false;
    lastReportAt = 0;
  });

  // 显示器变化：重算画布尺寸并通知渲染层新的坐标原点（只绑定一次）
  if (!displayListenerBound) {
    displayListenerBound = true;
    screen.on('display-metrics-changed', () => {
      if (!wallWindow || wallWindow.isDestroyed()) return;
      try {
        const nextBounds = computeWallBounds();
        // 坐标/尺寸统一走 Electron 的 DIP 接口，避免与宿主的物理像素混算
        if (desktopAttached) {
          desktopLayer.detach(wallWindow, nextBounds);
          applyDesktopLayer();
        } else {
          wallWindow.setBounds(nextBounds);
        }
        notifyOriginChanged();
        recomputeInteractive();
      } catch (error) {
        console.error('[StickyWall] 显示器变化调整窗口失败:', error.message);
      }
    });
  }

  const showOnReady = () => {
    if (!wallWindow || wallWindow.isDestroyed()) return;
    wallWindow.showInactive();
    applyDesktopLayer();
    notifyOriginChanged();
    recomputeInteractive();
    ensureWatchdog();
  };

  if (indexHtml) {
    wallWindow.loadFile(indexHtml, { query: { standalone: 'sticky-wall' } });
  } else {
    wallWindow.loadURL('http://localhost:5174/?standalone=sticky-wall');
  }

  wallWindow.once('ready-to-show', showOnReady);

  return wallWindow;
};

const closeWall = (force = false) => {
  if (!wallWindow || wallWindow.isDestroyed()) return;
  if (force) {
    app.isQuiting = true;
    wallWindow.destroy();
    wallWindow = null;
    app.isQuiting = false;
  } else {
    hideWall();
  }
};

const hideWall = () => {
  if (!wallWindow || wallWindow.isDestroyed()) return;
  forceInteractive = false;
  interactiveState = false;
  stopWatchdog();
  applyInteractive();
  try {
    wallWindow.hide();
  } catch (error) {
    console.error('[StickyWall] 隐藏便签墙失败:', error.message);
  }
};

const showWall = () => {
  if (!wallWindow || wallWindow.isDestroyed()) return;
  forceInteractive = false;
  interactiveState = false;
  // 隐藏期间渲染层不会再上报，重置缓存后用系统光标复核，避免失步后永久穿透
  rendererOver = false;
  lastReportAt = 0;
  try {
    wallWindow.showInactive();
    applyDesktopLayer();
    notifyOriginChanged();
    recomputeInteractive();
    ensureWatchdog();
  } catch (error) {
    console.error('[StickyWall] 显示便签墙失败:', error.message);
  }
};

/**
 * 进入编辑：桌面层是 WS_CHILD 子窗口，无法被激活，
 * 必须先解挂成普通顶层窗口才能拿到键盘焦点，否则 textarea 收不到输入。
 */
const beginEditing = () => {
  if (!wallWindow || wallWindow.isDestroyed()) return;
  try {
    if (desktopAttached) {
      desktopLayer.detach(wallWindow, computeWallBounds());
      wallWindow.setAlwaysOnTop(true); // 编辑期间浮到最前，避免输入区被应用盖住
    }
    wallWindow.focus();
  } catch (error) {
    console.error('[StickyWall] 进入编辑失败:', error.message);
  }
};

/** 退出编辑：挂回桌面层，恢复"Win+D 可见但不遮挡应用"。 */
const endEditing = () => {
  if (!wallWindow || wallWindow.isDestroyed()) return;
  if (!desktopAttached) return;
  try {
    applyDesktopLayer();
    notifyOriginChanged();
    recomputeInteractive();
  } catch (error) {
    console.error('[StickyWall] 退出编辑失败:', error.message);
  }
};

const destroyWall = () => {
  if (!wallWindow || wallWindow.isDestroyed()) return;
  stopWatchdog();
  try {
    wallWindow.destroy();
  } catch (error) {
    console.error('[StickyWall] 销毁便签墙失败:', error.message);
  }
  wallWindow = null;
};

const getWallWindow = () => wallWindow;

const canSleepWall = async () => {
  if (!wallWindow || wallWindow.isDestroyed()) return true;
  if (wallWindow.webContents.isLoading()) return false;
  try {
    return await wallWindow.webContents.executeJavaScript(`!document.querySelector(
      '.sticky-wall-card-textarea, .sticky-wall-card--dragging, .sticky-wall-card--resizing'
    )`);
  } catch (error) {
    console.error('[StickyWall] 休眠状态检查失败:', error.message);
    return false;
  }
};

const isWallSender = (sender) => {
  if (!sender || !wallWindow || wallWindow.isDestroyed()) return false;
  return sender.id === wallWindow.webContents.id;
};

const restorePinned = () => {
  // 启动时不自动创建窗口，等主进程调用 setPinned/服务广播后按需创建
  // （实际由 listPinned → 有钉住便签时 main.cjs 显式调 openWall 触发）
};

module.exports = {
  openWall,
  closeWall,
  hideWall,
  showWall,
  destroyWall,
  getWallWindow,
  canSleepWall,
  isWallSender,
  setInteractive,
  setDragActive,
  setHitRects,
  beginEditing,
  endEditing,
  getWallOrigin,
  restorePinned,
};
