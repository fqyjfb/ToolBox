/**
 * OCR 识别 IPC 处理器
 *
 * 处理图片文字识别（rapidocr-node 原生实现，无需 Python 服务）
 */

const { ipcMain, app } = require('electron');
const path = require('path');
const { ensureInit, recognizeBase64: ocrRecognizeBase64, recognizeFile: ocrRecognizeFile, getStatus, terminate } = require('../services/ocrService.cjs');

/**
 * 注册 OCR 相关 IPC 处理器
 */
function registerOcrIpc() {
  // OCR 识别 Base64 图片（超时时间 60 秒）
  ipcMain.handle('ocr:recognize', async (_event, { imageBase64 }) => {
    try {
      const result = await ocrRecognizeBase64(imageBase64);
      return result;
    } catch (error) {
      return { success: false, text: '', blocks: [], error: error.message };
    }
  });

  // OCR 识别图片文件（超时时间 60 秒）
  ipcMain.handle('ocr:recognizeFile', async (_event, { filePath }) => {
    try {
      const result = await ocrRecognizeFile(filePath);
      return result;
    } catch (error) {
      return { success: false, text: '', blocks: [], error: error.message };
    }
  });

  // 获取 OCR 服务状态
  ipcMain.handle('ocr:status', async () => {
    const status = getStatus();
    return {
      available: status.available,
      ready: status.ready,
      message: status.available ? 'OCR 引擎就绪' : 'OCR 引擎未初始化（首次使用将自动加载模型）',
    };
  });

  // 手动启动 OCR 引擎（触发模型懒加载）
  ipcMain.handle('ocr:start', async () => {
    try {
      await ensureInit();
      return { success: true, message: 'OCR 引擎已就绪' };
    } catch (error) {
      return { success: false, message: 'OCR 引擎启动失败: ' + error.message, error: error.message };
    }
  });

  // 手动停止 OCR 引擎
  ipcMain.handle('ocr:stop', async () => {
    try {
      await terminate();
      return { success: true, message: 'OCR 引擎已停止' };
    } catch (error) {
      return { success: false, message: '停止失败: ' + error.message, error: error.message };
    }
  });

  // 获取服务详细信息
  ipcMain.handle('ocr:serviceInfo', async () => {
    const status = getStatus();
    return {
      available: status.available,
      ready: status.ready,
      modelCacheDir: path.join(app.getPath('userData'), 'RapidOCR'),
    };
  });

  // OCR 运行时信息（设置页状态行共用）
  ipcMain.handle('ocr:runtimeInfo', async () => {
    try {
      const status = getStatus();
      return {
        source: 'native',
        dir: path.join(app.getPath('userData'), 'RapidOCR'),
        available: status.available,
        ready: status.ready,
      };
    } catch (error) {
      return { error: error.message };
    }
  });

  // 翻译浮层「打开 OCR 设置」：显示主窗口并导航到设置页
  ipcMain.handle('translate:open-ocr-settings', async () => {
    try {
      const { getMainWindow } = require('../window/mainWindow.cjs');
      const mainWindow = getMainWindow();
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('navigate-to', '/settings');
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerOcrIpc };
