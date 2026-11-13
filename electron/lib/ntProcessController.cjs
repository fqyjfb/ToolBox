// 应用锁专用进程控制器：检测运行进程 / 挂起 / 恢复 / 枚举顶层可见窗口。
// 优先 koffi 直调 Win32（与 selectionReader.cjs 同款惰性初始化模式：
// 首次使用才加载、不进启动关键路径；类型注册名统一加 TBoxAppLock 前缀防重名），
// koffi 初始化失败时自动降级为内联 PowerShell（Add-Type P/Invoke ntdll）。
// 注意：仅 win32 有效；所有 hwnd/handle 一律用 uintptr 整型承载（BigInt），
// 避免 koffi 指针对象跨调用身份不稳定的问题。
const { execFile } = require('child_process');
const path = require('path');

const PROCESS_SUSPEND_RESUME = 0x0800;
const GW_HWNDNEXT = 2;
const DWMWA_EXTENDED_FRAME_BOUNDS = 9;
const DWMWA_CLOAKED = 14;
// EnumWindows 等价遍历（Z 序）的最大窗口数，防止异常环境下死循环/超长遍历
const MAX_WINDOW_SCAN = 400;
// 单个进程枚举顶层可见窗口的默认上限（调用方可再裁剪）
const MAX_WINDOWS_PER_PID = 8;
const POWERSHELL_TIMEOUT_MS = 15000;

// ── 系统关键进程保护名单（不含 .exe 后缀）：命中一律拒绝挂起 ─────────────────
const PROTECTED_PROCESS_NAMES = new Set([
  'system', 'smss', 'csrss', 'wininit', 'winlogon', 'services',
  'lsass', 'svchost', 'dwm', 'win32k', 'explorer', 'fontdrvhost',
  'dllhost', 'conhost', 'runtimebroker', 'taskhostw', 'sihost',
  'searchhost', 'shellexperiencehost', 'applicationframehost', 'wmiprvse',
  'msmpeng', 'securityhealthservice', 'securityhealthsystray',
]);

const normalizeName = (name) => String(name || '').toLowerCase().replace(/\.exe$/, '').trim();

const getOwnProcessName = () => normalizeName(path.basename(process.execPath));

/** 是否为受保护（禁止挂起）的进程名：系统关键进程 + 本应用自身 */
const isProtectedName = (name) => {
  const n = normalizeName(name);
  if (!n) return true;
  return PROTECTED_PROCESS_NAMES.has(n) || n === getOwnProcessName();
};

/** 由 exe 路径推导进程名（去 .exe 后缀） */
const resolveProcessName = (exePath) =>
  path.basename(String(exePath || ''), path.extname(String(exePath || '')));

// ── koffi 惰性初始化（仅一次；失败缓存 null，走 PowerShell 回退） ─────────────
let ntApi;
function getNtApi() {
  if (ntApi === undefined) ntApi = buildNtApi();
  return ntApi;
}

function buildNtApi() {
  if (process.platform !== 'win32') return null;
  try {
    const koffi = require('koffi');
    const kernel32 = koffi.load('kernel32.dll');
    const ntdll = koffi.load('ntdll.dll');
    const user32 = koffi.load('user32.dll');
    let dwmapi = null;
    try { dwmapi = koffi.load('dwmapi.dll'); } catch { /* dwmapi 属可选增强 */ }

    // 类型注册表是进程级全局的，同名重复定义会抛且永久失效——统一加 TBoxAppLock 前缀
    const RECT = koffi.struct('TBoxAppLockRect', {
      left: 'int32', top: 'int32', right: 'int32', bottom: 'int32',
    });

    const OpenProcess = kernel32.func('uintptr __stdcall OpenProcess(uint32 dwDesiredAccess, int bInheritHandle, uint32 dwProcessId)');
    const CloseHandle = kernel32.func('int __stdcall CloseHandle(uintptr hObject)');
    const NtSuspendProcess = ntdll.func('int32 __stdcall NtSuspendProcess(uintptr ProcessHandle)');
    const NtResumeProcess = ntdll.func('int32 __stdcall NtResumeProcess(uintptr ProcessHandle)');

    // 窗口枚举走 Z 序链表遍历（GetTopWindow + GetWindow），
    // 规避 koffi 回调注册（koffi.register）的版本差异风险
    const GetTopWindow = user32.func('uintptr __stdcall GetTopWindow(uintptr hwnd)');
    const GetWindow = user32.func('uintptr __stdcall GetWindow(uintptr hwnd, uint32 nCmd)');
    const IsWindowVisible = user32.func('int __stdcall IsWindowVisible(uintptr hwnd)');
    const IsIconic = user32.func('int __stdcall IsIconic(uintptr hwnd)');
    const IsWindow = user32.func('int __stdcall IsWindow(uintptr hwnd)');
    const GetWindowThreadProcessId = user32.func('uint32 __stdcall GetWindowThreadProcessId(uintptr hwnd, _Out_ uint32 *outPid)');
    const GetWindowRect = user32.func('int __stdcall GetWindowRect(uintptr hwnd, _Out_ TBoxAppLockRect *rect)');
    const DwmGetWindowAttributeRect = dwmapi
      ? dwmapi.func('int32 __stdcall DwmGetWindowAttribute(uintptr hwnd, uint32 attr, _Out_ TBoxAppLockRect *pv, uint32 cb)')
      : null;
    const DwmGetWindowAttributeU32 = dwmapi
      ? dwmapi.func('int32 __stdcall DwmGetWindowAttribute(uintptr hwnd, uint32 attr, _Out_ uint32 *pv, uint32 cb)')
      : null;

    /** 取窗口精确边界：优先 DWM 扩展边界（不含不可见阴影），失败回落 GetWindowRect */
    function readWindowRect(hwnd) {
      const rect = { left: 0, top: 0, right: 0, bottom: 0 };
      if (DwmGetWindowAttributeRect) {
        try {
          if (DwmGetWindowAttributeRect(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, rect, 16) === 0
            && rect.right > rect.left && rect.bottom > rect.top) return rect;
        } catch { /* 回落 */ }
      }
      if (GetWindowRect(hwnd, rect) && rect.right > rect.left && rect.bottom > rect.top) return rect;
      return null;
    }

    /** 窗口是否被 DWM 遮蔽（UWP 挂起态等），被遮蔽窗口不作为遮罩目标 */
    function isCloaked(hwnd) {
      if (!DwmGetWindowAttributeU32) return false;
      try {
        const box = { value: 0 };
        if (DwmGetWindowAttributeU32(hwnd, DWMWA_CLOAKED, box, 4) === 0) return box.value !== 0;
      } catch { /* 视为未遮蔽 */ }
      return false;
    }

    return {
      OpenProcess, CloseHandle, NtSuspendProcess, NtResumeProcess,
      GetTopWindow, GetWindow, IsWindowVisible, IsIconic, IsWindow,
      GetWindowThreadProcessId, readWindowRect, isCloaked,
    };
  } catch (error) {
    console.error('[AppLock] koffi 初始化失败，进程挂起/恢复降级为 PowerShell:', error.message);
    return null;
  }
}

// ── 工具：execFile Promise 封装（统一 windowsHide + 超时，失败返回空串不抛断） ──
function execText(file, args, timeoutMs = POWERSHELL_TIMEOUT_MS) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      resolve(error ? '' : String(stdout || ''));
    });
  });
}

/** tasklist 输出 CSV 行解析："WeChat.exe","1234","Console",... → { image, pid } */
function parseTasklistRows(stdout) {
  const rows = [];
  if (!stdout) return rows;
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('"')) continue; // 跳过 "INFO: 没有..." 等非 CSV 行
    const fields = trimmed.match(/"([^"]*)"/g);
    if (fields && fields.length >= 2) {
      const image = fields[0].slice(1, -1);
      const pid = Number.parseInt(fields[1].slice(1, -1), 10);
      if (Number.isInteger(pid) && pid > 0) rows.push({ image, pid });
    }
  }
  return rows;
}

/** 过滤进程名中不允许进入 tasklist 过滤器的字符（防注入/防误配） */
const sanitizeProcessName = (name) => normalizeName(name).replace(/[^\w.\-()\[\] ]/g, '');

/**
 * 按进程名列表查找运行中的 PID（支持多实例，自动排除受保护进程）。
 * @returns {Promise<number[]>}
 */
async function findPidsByNames(processNames) {
  if (process.platform !== 'win32' || !Array.isArray(processNames)) return [];
  const names = [...new Set(processNames.map(sanitizeProcessName).filter(Boolean))];
  if (!names.length) return [];

  const results = await Promise.all(names.map(async (name) => {
    if (isProtectedName(name)) return [];
    const stdout = await execText('tasklist', ['/FO', 'CSV', '/NH', '/FI', `IMAGENAME eq ${name}.exe`]);
    return parseTasklistRows(stdout)
      .filter((row) => normalizeName(row.image) === name)
      .map((row) => row.pid);
  }));

  return [...new Set(results.flat())];
}

/** 一次性枚举全部进程镜像：Map<pid, imageName(小写、无 .exe)>，用于 PID 复用校验 */
async function listAllProcessImages() {
  const map = new Map();
  if (process.platform !== 'win32') return map;
  const stdout = await execText('tasklist', ['/FO', 'CSV', '/NH']);
  for (const row of parseTasklistRows(stdout)) map.set(row.pid, normalizeName(row.image));
  return map;
}

// ── PowerShell 回退（koffi 不可用时）：结果不逐 PID 校验，仅尽力执行 ──────────
function buildSuspendResumeScript(pids, fnName) {
  // pids 已在入口处校验为正整数数组，可安全内插
  return [
    "$ErrorActionPreference='SilentlyContinue'",
    "Add-Type -MemberDefinition '[DllImport(\"ntdll.dll\")] public static extern int NtSuspendProcess(IntPtr h);"
    + '[DllImport("ntdll.dll")] public static extern int NtResumeProcess(IntPtr h);'
    + '[DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint a, bool i, uint p);'
    + '[DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);'
    + "' -Name TBoxProcCtl -Namespace Win32",
    `foreach($procId in @(${pids.join(',')})) {`,
    '  $h=[Win32.TBoxProcCtl]::OpenProcess(0x0800,$false,[uint32]$procId)',
    '  if($h -ne [IntPtr]::Zero){',
    `    [Win32.TBoxProcCtl]::${fnName}($h)|Out-Null`,
    '    [Win32.TBoxProcCtl]::CloseHandle($h)|Out-Null',
    '  }',
    '}',
  ].join('; ');
}

function runPowerShell(script) {
  return new Promise((resolve) => {
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: POWERSHELL_TIMEOUT_MS },
      (error) => resolve(!error));
  });
}

async function psSuspendResume(pids, fnName) {
  const valid = (pids || []).filter((pid) => Number.isInteger(pid) && pid > 0);
  if (!valid.length) return { ok: [], failed: [] };
  const success = await runPowerShell(buildSuspendResumeScript(valid, fnName));
  return success ? { ok: valid, failed: [] } : { ok: [], failed: valid };
}

const sanitizePids = (pids) => [...new Set((pids || []).filter((pid) => Number.isInteger(pid) && pid > 0))];

/**
 * 挂起进程（NtSuspendProcess）。返回 { ok, failed }，ok 仅含确认成功的 PID。
 */
async function suspendPids(pids) {
  const targets = sanitizePids(pids);
  if (process.platform !== 'win32' || !targets.length) return { ok: [], failed: targets };
  const api = getNtApi();
  if (!api) return psSuspendResume(targets, 'NtSuspendProcess');

  const ok = [];
  const failed = [];
  for (const pid of targets) {
    try {
      const handle = api.OpenProcess(PROCESS_SUSPEND_RESUME, 0, pid);
      if (!handle) { failed.push(pid); continue; }
      const status = api.NtSuspendProcess(handle);
      api.CloseHandle(handle);
      (status === 0 ? ok : failed).push(pid);
    } catch (error) {
      console.error(`[AppLock] 挂起进程 ${pid} 异常:`, error.message);
      failed.push(pid);
    }
  }
  return { ok, failed };
}

/**
 * 恢复进程（NtResumeProcess）。返回 { ok, failed }。
 */
async function resumePids(pids) {
  const targets = sanitizePids(pids);
  if (process.platform !== 'win32' || !targets.length) return { ok: [], failed: targets };
  const api = getNtApi();
  if (!api) return psSuspendResume(targets, 'NtResumeProcess');

  const ok = [];
  const failed = [];
  for (const pid of targets) {
    try {
      const handle = api.OpenProcess(PROCESS_SUSPEND_RESUME, 0, pid);
      if (!handle) { failed.push(pid); continue; }
      const status = api.NtResumeProcess(handle);
      api.CloseHandle(handle);
      (status === 0 ? ok : failed).push(pid);
    } catch (error) {
      console.error(`[AppLock] 恢复进程 ${pid} 异常:`, error.message);
      failed.push(pid);
    }
  }
  return { ok, failed };
}

/**
 * 同步强制终止指定 PID 列表（Windows 下即 TerminateProcess）。
 * 必须同步执行：before-quit 时主进程随即退出，detached 子进程（PowerShell/taskkill）
 * 在宿主退出后不会真正执行，清理只能在主进程存活期间完成。
 */
function terminatePids(pids) {
  const targets = sanitizePids(pids);
  if (process.platform !== 'win32' || !targets.length) return;
  for (const pid of targets) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (error) {
      console.error(`[AppLock] 终止进程 ${pid} 失败:`, error.message);
    }
  }
}

/**
 * 枚举一组 PID 的顶层可见窗口（Z 序优先，跳过最小化与被 DWM 遮蔽的窗口）。
 * @returns {Array<{ pid: number, hwnd: bigint, rect: {left:number,top:number,right:number,bottom:number} }>}
 */
function findVisibleWindows(pids, limitPerPid = MAX_WINDOWS_PER_PID) {
  if (process.platform !== 'win32') return [];
  const api = getNtApi();
  if (!api) return [];
  const wanted = new Set(sanitizePids(pids));
  if (!wanted.size) return [];

  const perPidCount = new Map();
  const found = [];
  try {
    let hwnd = api.GetTopWindow(0n);
    for (let scanned = 0; hwnd && scanned < MAX_WINDOW_SCAN; scanned += 1) {
      if (api.IsWindowVisible(hwnd) && !api.IsIconic(hwnd) && !api.isCloaked(hwnd)) {
        const pidBox = { value: 0 };
        api.GetWindowThreadProcessId(hwnd, pidBox);
        const pid = pidBox.value;
        if (wanted.has(pid)) {
          const count = perPidCount.get(pid) || 0;
          if (count < limitPerPid) {
            const rect = api.readWindowRect(hwnd);
            if (rect) {
              found.push({ pid, hwnd, rect });
              perPidCount.set(pid, count + 1);
            }
          }
        }
      }
      hwnd = api.GetWindow(hwnd, GW_HWNDNEXT);
    }
  } catch (error) {
    console.error('[AppLock] 枚举目标窗口失败:', error.message);
  }
  return found;
}

/** 校验窗口句柄是否仍有效（遮罩跟随定时器用） */
function isWindowAlive(hwnd) {
  const api = getNtApi();
  if (!api) return false;
  try { return Boolean(api.IsWindow(hwnd)); } catch { return false; }
}

/** koffi 窗口枚举能力是否可用（不可用时遮罩层整体跳过，fail-soft） */
function getWindowsAvailable() {
  return process.platform === 'win32' && Boolean(getNtApi());
}

module.exports = {
  isProtectedName,
  resolveProcessName,
  sanitizeProcessName,
  findPidsByNames,
  listAllProcessImages,
  suspendPids,
  resumePids,
  terminatePids,
  findVisibleWindows,
  isWindowAlive,
  getWindowsAvailable,
};
