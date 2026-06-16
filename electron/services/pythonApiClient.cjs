/**
 * Python 数据服务 HTTP API 客户端
 *
 * 封装与 Python FastAPI 数据服务的通信，提供：
 * 1. 统一的 HTTP 请求方法
 * 2. 错误处理和重试逻辑
 * 3. 健康检查
 */

const http = require("http");

// Python HTTP 服务配置
const PYTHON_API_HOST = "127.0.0.1";
const PYTHON_API_PORT = 8766;
const PYTHON_API_BASE = `http://${PYTHON_API_HOST}:${PYTHON_API_PORT}`;

// 请求超时时间（毫秒）
const DEFAULT_TIMEOUT = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 500;

/**
 * 检查 Python HTTP 服务是否可用
 */
async function checkPythonApiHealth() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: PYTHON_API_HOST,
        port: PYTHON_API_PORT,
        path: "/health",
        method: "GET",
        timeout: 2000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json.status === "healthy");
          } catch {
            resolve(false);
          }
        });
      }
    );

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * 等待 Python HTTP 服务就绪
 */
async function waitForPythonApi(maxWaitMs = 15000, intervalMs = 500) {
  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < maxWaitMs) {
    if (await checkPythonApiHealth()) {
      console.log(`[PythonApiClient] Python HTTP 服务已就绪 (${attempts}次尝试)`);
      return true;
    }
    attempts++;
    const delay = Math.min(intervalMs * Math.pow(2, attempts - 1), 2000);
    await sleep(delay);
  }

  console.error("[PythonApiClient] 等待 Python HTTP 服务超时");
  return false;
}

/**
 * 发送 GET 请求
 */
async function get(path, options) {
  return request(path, { ...options, method: "GET" });
}

/**
 * 发送 POST 请求
 */
async function post(path, body, options) {
  return request(path, { ...options, method: "POST", body });
}

/**
 * 发送 PUT 请求
 */
async function put(path, body, options) {
  return request(path, { ...options, method: "PUT", body });
}

/**
 * 发送 DELETE 请求
 */
async function del(path, options) {
  return request(path, { ...options, method: "DELETE" });
}

/**
 * 发送 HTTP 请求
 */
async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    timeout = DEFAULT_TIMEOUT,
    retries = MAX_RETRIES,
    headers = {},
  } = options;

  const url = path.startsWith("http") ? path : `${PYTHON_API_BASE}${path}`;
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await httpRequest(url, {
        method,
        body,
        timeout,
        headers,
      });
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[PythonApiClient] 请求失败 (尝试 ${attempt}/${retries}): ${path}`,
        error
      );

      if (attempt < retries) {
        await sleep(RETRY_DELAY * attempt);
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || "请求失败",
  };
}

/**
 * 底层 HTTP 请求实现
 */
function httpRequest(url, options) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyData = options.body ? JSON.stringify(options.body) : undefined;

    const req = http.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 80,
        path: urlObj.pathname + urlObj.search,
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
          ...(bodyData
            ? { "Content-Length": Buffer.byteLength(bodyData) }
            : {}),
        },
        timeout: options.timeout,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch {
            reject(new Error(`Invalid JSON response: ${data.slice(0, 100)}`));
          }
        });
      }
    );

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  checkPythonApiHealth,
  waitForPythonApi,
  get,
  post,
  put,
  delete: del,
  config: {
    host: PYTHON_API_HOST,
    port: PYTHON_API_PORT,
    baseUrl: PYTHON_API_BASE,
  },
};
