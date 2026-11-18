/**
 * 划词取词原生层：封装 selection-hook（Windows UIA / macOS AX / Linux AT-SPI），
 * 只负责「按需读取当前选区」；优先走无障碍接口，仅在都失败时由模块内置兜底。
 *
 * 设计要点：
 * 1. 懒加载 + 单例：首次取词时才 require 原生模块，不进入冷启动路径；
 * 2. 被动模式：setSelectionPassiveMode(true) 后不派发 text-selection 事件，仅按需读取；
 * 3. 保留模块内置的剪贴板兜底（默认开启）：Word / WPS / VS Code / 微信 / QQ 等
 *    没有可用 UIA 文本模式的应用，只能由它在 UIA + IAccessible 都失败时同步兜底；
 *    该兜底在 getCurrentSelection() 的调用线程内完成，读写与还原在同一个 JS 任务里结束，
 *    本进程的剪贴板采样定时器不会在中间插进来，因此不会误触发悬浮球气泡；
 * 4. start() 失败或读取抛错只降级一次，避免每次取词都重试原生调用；
 * 5. dispose() 由主进程 before-quit 调用，退出后不再重新加载。
 */
let hook;
let loadFailed = false;
let disposed = false;

function getProvider() {
  if (disposed || loadFailed) return null;
  if (hook !== undefined) return hook;

  try {
    const SelectionHook = require('selection-hook');
    const instance = new SelectionHook();
    // 不调用 disableClipboard()：UIA / IAccessible 都失败时由内置兜底同步取词
    instance.setSelectionPassiveMode(true);
    if (!instance.start({ debug: false })) {
      try { instance.cleanup(); } catch { /* 半初始化实例释放失败可忽略 */ }
      loadFailed = true;
      hook = null;
      console.error('[SelectionHook] start() 返回 false，划词取词不可用');
      return null;
    }
    instance.on('error', (error) => console.error('[SelectionHook] 运行异常:', error));
    hook = instance;
  } catch (error) {
    loadFailed = true;
    hook = null;
    console.error('[SelectionHook] 加载失败，划词取词不可用:', error.message);
  }
  return hook;
}

/** 读取当前选中文本；未命中返回空串，异常只降级一次 */
function readCurrentSelection() {
  const instance = getProvider();
  if (!instance) return '';
  try {
    const selection = instance.getCurrentSelection();
    return selection && selection.text ? selection.text : '';
  } catch (error) {
    loadFailed = true;
    console.error('[SelectionHook] 读取失败，后续不再尝试:', error.message);
    return '';
  }
}

function dispose() {
  disposed = true;
  if (!hook) return;
  try { hook.stop(); } catch { /* 退出期忽略 */ }
  try { hook.cleanup(); } catch { /* 退出期忽略 */ }
  hook = null;
}

module.exports = { readCurrentSelection, dispose };
