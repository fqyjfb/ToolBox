// 便签墙窗口：单例透明 BrowserWindow 承载全部钉住便签卡片。
// 穿透判定：渲染层 mousemove + elementFromPoint 单源判定 → IPC 切换；
//           主进程 win.on('blur') 只做安全兜底（强制穿透），状态由下一次 mousemove 自愈；
//           拖拽/编辑/右键菜单期间 forceInteractive 强制可交互。
// 无论钉住多少条便签，只占 1 个渲染进程。
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, screen } = require('electron');
const { getAppIcon } = require('../lib/appIcon.cjs');
const desktopLayer = require('../lib/desktopLayer.cjs');

let wallWindow = null;
let interactiveState = true; // 当前是否可交互（非穿透）
let forceInteractive = false; // 拖拽/编辑期间强制可交互，优先级最高
let displayListenerBound = false; // screen 监听只绑定一次，避免窗口重建后重复注册
let desktopAttached = false; // 是否已挂到桌面层（Win+D 可见且不遮挡应用）

/**
 * 挂到桌面层：Win+D 后窗口仍在，但位于所有应用窗口之下。
 * 失败回退到 alwaysOnTop（Win+D 不消失，但会遮挡应用），功能不崩。
 */
const applyDesktopLayer = () => {
  if (!wallWindow || wallWindow.isDestroyed()) return;
  desktopAttached = desktopLayer.attach(wallWindow);
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
  interactiveState = Boolean(value);
  applyInteractive();
};

const setDragActive = (value) => {
  forceInteractive = Boolean(value);
  applyInteractive();
};

const openWall = () => {
  if (wallWindow && !wallWindow.isDestroyed()) {
    // 已可见时不改动穿透状态：命中判定由渲染层 mousemove 维护，
    // 强制重置会让鼠标正悬停的卡片短暂失效
    if (!wallWindow.isVisible()) {
      forceInteractive = false;
      setInteractive(false);
      wallWindow.showInactive();
      applyDesktopLayer();
    } else if (!desktopAttached) {
      // 上次挂载失败（如 Explorer 重启过），下次打开时重试
      applyDesktopLayer();
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
    },
  });

  // 默认穿透。这里唯一的 setIgnoreMouseEvents 调用负责两件事：
  // 给窗口加上 WS_EX_LAYERED（透明合成的前提）+ WS_EX_TRANSPARENT，并装好鼠标转发
  // （转发是穿透状态下渲染层还能收到 mousemove 的前提）。
  // 之后的可交互切换只增删 WS_EX_TRANSPARENT，见 applyInteractive。
  interactiveState = false;
  forceInteractive = false;
  wallWindow.setIgnoreMouseEvents(true, { forward: true });

  // blur 兜底：窗口失焦时强制恢复穿透，覆盖极端丢事件场景。
  // 渲染层收到 blur 后把本地命中缓存重置为 false，下一次 mousemove 会重新判定。
  wallWindow.on('blur', () => {
    forceInteractive = false;
    interactiveState = false;
    applyInteractive();
  });

  // close 事件：阻止默认，只隐藏。避免系统关机/重启时误取消钉住
  wallWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      hideWall();
    }
  });

  wallWindow.on('closed', () => {
    wallWindow = null;
    interactiveState = true;
    forceInteractive = false;
    desktopAttached = false;
  });

  // 显示器变化：重算画布尺寸并通知渲染层新的坐标原点（只绑定一次）
  if (!displayListenerBound) {
    displayListenerBound = true;
    screen.on('display-metrics-changed', () => {
      if (!wallWindow || wallWindow.isDestroyed()) return;
      try {
        // 子窗口坐标相对桌面宿主，改尺寸前必须解挂，改完重新挂载
        if (desktopAttached) desktopLayer.detach(wallWindow);
        wallWindow.setBounds(computeWallBounds());
        if (desktopAttached) applyDesktopLayer();
        notifyOriginChanged();
      } catch (error) {
        console.error('[StickyWall] 显示器变化调整窗口失败:', error.message);
      }
    });
  }

  const showOnReady = () => {
    if (!wallWindow || wallWindow.isDestroyed()) return;
    wallWindow.showInactive();
    applyDesktopLayer();
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
  setInteractive(false);
  try {
    wallWindow.hide();
  } catch (error) {
    console.error('[StickyWall] 隐藏便签墙失败:', error.message);
  }
};

const showWall = () => {
  if (!wallWindow || wallWindow.isDestroyed()) return;
  forceInteractive = false;
  setInteractive(false);
  try {
    wallWindow.showInactive();
    applyDesktopLayer();
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
      desktopLayer.detach(wallWindow);
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
  } catch (error) {
    console.error('[StickyWall] 退出编辑失败:', error.message);
  }
};

const destroyWall = () => {
  if (!wallWindow || wallWindow.isDestroyed()) return;
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
  beginEditing,
  endEditing,
  getWallOrigin,
  restorePinned,
};
