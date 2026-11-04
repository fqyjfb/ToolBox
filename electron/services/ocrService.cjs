/**
 * OCR 原生服务封装（rapidocr-node）
 * 模型首次使用时自动下载并缓存至 userData/RapidOCR/models/
 */
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { RapidOCR } = require('rapidocr-node');

let ocr = null;
let initPromise = null;

function getModelCacheDir() {
  return path.join(app.getPath('userData'), 'RapidOCR');
}

async function ensureInit() {
  if (ocr) return ocr;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const modelDir = getModelCacheDir();
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    ocr = await RapidOCR.create({ modelDirectory: modelDir });
    return ocr;
  })();
  return initPromise;
}

async function recognizeBase64(imageBase64) {
  const instance = await ensureInit();
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
}

async function recognizeFile(filePath) {
  const instance = await ensureInit();
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
}

function isRunning() {
  return !!ocr;
}

function getStatus() {
  return { available: !!ocr, ready: !!ocr };
}

async function terminate() {
  if (ocr) {
    await ocr.close();
    ocr = null;
    initPromise = null;
  }
}

module.exports = { ensureInit, recognizeBase64, recognizeFile, getStatus, isRunning, terminate };
