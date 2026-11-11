/**
 * 划词翻译浮层窗口（单例）。
 *
 * 与主窗口完全独立：独立入口 translate.html + 独立 preload，隐藏不销毁，
 * 退出时才放行关闭。定位支持 TTime 的三种模式：跟随鼠标 / 屏幕居中 / 上次位置。
 */
const { BrowserWindow, app, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadSettings, saveSettings } = require('../lib/config.cjs');

const MIN_WIDTH = 360;
const MAX_WIDTH = 720;
const MIN_HEIGHT = 180;
const MAX_HEIGHT = 620;
const DEFAULT_HEIGHT = 360;

let translateWindow = null;
let pendingPayload = null;
let isQuitting = false;
let lastShownText = '';
// 主窗口划词工具条触发（trigger='app-selection'）时，本次显示周期豁免失焦自动隐藏：
// 用户注意力仍在主窗口，焦点进出频繁，blur 收起会让弹窗「闪现即消失」无法交互。
// 系统划词（selection）/ 截图翻译等入口行为不变，显式 hide 时复位。
let suppressHideOnBlur = false;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getPopupWidth = () => {
  const width = Number(loadSettings().translatePopupWidth) || 460;
  return clamp(width, MIN_WIDTH, MAX_WIDTH);
};

/** 当前浮层应载入的页面 */
const loadPopupContent = (win) => {
  if (!app.isPackaged) {
    win.loadURL('http://localhost:5174/translate.html');
    return;
  }
  const candidates = [
    path.join(app.getAppPath(), 'dist', 'translate.html'),
    path.join(process.resourcesPath, 'app.asar', 'dist', 'translate.html'),
    path.join(process.resourcesPath, 'app', 'dist', 'translate.html'),
  ];
  const target = candidates.find((candidate) => fs.existsSync(candidate));
  if (target) win.loadFile(target);
  else win.loadURL('data:text/html,<h1>翻译窗口加载失败</h1>');
};

const isBoundsOnAnyDisplay = (bounds) => {
  if (!bounds) return false;
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  return (
    bounds.x >= area.x - 8 &&
    bounds.y >= area.y - 8 &&
    bounds.x + bounds.width <= area.x + area.width + 8 &&
    bounds.y + 24 <= area.y + area.height
  );
};

/** 按设置里的定位模式计算窗口位置；定位必须在 setBounds 时一次完成 */
const resolveBounds = (width, height) => {
  const settings = loadSettings();
  const positionType = settings.translatePositionType || 'mouse';

  if (positionType === 'last' && settings.translatePopupLastBounds) {
    const last = settings.translatePopupLastBounds;
    const candidate = { x: last.x, y: last.y, width, height };
    if (
      Number.isFinite(last.x) &&
      Number.isFinite(last.y) &&
      isBoundsOnAnyDisplay(candidate)
    ) {
      const area = screen.getDisplayMatching(candidate).workArea;
      return {
        x: clamp(candidate.x, area.x, area.x + area.width - width),
        y: clamp(candidate.y, area.y, area.y + area.height - height),
        width,
        height,
      };
    }
  }

  if (positionType === 'mouse') {
    const point = screen.getCursorScreenPoint();
    const area = screen.getDisplayNearestPoint(point).workArea;
    let x = point.x + 12;
    let y = point.y + 18;
    if (x + width > area.x + area.width) x = point.x - width - 12;
    if (y + height > area.y + area.height) y = point.y - height - 18;
    return {
      x: clamp(x, area.x, area.x + area.width - width),
      y: clamp(y, area.y, area.y + area.height - height),
      width,
      height,
    };
  }

  // 屏幕居中偏上（对应 TTime 的 fromTopOfWindowPercentage 观感）
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: clamp(
      area.y + Math.round(area.height * 0.22),
      area.y,
      area.y + area.height - height,
    ),
    width,
    height,
  };
};

const rememberBounds = () => {
  if (!translateWindow || translateWindow.isDestroyed()) return;
  const settings = loadSettings();
  settings.translatePopupLastBounds = translateWindow.getBounds();
  saveSettings(settings);
};

const hideTranslateWindow = () => {
  if (!translateWindow || translateWindow.isDestroyed()) return;
  suppressHideOnBlur = false;
  rememberBounds();
  translateWindow.hide();
};

const applyAlwaysOnTop = () => {
  if (!translateWindow || translateWindow.isDestroyed()) return;
  translateWindow.setAlwaysOnTop(loadSettings().translatePopupAlwaysOnTop === 1);
};

const createTranslateWindow = () => {
  if (translateWindow && !translateWindow.isDestroyed()) return translateWindow;

  const width = getPopupWidth();
  const height = DEFAULT_HEIGHT;

  translateWindow = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    // transparent 窗口 + 完全透明的 backgroundColor，才会让 .tp-root 的
    // CSS border-radius 透出圆角；backgroundColor 一旦设为实色，圆角外就会
    // 露出实色直角底，圆角效果丢失。
    transparent: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: loadSettings().translatePopupAlwaysOnTop === 1,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, './translate/translate-preload.cjs'),
    },
  });

  loadPopupContent(translateWindow);

  translateWindow.webContents.on('did-finish-load', () => {
    if (!pendingPayload) return;
    const payload = pendingPayload;
    pendingPayload = null;
    // 等渲染层首帧挂载后再下发，避免与订阅 effect 的时序竞态丢事件
    setTimeout(() => {
      if (translateWindow && !translateWindow.isDestroyed()) {
        translateWindow.webContents.send('translate:popup-visible', payload);
      }
    }, 50);
  });

  // Esc 只在浮层内生效，不注册全局 Esc
  translateWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault();
      hideTranslateWindow();
    }
  });

  translateWindow.on('blur', () => {
    if (suppressHideOnBlur) return;
    if (loadSettings().translatePopupHideOnBlur !== 1) return;
    if (loadSettings().translatePopupAlwaysOnTop === 1) return;
    hideTranslateWindow();
  });

  translateWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    hideTranslateWindow();
  });

  translateWindow.on('closed', () => {
    translateWindow = null;
  });

  return translateWindow;
};

/**
 * 显示浮层并下发当前翻译上下文。
 * 锁屏时不弹窗（沿用主窗口的守卫语义）。
 */
const showTranslateWindow = (payload = {}) => {
  if (loadSettings().isLockEnabled === 1) return { success: false, locked: true };
  // 翻译功能总开关：关闭时不显示浮层（快捷键 / 截图翻译 / translate:open 等所有入口统一拦截）
  if (loadSettings().translateEnabled === 0) return { success: false, disabled: true };

  const win = createTranslateWindow();
  const width = getPopupWidth();
  const lastHeight = win.getBounds().height;
  const height = clamp(lastHeight || DEFAULT_HEIGHT, MIN_HEIGHT, MAX_HEIGHT);
  win.setBounds(resolveBounds(width, height));
  applyAlwaysOnTop();

  lastShownText = typeof payload.text === 'string' ? payload.text : '';
  suppressHideOnBlur = payload.trigger === 'app-selection';
  const message = {
    visible: true,
    pinned: loadSettings().translatePopupAlwaysOnTop === 1,
    ...payload,
  };
  if (win.webContents.isLoading()) {
    pendingPayload = message;
  } else {
    win.webContents.send('translate:popup-visible', message);
  }

  win.show();
  win.focus();
  return { success: true, locked: false };
};

/** 高度自适应：宽度保持不变，高度夹取在 180–620；历史面板展开时宽度追加面板宽并夹取不出屏 */
const HISTORY_PANEL_WIDTH = 220;

const resizeTranslateWindow = (height, historyOpen) => {
  if (!translateWindow || translateWindow.isDestroyed()) return;
  const next = clamp(Math.round(Number(height) || DEFAULT_HEIGHT), MIN_HEIGHT, MAX_HEIGHT);
  const bounds = translateWindow.getBounds();
  const width = getPopupWidth() + (historyOpen ? HISTORY_PANEL_WIDTH : 0);
  const workArea = screen.getPrimaryDisplay().workArea;
  // 宽度变化时优先向左扩展，保证右边缘不超出屏幕工作区
  const x = clamp(bounds.x, workArea.x, workArea.x + workArea.width - width);
  translateWindow.setBounds({ x, y: bounds.y, width, height: next });
  // Windows 高 DPI 下 setBounds 与 getSize 可能差 1px，二次修正避免高度抖动
  if (process.platform === 'win32') {
    const [actualWidth, actualHeight] = translateWindow.getSize();
    if (actualHeight !== next || actualWidth !== width) translateWindow.setSize(width, next);
  }
};

const setPinned = (pinned) => {
  const settings = loadSettings();
  settings.translatePopupAlwaysOnTop = pinned ? 1 : 0;
  saveSettings(settings);
  applyAlwaysOnTop();
};

const isTranslateWindowVisible = () => !!translateWindow && !translateWindow.isDestroyed() && translateWindow.isVisible();

const getLastShownText = () => lastShownText;

const getTranslateWindow = () => translateWindow;

/** 退出时放行关闭，避免 close 事件被 preventDefault 拦住 */
const disposeTranslateWindow = () => {
  isQuitting = true;
  if (translateWindow && !translateWindow.isDestroyed()) {
    translateWindow.destroy();
  }
  translateWindow = null;
};

module.exports = {
  showTranslateWindow,
  hideTranslateWindow,
  resizeTranslateWindow,
  setPinned,
  isTranslateWindowVisible,
  getLastShownText,
  getTranslateWindow,
  disposeTranslateWindow,
};
