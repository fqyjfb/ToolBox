/**
 * 悬浮球 AI 面板窗口。
 *
 * 300×300 的球窗口装不下输入框与流式回答，因此面板是独立窗口：
 * 球窗口只负责桌宠与菜单，面板负责对话/划词结果，两者通过 IPC 协作。
 */
const { BrowserWindow, ipcMain, screen, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { isDarkTheme, loadThemeSnapshot } = require('../lib/config.cjs');

const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 480;
const PANEL_GAP = 12;
const HIDE_DELAY_MS = 300;
// 存为待办需等主窗口渲染层回执，超时即视为失败，避免面板长期挂起
const TODO_SAVE_TIMEOUT_MS = 10000;

let panelWindow = null;
let hideTimer = null;
let ipcRegistered = false;
let quitting = false;
// 在途的待办保存：requestId -> { resolve, timer }
const pendingTodoSaves = new Map();
// 文件拖出（webContents.startDrag）进行中：期间跳过失焦自动隐藏
let dragOutActive = false;

// 面板当前会话：由 openPanel 写入，panel-init 读取（避免额外的推送竞态）
// text/image/error/preset 为可选的会话载荷；image 只在内存中传递，不落盘
let session = { mode: 'chat', text: '', image: '', error: '', preset: '' };

app.on('before-quit', () => {
  quitting = true;
  if (hideTimer) clearTimeout(hideTimer);
  if (panelWindow && !panelWindow.isDestroyed()) panelWindow.destroy();
  panelWindow = null;
});

/**
 * 面板主题与锁屏窗口同一口径：明暗基色 + 自定义配色快照。
 * 面板读不到渲染层 localStorage，颜色只能由主进程从 theme.json 取。
 */
const getPanelTheme = () => ({
  isDark: isDarkTheme(),
  colors: loadThemeSnapshot(),
});

// 窗口底色：跟随自定义主题主背景，未配置时用当前明暗基色，避免打开瞬间闪白
const getPanelBackgroundColor = () => {
  const theme = getPanelTheme();
  return (theme.colors && theme.colors.colorBgPrimary) || (theme.isDark ? '#16181D' : '#FFFFFF');
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// 面板优先展开在球体右侧，越界翻到左侧；纵向以球心对齐后夹取到工作区内
const computePanelPosition = () => {
  const { getFloatWindow } = require('./floatWindow.cjs');
  const floatWindow = getFloatWindow();
  const cursor = screen.getCursorScreenPoint();
  const anchorBounds = floatWindow && !floatWindow.isDestroyed() ? floatWindow.getBounds() : null;
  const anchorPoint = anchorBounds
    ? { x: anchorBounds.x + Math.round(anchorBounds.width / 2), y: anchorBounds.y + Math.round(anchorBounds.height / 2) }
    : cursor;
  const workArea = screen.getDisplayNearestPoint(anchorPoint).workArea;

  let x;
  if (anchorBounds) {
    x = anchorPoint.x + PANEL_GAP;
    if (x + PANEL_WIDTH > workArea.x + workArea.width) {
      x = anchorPoint.x - PANEL_GAP - PANEL_WIDTH;
    }
  } else {
    x = workArea.x + Math.round((workArea.width - PANEL_WIDTH) / 2);
  }

  const centeredY = anchorBounds
    ? anchorPoint.y - Math.round(PANEL_HEIGHT / 2)
    : workArea.y + Math.round((workArea.height - PANEL_HEIGHT) / 2);

  return {
    x: clamp(x, workArea.x, workArea.x + workArea.width - PANEL_WIDTH),
    y: clamp(centeredY, workArea.y, workArea.y + workArea.height - PANEL_HEIGHT),
  };
};

const createPanelWindow = () => {
  panelWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    frame: false,
    transparent: false,
    backgroundColor: getPanelBackgroundColor(),
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, './float/panel-preload.cjs'),
    },
  });

  // 透明窗口在 Windows 上会导致字体发虚，面板用不透明背景 + CSS 圆角
  panelWindow.setMenuBarVisibility(false);

  const panelHtmlPath = path.join(__dirname, './float/panel.html');
  const packagedPath = path.join(process.resourcesPath, 'app', 'electron', 'window', 'float', 'panel.html');
  if (app.isPackaged && fs.existsSync(packagedPath)) {
    panelWindow.loadFile(packagedPath);
  } else {
    panelWindow.loadFile(panelHtmlPath);
  }

  panelWindow.on('blur', () => {
    if (quitting) return;
    if (dragOutActive) return;                 // 文件拖出期间不自动隐藏，避免源窗口被拆导致崩溃
    if (panelWindow && panelWindow.webContents.isDevToolsFocused()) return;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => hidePanel(), HIDE_DELAY_MS);
  });

  panelWindow.on('focus', () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });

  // Windows 无边框 + resizable:false 的窗口反复 hide/show 时，系统会逐次削掉
  // 不可见边框，导致窗口越开越小。这里在每次显示后把尺寸校准回固定值。
  panelWindow.on('show', () => {
    const [width, height] = panelWindow.getSize();
    if (width !== PANEL_WIDTH || height !== PANEL_HEIGHT) {
      panelWindow.setSize(PANEL_WIDTH, PANEL_HEIGHT);
    }
  });

  panelWindow.on('closed', () => {
    panelWindow = null;
    // 面板销毁时中断所有进行中的流式请求，避免主进程继续往已关闭的 webContents 推送
    try {
      require('../services/floatAssistantService.cjs').cancelAll();
    } catch { /* service 未加载时忽略 */ }
  });
};

const openPanel = ({ mode = 'chat', text = '', image = '', error = '', preset = '' } = {}) => {
  session = { mode, text, image, error, preset };
  if (!panelWindow || panelWindow.isDestroyed()) {
    createPanelWindow();
  }
  const { x, y } = computePanelPosition();
  // 显式带上宽高：只调 setPosition 时，隐藏/显示造成的尺寸漂移会被保留下来
  panelWindow.setBounds({ x, y, width: PANEL_WIDTH, height: PANEL_HEIGHT });
  panelWindow.show();
  panelWindow.focus();
  // 已加载完成时主动通知一次，让面板切换到新的会话/模式
  if (!panelWindow.webContents.isLoading()) {
    panelWindow.webContents.send('float:panel-session', { ...session, theme: getPanelTheme() });
    // 面板隐藏期间设置页可能改过模型，每次打开都对齐一次状态
    notifyPanelAIStatus();
  }
  return true;
};

const hidePanel = () => {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (panelWindow && !panelWindow.isDestroyed() && panelWindow.isVisible()) {
    panelWindow.hide();
  }
};

const getPanelWindow = () => panelWindow;

/** 只允许面板窗口访问面板通道，避免主窗口或插件页伪造调用 */
const isPanelSender = (event) => {
  if (!event || !event.sender) return false;
  return panelWindow && !panelWindow.isDestroyed() && event.sender.id === panelWindow.webContents.id;
};

const registerFloatPanelIpc = () => {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('float:panel-init', async (event) => {
    if (!isPanelSender(event)) return { ok: false };
    const { getStatus, ensureAIConfigSnapshot } = require('../services/floatAssistantService.cjs');
    // 快照可能缺失（历史配置/推送失败），先从主窗口取一次真实配置再判断
    await ensureAIConfigSnapshot();
    return { ok: true, ...session, theme: getPanelTheme(), status: getStatus() };
  });

  ipcMain.handle('float:panel-close', (event) => {
    if (!isPanelSender(event)) return { ok: false };
    hidePanel();
    return { ok: true };
  });

  // 同步取主题：面板首帧之前就要知道明暗，否则深色模式下会闪一下白底
  ipcMain.on('float:panel-theme-sync', (event) => {
    event.returnValue = isPanelSender(event) ? getPanelTheme() : null;
  });

  ipcMain.handle('float:panel-open-settings', (event) => {
    if (!isPanelSender(event)) return { ok: false };
    const mainWindowModule = require('./mainWindow.cjs');
    const mainWindow = mainWindowModule.getMainWindow();
    if (!mainWindow) return { ok: false };
    mainWindowModule.showMainWindow();
    mainWindow.webContents.send('navigate-to', '/settings');
    hidePanel();
    return { ok: true };
  });

  // 面板内发起截图问答：关面板 → 走截图通道 → 截图完成后会自动开回面板 screenshot 模式
  ipcMain.handle('float:screenshot-request', async (event) => {
    if (!isPanelSender(event)) return { ok: false, error: '非法调用' };
    hidePanel();
    try {
      await require('../ipc/screenshotIpc.cjs').requestFloatScreenshot();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || '截图启动失败' };
    }
  });

  // 存为笔记：落盘逻辑抽到 notesService.saveOrganizedNote 共享（划词工具条转笔记同源复用），
  // 这里只保留面板 sender 守卫与返回值映射（面板据此提供「打开笔记」跳转）
  ipcMain.handle('float:save-note', (event, payload = {}) => {
    if (!isPanelSender(event)) return { ok: false, error: '非法调用' };
    const content = typeof payload.content === 'string' ? payload.content.trim() : '';
    if (!content) return { ok: false, error: '没有可保存的内容' };
    try {
      const result = require('../services/notesService.cjs').saveOrganizedNote(content, 'AI 对话');
      return result && result.success
        ? { ok: true, path: result.path }
        : { ok: false, error: (result && result.error) || '保存失败' };
    } catch (error) {
      return { ok: false, error: error?.message || '保存失败' };
    }
  });

  // 面板内保存成功后跳转：复用主窗口 + 既有 navigate-to，不在主进程解析笔记内容
  ipcMain.handle('float:open-note', (event, filePath) => {
    if (!isPanelSender(event)) return { ok: false, error: '非法调用' };
    const target = typeof filePath === 'string' ? filePath.trim() : '';
    if (!target) return { ok: false, error: '缺少笔记路径' };
    const mainWindowModule = require('./mainWindow.cjs');
    const mainWindow = mainWindowModule.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: '主窗口未就绪' };
    mainWindowModule.showMainWindow();
    mainWindow.webContents.send('navigate-to', '/tools/notes?file=' + encodeURIComponent(target));
    hidePanel();
    return { ok: true };
  });

  // 存为待办：交给主窗口渲染层复用 todoService（含登录用户 id 与离线/云同步逻辑），
  // 主进程不重复实现一份数据写入，避免字段与页面读取端不一致。
  // 以 requestId 挂起 Promise，等渲染层回执真实创建结果，避免面板出现「假乐观成功」。
  ipcMain.handle('float:save-todo', (event, payload = {}) => {
    if (!isPanelSender(event)) return { ok: false, error: '非法调用' };
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) return { ok: false, error: '没有可保存的内容' };
    const mainWindow = require('./mainWindow.cjs').getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: '主窗口未就绪' };

    const requestId = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingTodoSaves.delete(requestId);
        // 通知预加载丢弃尚未投递的队列项，避免登录后凭空多出一条待办
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('float-ai-save-todo-cancel', { requestId });
        }
        resolve({ ok: false, error: '保存超时：请确认已登录且主窗口就绪' });
      }, TODO_SAVE_TIMEOUT_MS);
      pendingTodoSaves.set(requestId, { resolve, timer });
      mainWindow.webContents.send('float-ai-save-todo', {
        requestId,
        title: title.slice(0, 200),
        description: typeof payload.content === 'string' ? payload.content.slice(0, 4000) : '',
      });
    });
  });

  // 待办创建回执：仅接受主窗口渲染层的结果，防止任意 webContents 伪造
  ipcMain.on('float-ai-save-todo-result', (event, payload = {}) => {
    const mainWindow = require('./mainWindow.cjs').getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id) return;
    const entry = pendingTodoSaves.get(payload.requestId);
    if (!entry) return;
    pendingTodoSaves.delete(payload.requestId);
    clearTimeout(entry.timer);
    entry.resolve(payload.success
      ? { ok: true, todo: payload.todo || null }
      : { ok: false, error: payload.error || '添加待办失败' });
  });

  // 主窗口划词工具条「问AI」：带文本打开小橘面板（chat 模式，输入框预填）。
  // 仅主窗口 sender 可调，对齐 float-ai-save-todo-result 的校验风格；
  // registerFloatPanelIpc 在启动期无条件注册（main.cjs app.whenReady），
  // 与悬浮球开关无关，面板按需 createPanelWindow()。
  ipcMain.handle('float-panel-open-chat', (event, payload = {}) => {
    const mainWindow = require('./mainWindow.cjs').getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id) {
      return { ok: false, error: '非法调用' };
    }
    const text = typeof payload.text === 'string' ? payload.text.slice(0, 4000) : '';
    openPanel({ mode: 'chat', text });
    return { ok: true };
  });

  // 待办保存成功后跳转：打开主窗口并定位到该条待办（由待办页 ?focus 消费）
  ipcMain.handle('float:open-todo', (event, todoId) => {
    if (!isPanelSender(event)) return { ok: false, error: '非法调用' };
    const mainWindowModule = require('./mainWindow.cjs');
    const mainWindow = mainWindowModule.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: '主窗口未就绪' };
    const id = typeof todoId === 'string' ? todoId.trim() : '';
    mainWindowModule.showMainWindow();
    mainWindow.webContents.send('navigate-to', '/tools/todo' + (id ? '?focus=' + encodeURIComponent(id) : ''));
    hidePanel();
    return { ok: true };
  });
};

/** 主题变化：同步窗口底色并让面板重新上色（不重建窗口，避免打断会话） */
const notifyPanelTheme = () => {
  if (!panelWindow || panelWindow.isDestroyed()) return;
  panelWindow.setBackgroundColor(getPanelBackgroundColor());
  panelWindow.webContents.send('float:panel-theme', getPanelTheme());
};

/** 设置页保存配置 / 每次打开面板时刷新状态：只推状态，不把含 api_key 的配置下发到页面 */
const notifyPanelAIStatus = () => {
  if (!panelWindow || panelWindow.isDestroyed()) return;
  const { getStatus, ensureAIConfigSnapshot } = require('../services/floatAssistantService.cjs');
  ensureAIConfigSnapshot().then(() => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send('float:panel-ai-status', getStatus());
    }
  });
};

/**
 * 文件拖出开始：取消失焦隐藏计时器，并在拖拽期间跳过 blur 自动隐藏。
 * startDrag 是同步阻塞的，拖拽收尾时若隐藏源窗口会拆掉拖拽上下文 → 崩溃。
 */
const beginDragOut = () => {
  dragOutActive = true;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
};

const endDragOut = () => {
  dragOutActive = false;
};

module.exports = {
  openPanel,
  hidePanel,
  getPanelWindow,
  isPanelSender,
  registerFloatPanelIpc,
  notifyPanelTheme,
  notifyPanelAIStatus,
  beginDragOut,
  endDragOut,
};
