/**
 * 悬浮球动作注册表与分发。
 *
 * 背景：原先 floatWindow.cjs 里用 if/else + actions 对象分发动作，新增动作就要往里加分支，
 * 且 tool 类型只能靠渲染层拼成 nav: 绕过去（缺 path 时点了没反应）。
 * 这里改成「前缀 → 处理器」的注册表，渲染层只发 `prefix:payload`，主进程统一解析。
 *
 * 约定：payload 中不含冒号时（如 `nav:home`），整段作为 payload；
 * 需要带冒号的目标（如 Windows 盘符路径）用 `open-app:C:\a.exe` 这种独立前缀表达。
 */
const { shell, dialog, app, clipboard } = require('electron');
const { exec } = require('child_process');

const handlers = new Map();

const sendCard = (text, actions = [], ttl = 5000) => {
  const win = require('../floatWindow.cjs').getFloatWindow();
  if (win && !win.isDestroyed()) win.webContents.send('float-pet-card', { text, actions, ttl });
};

const register = (prefix, handler) => {
  if (typeof prefix !== 'string' || typeof handler !== 'function') return;
  handlers.set(prefix, handler);
};

const NAV_ROUTES = {
  home: '/',
  tools: '/tools',
  quick: '/launch',
  bookmark: '/nav',
  todo: '/tools/todo',
  news: '/news',
  settings: '/settings',
};

const showMainAndNavigate = (route) => {
  const mainWindowModule = require('../mainWindow.cjs');
  const mainWindow = mainWindowModule.getMainWindow();
  if (!mainWindow) return;
  mainWindowModule.showMainWindow();
  if (route) mainWindow.webContents.send('navigate-to', route);
};

const systemActions = {
  'clear-recycle-bin': () => {
    exec('powershell -Command "Clear-RecycleBin -Force; exit 0"', (error) => {
      if (!error) dialog.showMessageBox({ type: 'info', title: '提示', message: '回收站已清空' });
    });
  },
  'open-my-computer': () => { shell.openExternal('shell:MyComputerFolder').catch(() => {}); },
  shutdown: () => { exec('shutdown /s /t 0'); },
  restart: () => { exec('shutdown /r /t 0'); },
  'restart-app': () => { app.relaunch(); app.quit(); },
};

// ── 导航 ──
register('nav', (payload) => {
  if (!payload) return;
  const route = NAV_ROUTES[payload] || (payload.startsWith('/') ? payload : '');
  if (route) showMainAndNavigate(route);
});

// ── 工具：payload 为工具路由（/tools/xxx），缺路由时退回工具中心 ──
register('tool', (payload) => {
  const route = payload && payload.startsWith('/') ? payload : '/tools';
  showMainAndNavigate(route);
});

// ── 应用 ──
register('app', (payload) => {
  if (payload) shell.openPath(payload).catch(() => {});
});
// 旧版渲染层用 open-app: 前缀，保留别名避免旧配置失效
register('open-app', (payload) => {
  if (payload) shell.openPath(payload).catch(() => {});
});

// ── 插件 ──
register('plugin', (payload) => {
  if (!payload) return;
  require('../../ipc/pluginIpc.cjs').openPluginWindow(payload);
});

// ── 系统 ──
register('system', (payload) => {
  const fn = systemActions[payload];
  if (typeof fn === 'function') fn();
});

// ── AI 面板 ──
register('ai', (payload) => {
  const { openPanel } = require('../floatPanelWindow.cjs');
  const { loadSettings } = require('../../lib/config.cjs');
  const panelModes = { capture: 'capture', palette: 'palette', shelf: 'shelf' };
  if (panelModes[payload]) {
    const settingName = { capture: 'floatCaptureEnabled', palette: 'floatPaletteEnabled', shelf: 'floatShelfEnabled' }[payload];
    if (loadSettings()[settingName] === 0) {
      sendCard('这个功能还没开启，去「设置 → 悬浮窗设置」打开它吧');
      return;
    }
    openPanel({ mode: panelModes[payload] });
    return;
  }
  if (payload === 'screenshot') {
    if (loadSettings().floatScreenshotQAEnabled === 0) {
      sendCard('截图问答默认关闭，去「设置 → 悬浮窗设置」开启后再试');
      return;
    }
    require('../../ipc/screenshotIpc.cjs').requestFloatScreenshot().catch((error) => {
      sendCard(`截图启动失败：${error && error.message ? error.message : '未知错误'}`);
    });
    return;
  }
  if (payload === 'selection') {
    const { readSelectedText } = require('../../services/selectionReader.cjs');
    Promise.resolve()
      .then(() => readSelectedText())
      .then((result) => {
        const text = (result && result.text ? result.text : '').trim();
        if (!text) {
          const { getFloatWindow } = require('../floatWindow.cjs');
          getFloatWindow()?.webContents.send('float-pet-card', {
            text: result && result.busy ? '上一个取词还没完成，稍等一下～' : '没读到选中的文字，先选中再按一次？',
            ttl: 4000,
          });
          return;
        }
        openPanel({ mode: 'selection', text });
      })
      .catch((error) => {
        console.error('[Float] 划词取词失败:', error);
      });
    return;
  }
  openPanel({ mode: 'chat' });
});

// ── 剪贴板卡片动作：拿服务里最近一次文本，复用划词模式与笔记写入 ──
register('clipboard', (payload) => {
  const service = require('../../services/floatFeatureService.cjs');
  let text = service.getLastClipboardText();
  // 窗口失焦 / 卡片被延迟点击时 lastClipboardText 可能被后续复制覆盖，兜底从系统剪贴板再读一次
  if (!text) text = clipboard.readText();
  text = String(text || '').trim();
  if (!text) return;
  if (payload === 'translate' || payload === 'summarize') {
    require('../floatPanelWindow.cjs').openPanel({ mode: 'selection', text, preset: payload });
    return;
  }
  if (payload === 'note') {
    const result = service.captureCommit({ kind: 'note', title: '' }, text);
    if (!result.ok) sendCard(result.error);
  }
});

// ── 店铺场景卡片动作 ──
register('shop', (payload) => {
  const service = require('../../services/floatFeatureService.cjs');
  const parts = String(payload || '').split(':');
  const [kind, first, ...rest] = parts;
  if (kind === 'reply') {
    const reply = service.getLastReplies()[Number(first)];
    if (reply) {
      clipboard.writeText(reply);
      sendCard('话术已复制，直接粘贴给买家吧');
    }
    return;
  }
  if (kind === 'copy-order') {
    const order = service.getLastClipboardText().match(/[A-Za-z0-9-]{8,24}/g)?.find(Boolean);
    if (order) {
      clipboard.writeText(order);
      sendCard('单号已复制');
    }
    return;
  }
  if (kind === 'track') {
    const order = rest.join(':') || first;
    clipboard.writeText(order);
    showMainAndNavigate('/nav');
    sendCard(`已复制${first}单号 ${order}，可在导航页查询`);
  }
});

/**
 * 分发一个动作字符串。
 * @param {string} action 形如 nav:home / tool:/tools/notes / ai:chat / shutdown
 * @param {{ guard?: (run: () => void) => boolean }} [ctx] 锁定态守卫，返回 false 表示已拦截
 */
const dispatch = (action, ctx = {}) => {
  if (typeof action !== 'string' || !action) return;
  if (action === 'toggle-lock') {
    require('../lockWindow.cjs').toggleLock();
    return;
  }

  const colonIndex = action.indexOf(':');
  const prefix = colonIndex > 0 ? action.slice(0, colonIndex) : action;
  const payload = colonIndex > 0 ? action.slice(colonIndex + 1) : '';

  // 裸动作（旧配置里的 home/tools/shutdown 等）：先查系统动作，再查导航
  if (colonIndex < 0) {
    if (typeof systemActions[action] === 'function') {
      const run = () => systemActions[action]();
      return ctx.guard ? ctx.guard(run) : run();
    }
    const route = NAV_ROUTES[action];
    if (route) {
      const run = () => showMainAndNavigate(route);
      return ctx.guard ? ctx.guard(run) : run();
    }
    console.warn('[Float] 未知动作:', action);
    return;
  }

  const handler = handlers.get(prefix);
  if (!handler) {
    console.warn('[Float] 未注册的动作前缀:', prefix, action);
    return;
  }
  const run = () => handler(payload);
  return ctx.guard ? ctx.guard(run) : run();
};

module.exports = { register, dispatch };
