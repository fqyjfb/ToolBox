/**
 * 划词取词：Windows 用 koffi 直接调 user32!SendInput（主进程内同步 / 零启动开销）。
 * macOS / Linux 沿用原方案。
 *
 * TTime 用 @jitsi/robotjs 实现同样效果——我们选 koffi 是因为它是纯 JS FFI，
 * 不需要 native 编译，Electron 打包时不会出 ABI 不兼容问题。
 *
 * 设计要点：
 * 1. SendInput 是 Windows XP+ 官方 API，在现代浏览器 / Office / 微信等应用上比 keybd_event 可靠；
 * 2. 发键前先等物理修饰键释放并统一抬起左右 Alt/Ctrl/Shift/Win——全局快捷键（Alt+E）拦截后
 *    键态常残留，残留的 Alt 会把 Ctrl+C 变成 Alt+Ctrl+C，目标应用不响应（表现为取词永远失败）；
 * 3. 发键前备份剪贴板（文本 / HTML / RTF / 图片），取词后按优先级还原；
 * 4. 轮询剪贴板时排除取词前的旧内容：部分剪贴板管理工具会立即恢复内容，
 *    若不排除会把旧剪贴板误判成"刚复制出来的选中文本"；
 * 5. 取词失败不再返回取词前的剪贴板内容（旧内容冒充选中文本会误导用户），由调用方提示重试；
 * 6. 模块级 isChoosing 防重入，且保护范围覆盖备份/还原，避免异常导致永久 busy。
 */
const { execFile } = require('child_process');
const { clipboard } = require('electron');
const { loadSettings } = require('../lib/config.cjs');

let isChoosing = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── SendInput 常量 ──────────────────────────────────────────────────────────
const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const VK_SHIFT = 0x10;
const VK_CTRL = 0x11;
const VK_MENU = 0x12;
const VK_C = 0x43;
const VK_LWIN = 0x5B;
const VK_RWIN = 0x5C;
const VK_LSHIFT = 0xA0;
const VK_RSHIFT = 0xA1;
const VK_LCONTROL = 0xA2;
const VK_RCONTROL = 0xA3;
const VK_LMENU = 0xA4;
const VK_RMENU = 0xA5;

// 注入前需要统一抬起的按键（对齐 TTime 的释放列表）：
// 全局快捷键回调触发时物理 Alt 往往还按着，不清理会让 Ctrl+C 变成组合键；
// Space/Tab/Escape 是 TTime 额外释放的键，用于清掉热键组合残留的按下状态。
const VK_SPACE = 0x20;
const VK_TAB = 0x09;
const VK_ESCAPE = 0x1B;
const RELEASE_VKS = [
  VK_LCONTROL, VK_RCONTROL, VK_LMENU, VK_RMENU, VK_LSHIFT, VK_RSHIFT,
  VK_LWIN, VK_RWIN, VK_SHIFT, VK_MENU, VK_SPACE, VK_TAB, VK_ESCAPE,
];

// 仅修饰键：用于判断「是否还需要等物理按键松开」（Space/Tab/Escape 不算）
const MODIFIER_VKS = [VK_LCONTROL, VK_RCONTROL, VK_LMENU, VK_RMENU, VK_LSHIFT, VK_RSHIFT, VK_LWIN, VK_RWIN];

// ── koffi 模块级初始化（仅 win32，仅一次） ───────────────────────────────────
// 类型名统一加 TBox 前缀：koffi 的类型注册表是进程级全局的，同名重复定义会抛
// "Duplicate type name"，且抛出后该名字永久不可用——放在模块级可确保永不重复注册。
const win32Api = (() => {
  if (process.platform !== 'win32') return null;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');

    const KEYBDINPUT = koffi.struct('TBoxKeybdInput', {
      wVk: 'uint16',
      wScan: 'uint16',
      dwFlags: 'uint32',
      time: 'uint32',
      dwExtraInfo: 'uintptr',
    });
    const MOUSEINPUT = koffi.struct('TBoxMouseInput', {
      dx: 'int32', dy: 'int32', mouseData: 'uint32',
      dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr',
    });
    const HARDWAREINPUT = koffi.struct('TBoxHardwareInput', {
      uMsg: 'uint32', wParamL: 'uint16', wParamH: 'uint16',
    });
    // INPUT 联合体大小 40 字节（64 位）：type(4+4 对齐) + union 32。
    // union 首成员是 KEYBDINPUT（24B），尾部按 MOUSEINPUT 对齐。
    const INPUT = koffi.struct('TBoxInput', {
      type: 'uint32',
      union: koffi.union({ ki: KEYBDINPUT, mi: MOUSEINPUT, hi: HARDWAREINPUT }),
    });

    const SendInput = user32.func('uint __stdcall SendInput(uint nInputs, TBoxInput* pInputs, int cbSize)');
    const GetAsyncKeyState = user32.func('short __stdcall GetAsyncKeyState(int vKey)');
    const GetLastError = kernel32.func('uint __stdcall GetLastError()');
    const sizeofINPUT = koffi.sizeof(INPUT);

    let pressErrorLogged = false;

    const api = {
      sizeofINPUT,
      /** 注入一次按键；失败时只记一次日志（UIPI 阻止时 SendInput 返回 0 / 错误码 5） */
      pressKey(vk, isUp) {
        const input = {
          type: INPUT_KEYBOARD,
          union: {
            ki: { wVk: vk, wScan: 0, dwFlags: isUp ? KEYEVENTF_KEYUP : 0, time: 0, dwExtraInfo: 0n },
          },
        };
        const sent = SendInput(1, [input], sizeofINPUT);
        if (sent !== 1 && !pressErrorLogged) {
          pressErrorLogged = true;
          console.error('[SelectionReader] SendInput 失败, GetLastError:', GetLastError());
        }
        return sent === 1;
      },
      /** 是否有修饰键处于按下状态（含物理按键） */
      isModifierPressed() {
        return MODIFIER_VKS.some((vk) => (GetAsyncKeyState(vk) & 0x8000) !== 0);
      },
    };
    console.info('[SelectionReader] SendInput 已就绪（koffi, sizeof=' + sizeofINPUT + ')');
    return api;
  } catch (error) {
    console.error('[SelectionReader] koffi 初始化失败，改用 PowerShell 回退:', error.message);
    return null;
  }
})();

/** 等待物理修饰键释放：全局快捷键回调触发时用户手指通常还按着 Alt，最多等 timeoutMs */
async function waitModifiersReleased(timeoutMs = 400) {
  if (!win32Api) return;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!win32Api.isModifierPressed()) return;
    await sleep(15);
  }
}

/** 同步抬起 RELEASE_VKS 中的全部按键（对齐 TTime：取词一开始就释放，早于等待延迟） */
function releaseKeys() {
  if (!win32Api) return;
  RELEASE_VKS.forEach((vk) => win32Api.pressKey(vk, true));
}

/** PowerShell 回退：一次性完成"抬修饰键 + Ctrl+C"，避免逐键启动进程（单次 ~1.5s） */
function sendCopyWin32Fallback(holdMs) {
  const ps = [
    "Add-Type @'",
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class TBoxSendCopy {',
    '  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public InputUnion u; }',
    '  [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public KEYBDINPUT ki; }',
    '  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }',
    '  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);',
    '  public static void Key(ushort vk, bool up) {',
    '    InputUnion u = new InputUnion(); u.ki.wVk = vk; u.ki.dwFlags = up ? (uint)2 : 0u;',
    '    INPUT i = new INPUT(); i.type = 1; i.u = u;',
    '    SendInput(1, new INPUT[] { i }, 40);',
    '  }',
    '  public static void Copy(int holdMs) {',
    '    Key(0xA2, true); Key(0xA3, true); Key(0xA4, true); Key(0xA5, true); Key(0xA0, true); Key(0xA1, true);',
    '    Key(0x5B, true); Key(0x5C, true); Key(0x20, true); Key(0x09, true); Key(0x1B, true);',
    '    Key(0x11, false); Key(0x43, false); System.Threading.Thread.Sleep(holdMs); Key(0x43, true); Key(0x11, true);',
    '  }',
    '}',
    "'@",
    `[TBoxSendCopy]::Copy(${holdMs}) | Out-Null`,
  ].join('\n');
  return new Promise((resolve) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true },
      () => resolve()
    );
  });
}

/**
 * 发 Ctrl+C。holdMs 为组合键保持按下的时长——对齐 TTime 的 translateChoiceDelay/2，
 * 太短（如 60ms）时响应慢的应用（Office / WPS / Java 类）来不及处理复制。
 */
async function sendCopyWin32(holdMs) {
  if (!win32Api) {
    await sendCopyWin32Fallback(holdMs);
    return;
  }
  RELEASE_VKS.forEach((vk) => win32Api.pressKey(vk, true));
  win32Api.pressKey(VK_CTRL, false);
  win32Api.pressKey(VK_C, false);
  await sleep(holdMs);
  win32Api.pressKey(VK_C, true);
  win32Api.pressKey(VK_CTRL, true);
}

function sendCopyDarwin() {
  return new Promise((resolve) => {
    execFile('osascript', ['-e', 'tell application "System Events" to keystroke "c" using command down'], () => resolve());
  });
}

function sendCopyLinux() {
  return new Promise((resolve) => {
    execFile('xdotool', ['key', 'Ctrl+c'], () => resolve());
  });
}

async function sendCopy(holdMs) {
  if (process.platform === 'win32') {
    await sendCopyWin32(holdMs);
  } else if (process.platform === 'darwin') {
    await sendCopyDarwin();
  } else {
    await sendCopyLinux();
  }
}

/**
 * 轮询剪贴板直到取到非空文本或超时。
 * excludeText 为取词前剪贴板内容：剪贴板管理工具可能在 clear 后立即恢复旧内容，
 * 不排除就会把旧内容误判成"刚复制出来的选中文本"（用户看到的正是"总是剪贴板内容"）。
 */
function pollClipboard(timeoutMs, stepMs, excludeText) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const tick = () => {
      const text = clipboard.readText();
      if (text && text.trim() && text !== excludeText) { resolve(text); return; }
      if (Date.now() - startedAt >= timeoutMs) { resolve(''); return; }
      setTimeout(tick, stepMs);
    };
    tick();
  });
}

/** 还原取词前的剪贴板内容；优先级：图片 > HTML > RTF > 纯文本 */
function restoreClipboard(backup, hadImage) {
  if (hadImage) clipboard.writeImage(backup.image);
  else if (backup.html) { clipboard.writeHTML(backup.html); clipboard.writeText(backup.text); }
  else if (backup.rtf) clipboard.writeRTF(backup.rtf);
  else if (backup.text) clipboard.writeText(backup.text);
  else clipboard.clear();
}

/**
 * 取当前选中的文本。
 * fallback=true 表示未能复制到选中文本（不会返回取词前的剪贴板内容，避免旧内容冒充选中文本）。
 */
async function readSelectedText() {
  if (isChoosing) return { text: '', fallback: false, busy: true };
  isChoosing = true;
  let backup = null;
  let hadImage = false;

  try {
    backup = {
      text: clipboard.readText(),
      html: clipboard.readHTML(),
      rtf: clipboard.readRTF(),
      image: clipboard.readImage(),
    };
    hadImage = !backup.image.isEmpty();
    clipboard.clear();

    const delay = Number(loadSettings().translateChoiceDelay) || 600;
    const half = Math.max(50, Math.floor(delay / 2));

    // 对齐 TTime：先同步释放快捷键残留的按键状态，再等半个延迟让用户松手
    releaseKeys();
    await sleep(half);

    // 再确认物理修饰键确实松开（Alt 残留会把 Ctrl+C 变成 Alt+Ctrl+C）
    await waitModifiersReleased();
    await sendCopy(half);

    // C 抬起后立即读：按键保持 half 已给目标应用足够的处理时间
    let text = (await pollClipboard(800, 30, backup.text)).trim();

    // 第二次机会：部分应用首次 Ctrl+C 只激活编辑上下文，重复一次通常成功
    if (!text) {
      await sendCopy(half);
      text = (await pollClipboard(500, 30, backup.text)).trim();
    }

    if (text) {
      console.info('[SelectionReader] 取词成功，长度:', text.length);
      return { text, fallback: false, busy: false };
    }
    console.warn('[SelectionReader] 取词失败：未复制到选中文本');
    return { text: '', fallback: true, busy: false };
  } finally {
    // 还原失败也必须解除防重入，否则后续所有取词都会永久返回 busy
    try {
      if (backup) restoreClipboard(backup, hadImage);
    } finally {
      isChoosing = false;
    }
  }
}

module.exports = { readSelectedText };
