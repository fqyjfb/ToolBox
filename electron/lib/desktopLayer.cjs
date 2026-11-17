// 桌面层挂载：把窗口变成 Windows 桌面宿主（WorkerW / Progman）的子窗口。
// 目的：Win+D 显示桌面时窗口仍在，且始终位于所有应用窗口之下，不遮挡任何应用。
// 失败 fail-soft：返回 false，调用方回退到原有 alwaysOnTop 行为。
// 约定与 ntProcessController.cjs 一致：koffi 惰性初始化、类型名加 TBox 前缀（进程级注册表冲突）。
const GW_HWNDNEXT = 2;
const WM_SPAWN_WORKER = 0x052C;
const SMTO_NORMAL = 0;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const HWND_TOP = 0;
const GWL_STYLE = -16;
const WS_CHILD = 0x40000000;
const GWL_EXSTYLE = -20;
const WS_EX_TRANSPARENT = 0x0020;

let api;

const buildApi = () => {
  if (process.platform !== 'win32') return null;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');

    const RECT = koffi.struct('TBoxStickyRect', {
      left: 'int32', top: 'int32', right: 'int32', bottom: 'int32',
    });

    return {
      findWindow: user32.func('uintptr __stdcall FindWindowW(str16 lpClassName, str16 lpWindowName)'),
      findWindowEx: user32.func('uintptr __stdcall FindWindowExW(uintptr hWndParent, uintptr hWndChildAfter, str16 lpszClass, str16 lpszWindow)'),
      getTopWindow: user32.func('uintptr __stdcall GetTopWindow(uintptr hWnd)'),
      getWindow: user32.func('uintptr __stdcall GetWindow(uintptr hWnd, uint32 uCmd)'),
      sendMessageTimeout: user32.func('intptr __stdcall SendMessageTimeoutW(uintptr hWnd, uint32 Msg, uintptr wParam, intptr lParam, uint32 fuFlags, uint32 uTimeout, _Out_ uintptr *lpdwResult)'),
      getWindowLong: user32.func('intptr __stdcall GetWindowLongPtrW(uintptr hWnd, int nIndex)'),
      setWindowLong: user32.func('intptr __stdcall SetWindowLongPtrW(uintptr hWnd, int nIndex, intptr dwNewLong)'),
      setParent: user32.func('uintptr __stdcall SetParent(uintptr hWndChild, uintptr hWndNewParent)'),
      getParent: user32.func('uintptr __stdcall GetParent(uintptr hWnd)'),
      setWindowPos: user32.func('int __stdcall SetWindowPos(uintptr hWnd, uintptr hWndInsertAfter, int X, int Y, int cx, int cy, uint32 uFlags)'),
      getWindowRect: user32.func('int __stdcall GetWindowRect(uintptr hWnd, _Out_ TBoxStickyRect *rect)'),
    };
  } catch (error) {
    console.error('[DesktopLayer] koffi 初始化失败，桌面层挂载降级:', error.message);
    return null;
  }
};

const getApi = () => {
  if (api === undefined) api = buildApi();
  return api;
};

/** Electron BrowserWindow → HWND（HWND 实际值远小于 2^53，Number 不丢精度） */
const toHwnd = (win) => {
  const buf = win.getNativeWindowHandle();
  return process.arch === 'x64' || process.arch === 'arm64'
    ? Number(buf.readBigUInt64LE(0))
    : Number(buf.readUInt32LE(0));
};

/**
 * 定位桌面宿主窗口。
 * Win10+ 需要先向 Progman 发 0x052C，让资源管理器在壁纸层创建 WorkerW；
 * 然后找带 SHELLDLL_DefView（桌面图标）的那个顶层窗口作为宿主。
 */
const findDesktopHost = (a) => {
  const progman = a.findWindow('Progman', null);
  if (!progman) return null;

  // 确保壁纸层 WorkerW 存在；消息失败不影响已存在的 WorkerW
  try {
    a.sendMessageTimeout(progman, WM_SPAWN_WORKER, 0, 0, SMTO_NORMAL, 1000, null);
  } catch (error) {
    console.error('[DesktopLayer] 唤起 WorkerW 失败:', error.message);
  }

  let host = 0;
  let cursor = a.getTopWindow(0);
  while (cursor) {
    if (a.findWindowEx(cursor, 0, 'SHELLDLL_DefView', null)) {
      host = a.findWindowEx(cursor, 0, 'WorkerW', null) || cursor;
      break;
    }
    cursor = a.getWindow(cursor, GW_HWNDNEXT);
  }

  return { progman, host: host || progman };
};

/** 解挂到普通顶层窗口。子窗口坐标是相对宿主的，setParent 后必须按屏幕坐标重新定位。 */
const detachImpl = (a, win) => {
  const hwnd = toHwnd(win);
  const style = Number(a.getWindowLong(hwnd, GWL_STYLE)) >>> 0;
  if (style & WS_CHILD) {
    a.setWindowLong(hwnd, GWL_STYLE, (style & ~WS_CHILD) >>> 0);
  }
  a.setParent(hwnd, 0);
  const bounds = win.getBounds();
  // 不带 HWND_TOP：解挂不该把窗口瞬间提到所有窗口之上，层级由调用方决定
  a.setWindowPos(hwnd, 0, bounds.x, bounds.y, bounds.width, bounds.height, SWP_NOZORDER | SWP_NOACTIVATE);
};

const attachImpl = (a, win) => {
  const target = findDesktopHost(a);
  if (!target) return false;

  const hwnd = toHwnd(win);
  const style = Number(a.getWindowLong(hwnd, GWL_STYLE)) >>> 0;
  // 已挂在同一宿主时只重设位置，避免重复 SetParent 造成可见闪烁
  const alreadyChild = (style & WS_CHILD) !== 0 && Number(a.getParent(hwnd)) === Number(target.host);

  if (!alreadyChild) {
    // 必须带 WS_CHILD：只 SetParent 会退化成 owner 关系，窗口仍可能浮在应用之上
    a.setWindowLong(hwnd, GWL_STYLE, (style | WS_CHILD) >>> 0);
    a.setParent(hwnd, target.host);
    // SetParent 成功且原父窗口为 NULL 时返回值也是 NULL，不能靠返回值判断；
    // 用 GetParent 回读实际父窗口，失败则还原样式避免半挂载状态
    if (Number(a.getParent(hwnd)) !== Number(target.host)) {
      a.setWindowLong(hwnd, GWL_STYLE, style);
      return false;
    }
  }

  // 子窗口坐标相对宿主：屏幕坐标 - 宿主屏幕原点（多屏/副屏都适用）
  const hostRect = { left: 0, top: 0, right: 0, bottom: 0 };
  a.getWindowRect(target.host, hostRect);
  const bounds = win.getBounds();
  a.setWindowPos(
    hwnd,
    HWND_TOP, // 同层内放在桌面图标之上、所有应用窗口之下
    bounds.x - hostRect.left,
    bounds.y - hostRect.top,
    bounds.width,
    bounds.height,
    SWP_NOACTIVATE,
  );
  return true;
};

/** 挂到桌面层（幂等）。成功后关闭 alwaysOnTop，否则会破坏子窗口层级。 */
const attach = (win) => {
  const a = getApi();
  if (!a || !win || win.isDestroyed()) return false;
  try {
    const ok = attachImpl(a, win);
    if (ok) win.setAlwaysOnTop(false);
    return ok;
  } catch (error) {
    console.error('[DesktopLayer] 桌面层挂载失败:', error.message);
    return false;
  }
};

/** 解挂：编辑需要键盘焦点时必须先恢复成普通顶层窗口（WS_CHILD 子窗口无法被激活） */
const detach = (win) => {
  const a = getApi();
  if (!a || !win || win.isDestroyed()) return false;
  try {
    detachImpl(a, win);
    return true;
  } catch (error) {
    console.error('[DesktopLayer] 桌面层解挂失败:', error.message);
    return false;
  }
};

/**
 * 切换鼠标穿透：只增删 WS_EX_TRANSPARENT，保留 WS_EX_LAYERED。
 * Electron 的 setIgnoreMouseEvents(false) 会同时清掉 WS_EX_LAYERED，而桌面层窗口是
 * WS_CHILD 子窗口，失去 LAYERED 后不再逐像素透明，会变成不透明整屏盖住桌面图标。
 * 返回 false 表示 koffi 不可用，调用方需回退到 setIgnoreMouseEvents。
 */
const setClickThrough = (win, value) => {
  const a = getApi();
  if (!a || !win || win.isDestroyed()) return false;
  try {
    const hwnd = toHwnd(win);
    const style = Number(a.getWindowLong(hwnd, GWL_EXSTYLE)) >>> 0;
    const next = (value ? style | WS_EX_TRANSPARENT : style & ~WS_EX_TRANSPARENT) >>> 0;
    if (next !== style) {
      a.setWindowLong(hwnd, GWL_EXSTYLE, next);
    }
    return true;
  } catch (error) {
    console.error('[DesktopLayer] 切换鼠标穿透失败:', error.message);
    return false;
  }
};

module.exports = { attach, detach, setClickThrough };
