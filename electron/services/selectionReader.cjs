/**
 * 划词取词：走 selection-hook（无障碍接口优先，未命中时用模块内置兜底）。
 *
 * 设计要点：
 * 1. 本工程不自建剪贴板兜底：不备份、不清空、不注入、不轮询、不还原；
 *    无障碍接口命中时不碰剪贴板，未命中时由 selection-hook 内置兜底同步补取；
 * 2. 原生模块懒加载、单例、退出清理由 provider 统一负责；
 * 3. 模块级 isChoosing 防重入，并发调用直接返回 busy；
 * 4. 未读到文本返回 fallback: true，由调用方给出重试提示；
 * 5. 返回原文不 trim，调用方各自 trim，避免重复处理。
 */
const { readCurrentSelection } = require('./selectionHookProvider.cjs');

let isChoosing = false;

/**
 * 取当前选中的文本。
 * fallback=true 表示本次没有读到选中文本（不会用旧剪贴板内容冒充）。
 */
async function readSelectedText() {
  if (isChoosing) return { text: '', fallback: false, busy: true };
  isChoosing = true;

  try {
    const text = readCurrentSelection();
    if (text && text.trim()) {
      console.info('[SelectionReader] 取词成功, 长度:', text.length);
      return { text, fallback: false, busy: false };
    }
    console.warn('[SelectionReader] 取词失败：未读取到选中文本');
    return { text: '', fallback: true, busy: false };
  } finally {
    // 异常也必须解除防重入，否则后续所有取词都会永久返回 busy
    isChoosing = false;
  }
}

module.exports = { readSelectedText };
