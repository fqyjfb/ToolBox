/**
 * 翻译记录：JSON 文件持久化 + 2s 去抖落盘 + 上限裁剪。
 *
 * 与 TTime 的差异（均为修复项）：
 * 1. 裁剪条件用 `>`（TTime 用 `>=` 会少留一条）；
 * 2. 退出前 before-quit 显式 flushNow()，避免丢掉最后 2s 的写入；
 * 3. 记录结构补强 trigger / created_at / updated_at，便于设置页展示。
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadSettings } = require('../lib/config.cjs');

const HISTORY_VERSION = 1;

const getFilePath = () => path.join(app.getPath('userData'), 'translate-history.json');

let cache = null;
let flushTimer = null;

const toNumber = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const normalizeResult = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  return {
    provider: raw.provider === 'ai' ? 'ai' : 'online',
    provider_ref: typeof raw.provider_ref === 'string' ? raw.provider_ref : '',
    status: raw.status === 'success' ? 'success' : raw.status === 'failed' ? 'failed' : 'pending',
    text: typeof raw.text === 'string' ? raw.text : '',
    pronounce: typeof raw.pronounce === 'string' ? raw.pronounce : '',
    explains: Array.isArray(raw.explains) ? raw.explains.filter((item) => typeof item === 'string') : [],
    error: typeof raw.error === 'string' ? raw.error : '',
    elapsed_ms: toNumber(raw.elapsed_ms, 0),
  };
};

const normalizeRecord = (raw) => {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const now = Date.now();
  return {
    id: raw.id,
    source_text: typeof raw.source_text === 'string' ? raw.source_text : '',
    source_language: typeof raw.source_language === 'string' ? raw.source_language : 'auto',
    source_language_name: typeof raw.source_language_name === 'string' ? raw.source_language_name : '自动检测',
    target_language: typeof raw.target_language === 'string' ? raw.target_language : 'auto',
    target_language_name: typeof raw.target_language_name === 'string' ? raw.target_language_name : '自动检测',
    trigger:
      raw.trigger === 'screenshot' || raw.trigger === 'manual' ? raw.trigger : 'selection',
    created_at: toNumber(raw.created_at, now),
    updated_at: toNumber(raw.updated_at, now),
    results: Array.isArray(raw.results)
      ? raw.results.map(normalizeResult).filter(Boolean)
      : [],
  };
};

const load = () => {
  if (cache) return cache;
  cache = { records: [] };
  try {
    const filePath = getFilePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const records = Array.isArray(data?.records) ? data.records : [];
      cache.records = records.map(normalizeRecord).filter(Boolean);
    }
  } catch (error) {
    console.error('[TranslateHistory] 读取失败:', error.message);
    cache = { records: [] };
  }
  return cache;
};

const writeNow = () => {
  if (!cache) return;
  try {
    fs.writeFileSync(
      getFilePath(),
      JSON.stringify({ version: HISTORY_VERSION, records: cache.records }, null, 2),
    );
  } catch (error) {
    console.error('[TranslateHistory] 写入失败:', error.message);
  }
};

const flushDebounced = () => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    writeNow();
  }, 2000);
  // 项目约定：定时器不阻止应用退出
  flushTimer.unref?.();
};

const trimToLimit = (records) => {
  const limit = Math.max(1, Number(loadSettings().translateHistoryLimit) || 30);
  while (records.length > limit) records.shift();
};

const list = ({ limit, offset } = {}) => {
  const data = load();
  const sorted = [...data.records].sort((a, b) => b.created_at - a.created_at);
  const start = Math.max(0, Number(offset) || 0);
  const size = Math.max(0, Number(limit) || sorted.length);
  return sorted.slice(start, start + size);
};

const save = (record) => {
  if (loadSettings().translateHistoryEnabled !== 1) return { skipped: true };
  const normalized = normalizeRecord(record);
  if (!normalized) return { success: false, error: '记录格式无效' };

  const data = load();
  const index = data.records.findIndex((item) => item.id === normalized.id);
  if (index >= 0) {
    data.records[index] = { ...data.records[index], ...normalized, updated_at: Date.now() };
  } else {
    data.records.push(normalized);
  }
  trimToLimit(data.records);
  flushDebounced();
  return { success: true, record: normalized };
};

const remove = (id) => {
  const data = load();
  const next = data.records.filter((item) => item.id !== id);
  const removed = next.length !== data.records.length;
  if (removed) {
    data.records = next;
    flushDebounced();
  }
  return { success: removed };
};

const clear = () => {
  const data = load();
  data.records = [];
  flushDebounced();
  return { success: true };
};

const flushNow = () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  writeNow();
};

module.exports = { list, save, remove, clear, flushNow };
