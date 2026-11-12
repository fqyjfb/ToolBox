// notesExportService —— 笔记导出 PDF / HTML。
//
// 做法：把构建好的 HTML 写入临时文件 → 隐藏窗口加载 → 等图片解码 → printToPDF
// → 弹保存对话框落盘 → 销毁窗口并删除临时文件。
//
// 复用阶段 1 的渲染器，因此导出与编辑器渲染 100% 一致。

const { app, BrowserWindow, dialog } = require('electron');
const fsp = require('fs/promises');
const path = require('path');

/** 等待图片解码的兜底超时 */
const READY_TIMEOUT_MS = 15000;

const PDF_OPTIONS = {
  printBackground: true,
  pageSize: 'A4',
  // 单位是英寸
  margins: { top: 0.7, bottom: 0.7, left: 0.6, right: 0.6 },
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="width:100%;font-size:9px;color:#71717a;padding:0 16mm;display:flex;justify-content:center;">' +
    '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
};

/** 等待 load 完成且所有图片解码完毕；超时或异常都放行（导出不应卡死） */
function waitImagesDecoded(webContents) {
  const ready = webContents
    .executeJavaScript(
      `new Promise((resolve) => {
        const done = () => {
          const pending = [...document.images].filter((img) => !img.complete);
          if (pending.length === 0) return resolve(true);
          Promise.all(pending.map((img) => img.decode().catch(() => {}))).then(() => resolve(true));
        };
        if (document.readyState === 'complete') done();
        else window.addEventListener('load', done);
      })`,
    )
    .catch(() => true);

  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(true), READY_TIMEOUT_MS);
  });

  return Promise.race([ready, timeout]);
}

/**
 * 把 HTML 导出为 PDF。
 *
 * @param {{ html: string, defaultPath?: string, title?: string }} payload
 * @returns {Promise<{ success: boolean, canceled?: boolean, filePath?: string, error?: string }>}
 */
async function exportPdf(payload) {
  const html = payload && typeof payload.html === 'string' ? payload.html : '';
  if (!html) return { success: false, error: '导出内容为空' };

  const tempFile = path.join(
    app.getPath('temp'),
    `notes-export-${Date.now()}-${Math.random().toString(36).slice(2)}.html`,
  );
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
    },
  });

  let data;
  try {
    await fsp.writeFile(tempFile, html, 'utf8');
    await win.loadFile(tempFile);
    await waitImagesDecoded(win.webContents);
    data = await win.webContents.printToPDF(PDF_OPTIONS);
  } catch (error) {
    return { success: false, error: (error && error.message) || '生成 PDF 失败' };
  } finally {
    // 无论成功失败都必须销毁隐藏窗口、清理临时文件，避免残留进程
    try {
      win.destroy();
    } catch {
      /* ignore */
    }
    await fsp.unlink(tempFile).catch(() => {});
  }

  const target = await dialog.showSaveDialog(win.isDestroyed() ? undefined : win, {
    title: '导出 PDF',
    defaultPath: payload.defaultPath || 'note.pdf',
    filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
  });
  if (target.canceled || !target.filePath) return { success: true, canceled: true };

  try {
    await fsp.writeFile(target.filePath, Buffer.from(data));
  } catch (error) {
    return { success: false, error: (error && error.message) || '写入文件失败' };
  }
  return { success: true, canceled: false, filePath: target.filePath };
}

/**
 * 导出为独立 HTML 文件（图片已内联为 data-uri，单文件可分发）。
 */
async function exportHtml(payload) {
  const html = payload && typeof payload.html === 'string' ? payload.html : '';
  if (!html) return { success: false, error: '导出内容为空' };

  const target = await dialog.showSaveDialog({
    title: '导出 HTML',
    defaultPath: payload.defaultPath || 'note.html',
    filters: [{ name: 'HTML 文档', extensions: ['html'] }],
  });
  if (target.canceled || !target.filePath) return { success: true, canceled: true };

  try {
    await fsp.writeFile(target.filePath, html, 'utf8');
  } catch (error) {
    return { success: false, error: (error && error.message) || '写入文件失败' };
  }
  return { success: true, canceled: false, filePath: target.filePath };
}

/**
 * 导出为纯文本文件（渲染层已剥离 Markdown 语法标记）。
 *
 * 复用 exportHtml 的保存对话框 + utf8 落盘，避免重复实现。
 */
async function exportTxt(payload) {
  const text = payload && typeof payload.text === 'string' ? payload.text : '';
  if (!text) return { success: false, error: '导出内容为空' };

  const target = await dialog.showSaveDialog({
    title: '导出 TXT',
    defaultPath: payload.defaultPath || 'note.txt',
    filters: [{ name: '文本文件', extensions: ['txt'] }],
  });
  if (target.canceled || !target.filePath) return { success: true, canceled: true };

  try {
    await fsp.writeFile(target.filePath, text, 'utf8');
  } catch (error) {
    return { success: false, error: (error && error.message) || '写入文件失败' };
  }
  return { success: true, canceled: false, filePath: target.filePath };
}

module.exports = { exportPdf, exportHtml, exportTxt };
