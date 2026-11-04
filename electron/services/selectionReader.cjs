/**
 * 划词取词：Windows 用 koffi 直接调 user32!SendInput（主进程内同步 / 零启动开销）。
 * macOS / Linux 沿用原方案。
 *
 * TTime 用 @jitsi/robotjs 实现同样效果——我们选 koffi 是因为它是纯 JS FFI，
 * 不需要 native 编译，Electron 打包时不会出 ABI 不兼容问题。
 *
 * 设计要点：
 * 1. SendInput 是 Windows XP+ 官方 API，在现代浏览器 / Office / 微信等应用上比 keybd_event 可靠；
 * 2. 发键前先释放所有修饰键（Ctrl/Alt/Shift/Meta），避免全局快捷键拦截后键态残留；
 * 3. 发键前备份剪贴板（文本 / HTML / RTF / 图片），取词后按优先级还原；
 * 4. 最长 800ms 轮询剪贴板，避免 TTime「按键抬起立即读」的竞态；
 * 5. 模块级 isChoosing 防重入。
 */
const { execFile } = require('child_process');
const { clipboard } = require('electron');
const { loadSettings } = require('../lib/config.cjs');

let isChoosing = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── SendInput 常量 ──────────────────────────────────────────────────────────
const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const VK_META = 0x5B; // VK_LWIN
const VK_ALT = 0x12;
const VK_SHIFT = 0x10;
const VK_CTRL = 0x11;
const VK_C = 0x43;

// ── koffi 懒加载（仅 win32 平台） ─────────────────────────────────────────────
let sendInputFn = null;
let sizeofINPUT = 0;

function initSendInput() {
  if (sendInputFn) return true;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');

    // INPUT 联合体大小 40 字节（64 位）。union 首成员是 KEYBDINPUT（24B），
    // 尾部对齐到 INPUT 大小。koffi.union 会自动处理。
    const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
      wVk: 'uint16',
      wScan: 'uint16',
      dwFlags: 'uint32',
      time: 'uint32',
      dwExtraInfo: 'uintptr',
    });
    const MOUSEINPUT = koffi.struct('MOUSEINPUT', {
      dx: 'int32', dy: 'int32', mouseData: 'uint32',
      dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr',
    });
    const HARDWAREINPUT = koffi.struct('HARDWAREINPUT', {
      uMsg: 'uint32', wParamL: 'uint16', wParamH: 'uint16',
    });

    const INPUT = koffi.struct('INPUT', {
      type: 'uint32',
      union: koffi.union({ ki: KEYBDINPUT, mi: MOUSEINPUT, hi: HARDWAREINPUT }),
    });

    const SendInput = user32.func('uint __stdcall SendInput(uint nInputs, INPUT* pInputs, int cbSize)');
    sizeofINPUT = koffi.sizeof(INPUT);

    sendInputFn = (vk, isUp) => {
      const input = {
        type: INPUT_KEYBOARD,
        union: {
          ki: {
            wVk: vk,
            wScan: 0,
            dwFlags: isUp ? KEYEVENTF_KEYUP : 0,
            time: 0,
            dwExtraInfo: 0n,
          },
        },
      };
      SendInput(1, [input], sizeofINPUT);
    };
    console.info('[SelectionReader] SendInput 已就绪（koffi, sizeof=' + sizeofINPUT + ')');
    return true;
  } catch (error) {
    console.error('[SelectionReader] koffi 加载失败:', error.message);
    return false;
  }
}

/** 发键：优先 koffi 同步调 user32!SendInput；失败回退到 PowerShell 子进程 */
function pressWin32(vk, isUp) {
  if (sendInputFn) {
    sendInputFn(vk, isUp);
    return Promise.resolve();
  }
  // 回退：PowerShell（仅用于 koffi 加载失败时）
  const flag = isUp ? '0x0002' : '0';
  const ps = [
    'Add-Type @"',
    'using System; using System.Runtime.InteropServices;',
    'public class SI {',
    '  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public InputUnion u; }',
    '  [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public KEYBDINPUT ki; }',
    '  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }',
    '  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);',
    '}',
    '"@',
    `$i = New-Object SI+INPUT; $i.type = 1; $i.u.ki.wVk = ${vk}; $i.u.ki.dwFlags = ${flag};`,
    '[SI]::SendInput(1, @($i), 40) | Out-Null',
  ].join('\n');
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps],
      { windowsHide: true }, () => resolve());
  });
}

async function sendCopyWin32() {
  // 先抬起所有残留修饰键（全局快捷键拦截后 Alt/Ctrl 常留在系统队列）
  await pressWin32(VK_META, true);
  await pressWin32(VK_ALT, true);
  await pressWin32(VK_SHIFT, true);
  // Ctrl+C
  await pressWin32(VK_CTRL, false);
  await pressWin32(VK_C, false);
  await sleep(60);
  await pressWin32(VK_C, true);
  await pressWin32(VK_CTRL, true);
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

/** 轮询剪贴板直到取到非空文本或超时 */
function pollClipboard(timeoutMs, stepMs) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const tick = () => {
      const text = clipboard.readText();
      if (text && text.trim()) { resolve(text); return; }
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

/** 取当前选中的文本。fallback=true 表示按键发送失败，降级返回取词前剪贴板。 */
async function readSelectedText() {
  if (isChoosing) return { text: '', fallback: false, busy: true };
  isChoosing = true;

  const backup = {
    text: clipboard.readText(),
    html: clipboard.readHTML(),
    rtf: clipboard.readRTF(),
    image: clipboard.readImage(),
  };
  const hadImage = !backup.image.isEmpty();
  clipboard.clear();

  try {
    const delay = Number(loadSettings().translateChoiceDelay) || 600;
    const half = Math.max(50, Math.floor(delay / 2));
    await sleep(half);

    if (process.platform === 'win32') {
      initSendInput();
      await sendCopyWin32();
    } else if (process.platform === 'darwin') {
      await sendCopyDarwin();
    } else {
      await sendCopyLinux();
    }

    await sleep(half);
    const text = (await pollClipboard(800, 30)).trim();
    if (text) {
      console.info('[SelectionReader] 取词成功，长度:', text.length);
      return { text, fallback: false, busy: false };
    }
    console.warn('[SelectionReader] 取词失败，降级为原剪贴板内容');
    return { text: (backup.text || '').trim(), fallback: true, busy: false };
  } finally {
    restoreClipboard(backup, hadImage);
    isChoosing = false;
  }
}

module.exports = { readSelectedText };
