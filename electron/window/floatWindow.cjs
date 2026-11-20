const { BrowserWindow, Menu, screen, ipcMain, app, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadSettings, saveSettings, loadFloatConfig } = require('../lib/config.cjs');
const PetCatalog = require('./float/pet-catalog.cjs');

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
// 清单、槽位、预设与几何全部来自 float/pet-catalog.cjs，此处不再维护第二份形象列表
// 桌宠形象尺寸，与 float/float.css 的 --pet-w/--pet-h 保持同一来源
const PET_SIZE = { width: PetCatalog.geometry.width, height: PetCatalog.geometry.height };
// 球体命中容差，与渲染层 float.cjs 的 BALL_HIT_PADDING 一致
const PET_HIT_PADDING = PetCatalog.geometry.hitPadding;
// 看门狗周期：渲染层 mousemove 中断时（光标快速移出、未触发 mouseleave）用系统光标复核
const HOVER_WATCHDOG_MS = 800;

// 悬浮球窗口视口：窗口矩形 + 所在显示器的工作区/物理边界，供渲染层夹取提示层
const getFloatViewport = () => {
  if (!floatWindow || floatWindow.isDestroyed()) return null;
  const bounds = floatWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  return {
    bounds,
    workArea: display.workArea,          // 提示优先落在此区域（避开任务栏）
    displayBounds: display.bounds,       // 硬裁剪边界（窗口压任务栏时兜底）
    scaleFactor: display.scaleFactor,
  };
};

// 视口只在低频时机推送：页面就绪、拖拽结束、展开、显示器变化
const pushFloatViewport = () => {
  if (!floatWindow || floatWindow.isDestroyed()) return;
  const viewport = getFloatViewport();
  if (viewport) floatWindow.webContents.send('float:viewport-changed', viewport);
};

// 松手时把球心夹回显示器物理边界：允许压任务栏，避免球体大半停在屏幕外
const clampBallCenterToDisplay = (bounds, display) => {
  const half = WINDOW_SIZE / 2;
  const area = display.bounds;
  const center = { x: bounds.x + half, y: bounds.y + half };
  return {
    x: Math.round(Math.min(Math.max(center.x, area.x), area.x + area.width) - half),
    y: Math.round(Math.min(Math.max(center.y, area.y), area.y + area.height) - half),
  };
};

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
    // 以球心（窗口中心）是否落在显示器内为准：窗口本身允许有一半在屏幕外
    const half = WINDOW_SIZE / 2;
    const centerX = savedPos.x + half;
    const centerY = savedPos.y + half;
    const area = targetDisplay.bounds;
    const inBounds =
      centerX >= area.x &&
      centerX <= area.x + area.width &&
      centerY >= area.y &&
      centerY <= area.y + area.height;
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
    // 页面已就绪，先把视口推给渲染层，提示层首帧即可正确夹取
    pushFloatViewport();
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

// ── 换装：预设与槽位菜单均由清单生成，选中后落盘并同步给悬浮窗 ──
const outfitSnapshot = () => PetCatalog.normalizeOutfit(loadSettings().floatBallOutfit);

const sendOutfit = (outfit, phrase) => {
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.webContents.send('outfit-changed', { outfit, phrase });
  }
};

const applyOutfitPatch = (patch, phrase) => {
  const next = PetCatalog.normalizeOutfit({ ...outfitSnapshot(), ...patch });
  const settings = loadSettings();
  settings.floatBallOutfit = next;
  saveSettings(settings);
  sendOutfit(next, phrase);
};

// 结构：换装 → 整套 / 头部 / 颈部 / 躯干 / 尾部，每槽 radio 互斥，槽间可叠加
const buildOutfitMenu = () => {
  const current = outfitSnapshot();
  const presets = PetCatalog.presets.map((preset) => ({
    label: preset.label,
    type: 'radio',
    checked: PetCatalog.isSameOutfit(current, preset.outfit),
    click: () => applyOutfitPatch(preset.outfit, preset.phrase)
  }));
  const slots = PetCatalog.slots.map((slot) => ({
    label: slot.label,
    submenu: PetCatalog.itemsForSlot(slot.id).map((item) => ({
      label: item.label,
      type: 'radio',
      checked: current[slot.id] === item.id,
      click: () => applyOutfitPatch({ [slot.id]: item.id }, item.phrase)
    }))
  }));
  return [{
    label: '换装',
    submenu: [
      { label: '整套', submenu: presets },
      { type: 'separator' },
      ...slots
    ]
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
    const settings = loadSettings();
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    // 松手时球心夹回显示器内（允许压任务栏），再反推窗口坐标保存
    const position = clampBallCenterToDisplay(floatWindow.getBounds(), display);
    floatWindow.setPosition(position.x, position.y);
    // 记录所在显示器：副屏拔掉后启动时可回落到主屏，不会把窗口留在屏幕外
    settings.floatBallPosition = { x: position.x, y: position.y, displayId: display.id };
    saveSettings(settings);
    applyMousePassthrough();
    // 位置/显示器可能已变化，刷新渲染层缓存的视口
    pushFloatViewport();
  });

  ipcMain.handle('float:gestures-enabled', () => loadSettings().floatGesturesEnabled === 1);

  // 视口查询：渲染层初始化时主动取一次（推送可能早于脚本订阅）
  ipcMain.handle('float:get-viewport', () => getFloatViewport());

  // 显示器变化（分辨率/缩放/任务栏/副屏热插拔）：刷新渲染层缓存的视口
  screen.on('display-metrics-changed', pushFloatViewport);
  screen.on('display-added', pushFloatViewport);
  screen.on('display-removed', pushFloatViewport);

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
        label: '打开',
        submenu: [
          {
            label: '记事本',
            click: () => checkLockAndShow(() => showMainAndNavigate('/tools/notes'))
          },
          {
            label: '备忘录',
            click: () => checkLockAndShow(() => showMainAndNavigate('/tools/memo'))
          },
          {
            label: '便签',
            click: () => checkLockAndShow(() => showMainAndNavigate('/tools/sticky-note'))
          },
          {
            label: '定时提醒',
            click: () => checkLockAndShow(() => showMainAndNavigate('/tools/reminder'))
          },
        ],
      },
      ...buildOutfitMenu(),
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
    // 展开前保证渲染层持有最新的可视边界
    if (expanded) pushFloatViewport();
  });

  ipcMain.handle('toggle-float-window', () => { return toggleFloatWindow(); });

  ipcMain.on('float-config-changed', () => {
    if (floatWindow) {
      floatWindow.webContents.send('float-config-changed', loadFloatConfig());
    }
  });

  ipcMain.handle('float-get-outfit', () => ({ outfit: outfitSnapshot() }));

  ipcMain.handle('float-get-theme', () => ({ isDark: nativeTheme.shouldUseDarkColors }));
};

const destroyForLockSleep = (expectedWindow) => {
  if (!floatWindow || floatWindow.isDestroyed() || floatWindow !== expectedWindow) return;
  try {
    floatWindow.destroy();
  } catch (error) {
    console.error('[Float] 锁屏休眠销毁悬浮球失败:', error.message);
  }
};

module.exports = {
  createFloatWindow,
  toggleFloatWindow,
  registerFloatIpcHandlers,
  getFloatWindow: () => floatWindow,
  destroyForLockSleep,
};
