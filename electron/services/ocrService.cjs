/**
 * OCR 原生服务封装（rapidocr-node）
 * 模型首次使用时自动下载并缓存至 userData/RapidOCR/models/
 */
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// rapidocr-node（拖带 onnxruntime-node + sharp 两个 native 库）不能在顶层 require：
// 本模块被 main.cjs / pluginIpc.cjs 顶层加载，顶层 require 会把它带进启动关键路径。
// 改为首次 ensureInit 时延迟 require，与 email 模块的延迟加载策略一致。
let rapidocrMod = null;

let ocr = null;
let initPromise = null;

// 引擎空闲释放：OCR 插件窗口关闭不会自动释放原生引擎，长时间不用会常驻主进程。
// 采用「引用计数 + 空闲超时」而不是关窗即 terminate，避免打断截图翻译等复用路径。
const OCR_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
let activeRequests = 0;
let lastUsedAt = 0;
let idleTimer = null;

function clearIdleTimer() {
  if (!idleTimer) return;
  clearTimeout(idleTimer);
  idleTimer = null;
}

function scheduleIdleRelease() {
  if (idleTimer || !ocr) return;
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (activeRequests > 0 || !ocr) return;
    if (Date.now() - lastUsedAt < OCR_IDLE_TIMEOUT_MS) {
      scheduleIdleRelease();
      return;
    }
    terminate().catch((err) => {
      console.error('[OCR] 空闲释放失败:', err && err.message ? err.message : err);
    });
  }, OCR_IDLE_TIMEOUT_MS);
  if (typeof idleTimer.unref === 'function') idleTimer.unref();
}

function markUsed() {
  lastUsedAt = Date.now();
  scheduleIdleRelease();
}

function getModelCacheDir() {
  return path.join(app.getPath('userData'), 'RapidOCR');
}

async function ensureInit() {
  if (ocr) return ocr;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!rapidocrMod) {
      rapidocrMod = require('rapidocr-node');
    }
    const modelDir = getModelCacheDir();
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    ocr = await rapidocrMod.RapidOCR.create({ modelDirectory: modelDir });
    markUsed();
    return ocr;
  })();
  return initPromise;
}

async function recognizeBase64(imageBase64) {
  activeRequests++;
  let instance;
  try {
    instance = await ensureInit();
    markUsed();
    // strip data URI prefix (e.g. "data:image/png;base64,...")
    const raw = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(raw, 'base64');
    const result = await instance.recognize(buffer);
    if (result.type !== 'ocr') {
      return { success: true, text: '', blocks: [] };
    }
    return {
      success: true,
      text: result.txts?.join('\n') || '',
      blocks: (result.lines || []).map(line => ({
        text: line.text,
        confidence: line.confidence,
        bbox: line.box,
      })),
    };
  } finally {
    activeRequests--;
  }
}

async function recognizeFile(filePath) {
  activeRequests++;
  let instance;
  try {
    instance = await ensureInit();
    markUsed();
    const result = await instance.recognize(filePath);
    if (result.type !== 'ocr') {
      return { success: true, text: '', blocks: [] };
    }
    return {
      success: true,
      text: result.txts?.join('\n') || '',
      blocks: (result.lines || []).map(line => ({
        text: line.text,
        confidence: line.confidence,
        bbox: line.box,
      })),
    };
  } finally {
    activeRequests--;
  }
}

function isRunning() {
  return !!ocr;
}

function getStatus() {
  return { available: !!ocr, ready: !!ocr };
}

async function terminate() {
  clearIdleTimer();
  if (ocr) {
    await ocr.close();
    ocr = null;
    initPromise = null;
  }
}

module.exports = { ensureInit, recognizeBase64, recognizeFile, getStatus, isRunning, terminate };
