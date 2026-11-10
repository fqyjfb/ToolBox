const { BrowserWindow, Menu, screen, ipcMain, app, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadSettings, saveSettings, loadFloatConfig } = require('../lib/config.cjs');

let floatWindow = null;
let dragOffset = { x: 0, y: 0 };
let pollIgnoring = true;
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

  floatWindow.setIgnoreMouseEvents(false);

  // 命中判定只依赖光标是否落在悬浮球矩形内，250ms 仍远快于人手移动，
  // 相比 150ms 可减少约 40% 的主进程唤醒，hover 展开/移出收起的手感不变。
  const POLL_INTERVAL = 250;
  const pollTimer = setInterval(() => {
    if (!floatWindow || floatWindow.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();

    const bounds = floatWindow.getBounds();
    const ballCenterX = bounds.x + Math.round(bounds.width / 2);
    const ballCenterY = bounds.y + Math.round(bounds.height / 2);
    const dx = Math.abs(cursor.x - ballCenterX);
    const dy = Math.abs(cursor.y - ballCenterY);
    const inBall = dx <= PET_SIZE.width / 2 + 4 && dy <= PET_SIZE.height / 2 + 4;
    if (inBall || isDragOver) {
      if (pollIgnoring) {
        pollIgnoring = false;
        floatWindow.setIgnoreMouseEvents(false);
      }
    } else if (!isExpanded && !isDragging && !hasInteractiveCard) {
      // 球外、非展开态、非拖拽态、无可交互卡片 → 穿透
      // hasInteractiveCard 时气泡带按钮，光标可能移到球外的按钮上，不能穿透
      if (!pollIgnoring) {
        pollIgnoring = true;
        floatWindow.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }, POLL_INTERVAL);
  // 与 mainWindow 中其它定时器保持一致：定时器不阻止主进程退出
  if (pollTimer && typeof pollTimer.unref === 'function') pollTimer.unref();

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
    clearInterval(pollTimer);
    floatWindow = null;
    // 窗口关闭时清掉拖拽态，避免下次打开时鼠标穿透判定被误跳过
    isDragging = false;
    isExpanded = false;
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
  });

  ipcMain.handle('float:gestures-enabled', () => loadSettings().floatGesturesEnabled === 1);

  // P2-3：文件拖入悬停期间强制窗口接收鼠标事件，否则穿透轮询会吞掉 drop
  ipcMain.on('float:drag-over', (_event, active) => {
    isDragOver = Boolean(active);
    if (!floatWindow || floatWindow.isDestroyed()) return;
    if (isDragOver) {
      pollIgnoring = false;
      floatWindow.setIgnoreMouseEvents(false);
    }
  });

  // P2-5：气泡带按钮时 renderer 通知主进程 — 保持窗口可点击直到卡片过期
  ipcMain.on('float:interactive-card', (_event, active) => {
    hasInteractiveCard = Boolean(active);
    if (!floatWindow || floatWindow.isDestroyed()) return;
    if (hasInteractiveCard && pollIgnoring) {
      pollIgnoring = false;
      floatWindow.setIgnoreMouseEvents(false);
    }
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
    if (expanded && floatWindow) {
      floatWindow.setIgnoreMouseEvents(false);
    }
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
