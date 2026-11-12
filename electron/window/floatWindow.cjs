const { BrowserWindow, Menu, screen, ipcMain, app, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadSettings, saveSettings, loadFloatConfig } = require('../lib/config.cjs');

let floatWindow = null;
let dragOffset = { x: 0, y: 0 };
let isIgnoringMouseEvents = false;
let pointerInBall = false;
let hoverWatchdogTimer = null;
let isExpanded = false;
let isDragging = false;
let isDragOver = false;
let hasInteractiveCard = false;

// 悬浮球窗口尺寸：多屏位置计算与球心换算共用
const WINDOW_SIZE = 300;

// ── 悬浮球形象（桌宠换装）──
// name 与桌宠 .float-pet 的 data-fit 一一对应，空字符串表示无装饰
const FLOAT_APPEARANCE_LIST = [
  { name: '', label: '无装饰' },
  { name: 'ears', label: '🐱 猫耳' },
  { name: 'hat', label: '🎩 帽子' },
  { name: 'scarf', label: '🧣 围巾' }
];

// 兼容旧版本遗留的 PNG 形象名，命不中一律回落到默认形象
const normalizeAppearance = (name) =>
  FLOAT_APPEARANCE_LIST.some(item => item.name === name) ? name : '';

// 桌宠形象尺寸，与 float/float.css 中 .float-ball 保持一致
const PET_SIZE = { width: 66, height: 90 };
// 球体命中容差，与渲染层 float.cjs 的 BALL_HIT_PADDING 一致
const PET_HIT_PADDING = 4;
// 看门狗周期：渲染层 mousemove 中断时（光标快速移出、未触发 mouseleave）用系统光标复核
const HOVER_WATCHDOG_MS = 800;

// 系统光标是否落在球体矩形内（球心 = 窗口中心）
const isCursorInBall = () => {
  if (!floatWindow || floatWindow.isDestroyed()) return false;
  const cursor = screen.getCursorScreenPoint();
  const bounds = floatWindow.getBounds();
  const dx = Math.abs(cursor.x - (bounds.x + Math.round(bounds.width / 2)));
  const dy = Math.abs(cursor.y - (bounds.y + Math.round(bounds.height / 2)));
  return dx <= PET_SIZE.width / 2 + PET_HIT_PADDING && dy <= PET_SIZE.height / 2 + PET_HIT_PADDING;
};

// 鼠标穿透的唯一出口：球内 / 文件拖入 / 菜单展开 / 拖拽 / 可交互卡片 → 接收鼠标事件，否则穿透
const applyMousePassthrough = () => {
  if (!floatWindow || floatWindow.isDestroyed()) return;
  const keepInteractive = pointerInBall || isDragOver || isExpanded || isDragging || hasInteractiveCard;
  if (keepInteractive) {
    if (isIgnoringMouseEvents) {
      isIgnoringMouseEvents = false;
      floatWindow.setIgnoreMouseEvents(false);
    }
    return;
  }
  if (!isIgnoringMouseEvents) {
    isIgnoringMouseEvents = true;
    floatWindow.setIgnoreMouseEvents(true, { forward: true });
  }
};

const stopHoverWatchdog = () => {
  clearInterval(hoverWatchdogTimer);
  hoverWatchdogTimer = null;
};

// 只在「指针在球内」期间运行：复核发现光标已离开才恢复穿透，
// 避免光标静止在球上时被误穿透（那样会导致悬浮球点不动）
const startHoverWatchdog = () => {
  stopHoverWatchdog();
  hoverWatchdogTimer = setInterval(() => {
    if (!floatWindow || floatWindow.isDestroyed()) {
      stopHoverWatchdog();
      return;
    }
    if (isCursorInBall()) return;
    pointerInBall = false;
    stopHoverWatchdog();
    applyMousePassthrough();
  }, HOVER_WATCHDOG_MS);
  if (hoverWatchdogTimer && typeof hoverWatchdogTimer.unref === 'function') hoverWatchdogTimer.unref();
};

const createFloatWindow = () => {
  if (floatWindow) {
    floatWindow.show();
    floatWindow.focus();
    return;
  }

  // 多屏：按上次保存的 displayId 定位；副屏已拔掉时回落到主屏默认位置
  const displays = screen.getAllDisplays();
  const settings = loadSettings();
  const savedPos = settings.floatBallPosition;
  const targetDisplay = displays.find(item => savedPos && item.id === savedPos.displayId) || displays[0];
  const workArea = targetDisplay.workArea;

  const defaultX = workArea.x + workArea.width - 60 - Math.round(WINDOW_SIZE / 2);
  const defaultY = workArea.y + workArea.height - 60 - Math.round(WINDOW_SIZE / 2);
  let x = defaultX;
  let y = defaultY;
  if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
    const inBounds =
      savedPos.x >= workArea.x - WINDOW_SIZE / 2 &&
      savedPos.x <= workArea.x + workArea.width - WINDOW_SIZE / 2 &&
      savedPos.y >= workArea.y - WINDOW_SIZE / 2 &&
      savedPos.y <= workArea.y + workArea.height - 40;
    if (inBounds) {
      x = savedPos.x;
      y = savedPos.y;
    }
  }
  floatWindow = new BrowserWindow({
    width: 300,
    height: 300,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    focusable: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, './float/float-preload.cjs'),
    },
  });

  if (process.platform === 'darwin') {
    floatWindow.setAlwaysOnTop(true, 'floating');
  } else {
    floatWindow.setAlwaysOnTop(true);
  }

  // 初始按系统光标位置判定一次：球内可点击、球外穿透（等价原 250ms 轮询的首次判定），
  // 之后完全由渲染层的球体命中上报 + 800ms 看门狗驱动，主进程空闲时不再唤醒。
  pointerInBall = isCursorInBall();
  applyMousePassthrough();

  const floatHtmlPath = path.join(__dirname, './float/float.html');
  const packagedPath = path.join(process.resourcesPath, 'app', 'electron', 'window', 'float', 'float.html');

  if (app.isPackaged && fs.existsSync(packagedPath)) {
    floatWindow.loadFile(packagedPath);
  } else {
    floatWindow.loadFile(floatHtmlPath);
  }

  floatWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  floatWindow.once('ready-to-show', () => {
    floatWindow.show();
  });

  // 启动卡：页面加载完成后由洞察服务推「今日概览」，取代原渲染层入场欢迎语。
  // 延迟 1.5s 等入场动画播完，避免卡片和弹出动画抢视线。
  floatWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      try { require('../services/floatInsightService.cjs').pushStartupCard(); } catch { /* 服务未加载时静默 */ }
    }, 1500);
  });

  floatWindow.on('system-context-menu', (e) => {
    e.preventDefault();
  });

  floatWindow.on('closed', () => {
    stopHoverWatchdog();
    floatWindow = null;
    // 窗口关闭时清掉拖拽/命中态，避免下次打开时鼠标穿透判定被误跳过
    isDragging = false;
    isExpanded = false;
    isDragOver = false;
    hasInteractiveCard = false;
    pointerInBall = false;
    isIgnoringMouseEvents = false;
    // 球都没了，面板也一并收起
    try { require('./floatPanelWindow.cjs').hidePanel(); } catch { /* 面板模块未加载时忽略 */ }
  });
};

const toggleFloatWindow = () => {
  const settings = loadSettings();
  if (settings.isFloatWindowEnabled === 1) {
    if (floatWindow) {
      floatWindow.close();
      floatWindow = null;
    }
    settings.isFloatWindowEnabled = 0;
    saveSettings(settings);
  } else {
    createFloatWindow();
    settings.isFloatWindowEnabled = 1;
    saveSettings(settings);
  }
  
  const mainWindow = require('./mainWindow.cjs').getMainWindow();
  mainWindow?.webContents.send('setting-changed', { name: 'isFloatWindowEnabled', value: settings.isFloatWindowEnabled });
  
  require('./tray.cjs').refreshTrayMenu();
  
  return settings.isFloatWindowEnabled;
};

// 构建「切换形象」子菜单，选中后同步给悬浮窗渲染进程的 .float-pet
const buildAppearanceMenu = (settings) => {
  const current = normalizeAppearance(settings.floatBallAppearance || '');
  return [{
    label: '切换形象',
    submenu: FLOAT_APPEARANCE_LIST.map(({ name, label }) => ({
      label,
      type: 'radio',
      checked: current === name,
      click: () => {
        const s = loadSettings();
        s.floatBallAppearance = name;
        saveSettings(s);
        if (floatWindow && !floatWindow.isDestroyed()) {
          floatWindow.webContents.send('appearance-changed', { name });
        }
      }
    }))
  }];
};

// 唤出主窗口：停靠折叠态先展开，再显示并取焦点；可选跳转到指定路由
const showMainAndNavigate = (route) => {
  const mainWindow = require('./mainWindow.cjs').getMainWindow();
  if (!mainWindow) return;
  require('./mainWindow.cjs').showMainWindow();
  if (route) mainWindow.webContents.send('navigate-to', route);
};

let floatIpcHandlersRegistered = false;

const registerFloatIpcHandlers = () => {
  if (floatIpcHandlersRegistered) return;
  floatIpcHandlersRegistered = true;
  
  ipcMain.on('float-window-action', (event, action) => {
    const settings = loadSettings();
    // 锁定态统一拦截：所有动作（含 AI / 应用启动）都必须先解锁
    const guard = (run) => {
      if (settings.isLockEnabled === 1) {
        require('./lockWindow.cjs').toggleLock();
        return false;
      }
      run();
      return true;
    };
    require('./float/actions.cjs').dispatch(action, { guard });
  });

  // AI 面板与进阶功能共用一套注册入口，避免 main.cjs 里再挂一次
  require('./floatPanelWindow.cjs').registerFloatPanelIpc();
  require('../services/floatFeatureService.cjs').registerFloatFeatureIpc();
  require('../services/floatInsightService.cjs').registerFloatInsightIpc();

  ipcMain.on('float-drag-start', () => {
    if (!floatWindow) return;
    isDragging = true;
    const cursor = screen.getCursorScreenPoint();
    const [wx, wy] = floatWindow.getPosition();
    dragOffset = { x: cursor.x - wx, y: cursor.y - wy };
  });

  // 每次调用都按最新光标定位，因此渲染进程丢帧合并不会造成位置滞后
  ipcMain.on('float-drag-move', () => {
    if (!floatWindow || !isDragging) return;
    const { x, y } = screen.getCursorScreenPoint();
    const nextX = Math.round(x - dragOffset.x);
    const nextY = Math.round(y - dragOffset.y);
    const [curX, curY] = floatWindow.getPosition();
    if (nextX !== curX || nextY !== curY) floatWindow.setPosition(nextX, nextY);
  });

  ipcMain.on('float-drag-end', () => {
    isDragging = false;
    if (!floatWindow) return;
    const [bx, by] = floatWindow.getPosition();
    const settings = loadSettings();
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    // 记录所在显示器：副屏拔掉后启动时可回落到主屏，不会把窗口留在屏幕外
    settings.floatBallPosition = { x: bx, y: by, displayId: display.id };
    saveSettings(settings);
    applyMousePassthrough();
  });

  ipcMain.handle('float:gestures-enabled', () => loadSettings().floatGesturesEnabled === 1);

  // 球体命中（渲染层 mousemove 命中检测后上报）：取代原 250ms 全量轮询
  ipcMain.on('float:ball-hover', (_event, active) => {
    pointerInBall = Boolean(active);
    applyMousePassthrough();
    if (pointerInBall) {
      startHoverWatchdog();
    } else {
      stopHoverWatchdog();
    }
  });

  // P2-3：文件拖入悬停期间强制窗口接收鼠标事件，否则穿透判定会吞掉 drop
  ipcMain.on('float:drag-over', (_event, active) => {
    isDragOver = Boolean(active);
    applyMousePassthrough();
  });

  // P2-5：气泡带按钮时 renderer 通知主进程 — 保持窗口可点击直到卡片过期
  ipcMain.on('float:interactive-card', (_event, active) => {
    hasInteractiveCard = Boolean(active);
    applyMousePassthrough();
  });

  ipcMain.on('float-show-context-menu', () => {
    if (!floatWindow) return;
    const settings = loadSettings();
    
    if (settings.isLockEnabled === 1) {
      require('./lockWindow.cjs').toggleLock();
      return;
    }
    
    const checkLockAndShow = (callback) => {
      if (settings.isLockEnabled === 1) {
        require('./lockWindow.cjs').toggleLock();
        return;
      }
      callback();
    };

    const menu = Menu.buildFromTemplate([
      {
        label: '小橘',
        submenu: [
          { label: 'AI 对话', click: () => checkLockAndShow(() => require('./float/actions.cjs').dispatch('ai:chat')) },
          { label: '文件中转站', click: () => checkLockAndShow(() => require('./float/actions.cjs').dispatch('ai:shelf')) },
          { label: '快速捕捉', click: () => checkLockAndShow(() => require('./float/actions.cjs').dispatch('ai:capture')) },
          { label: '截图问答', click: () => checkLockAndShow(() => require('./float/actions.cjs').dispatch('ai:screenshot')) },
          { label: '命令面板', click: () => checkLockAndShow(() => require('./float/actions.cjs').dispatch('ai:palette')) },
        ],
      },
      { type: 'separator' },
      {
        label: '主窗口',
        click: () => checkLockAndShow(() => showMainAndNavigate())
      },
      {
        label: '记事本',
        click: () => checkLockAndShow(() => showMainAndNavigate('/tools/notes'))
      },
      {
        label: '备忘录',
        click: () => checkLockAndShow(() => showMainAndNavigate('/tools/memo'))
      },
      {
        label: '定时提醒',
        click: () => checkLockAndShow(() => showMainAndNavigate('/tools/reminder'))
      },
      ...buildAppearanceMenu(settings),
      { type: 'separator' },
      {
        label: '关闭',
        click: () => {
          checkLockAndShow(() => {
            const settings = loadSettings();
            settings.isFloatWindowEnabled = 0;
            saveSettings(settings);
            if (floatWindow) { floatWindow.close(); floatWindow = null; }
            const mainWindow = require('./mainWindow.cjs').getMainWindow();
            mainWindow?.webContents.send('setting-changed', { name: 'isFloatWindowEnabled', value: 0 });
            require('./tray.cjs').refreshTrayMenu();
          });
        }
      }
    ]);
    menu.popup({ window: floatWindow });
  });

  ipcMain.on('float-expanded', (_event, expanded) => {
    isExpanded = expanded;
    // 展开/收起都会改变是否需要接收鼠标事件（收起时若光标在球外应立即恢复穿透）
    applyMousePassthrough();
  });

  ipcMain.handle('toggle-float-window', () => { return toggleFloatWindow(); });

  ipcMain.on('float-config-changed', () => {
    if (floatWindow) {
      floatWindow.webContents.send('float-config-changed', loadFloatConfig());
    }
  });

  ipcMain.handle('float-get-appearance', () => ({
    name: normalizeAppearance(loadSettings().floatBallAppearance || '')
  }));

  ipcMain.handle('float-get-theme', () => ({ isDark: nativeTheme.shouldUseDarkColors }));
};

module.exports = {
  createFloatWindow,
  toggleFloatWindow,
  registerFloatIpcHandlers,
  getFloatWindow: () => floatWindow,
};
