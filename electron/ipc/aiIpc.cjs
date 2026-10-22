const { ipcMain } = require('electron');

const DEFAULT_TIMEOUT_MS = 60000;
const MAX_TIMEOUT_MS = 120000;

function normalizeTimeout(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(Math.trunc(num), 1000), MAX_TIMEOUT_MS);
}

function extractContent(data) {
  const message = data?.choices?.[0]?.message;
  if (!message) return '';
  let content = '';
  if (typeof message.content === 'string') content += message.content;
  if (typeof message.reasoning_content === 'string' && message.reasoning_content) content += message.reasoning_content;
  if (Array.isArray(message.content)) {
    content = message.content
      .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
      .join('');
  }
  return content;
}

async function handleChat(_event, payload) {
  const { url, apiKey, body, timeoutMs } = payload || {};

  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return { success: false, error: 'API 地址无效' };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { success: false, error: '请求参数无效' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), normalizeTimeout(timeoutMs));

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (typeof apiKey === 'string' && apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error:
          data?.error?.message ||
          data?.message ||
          `AI 请求失败 (${response.status})`,
      };
    }

    const content = extractContent(data);
    if (!content.trim()) {
      return { success: false, error: 'AI 未返回内容' };
    }

    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: error?.name === 'AbortError' ? 'AI 请求超时' : error?.message || 'AI 请求失败',
    };
  } finally {
    clearTimeout(timer);
  }
}

function registerAIIpc() {
  ipcMain.handle('ai-chat', handleChat);
}

module.exports = { registerAIIpc };
