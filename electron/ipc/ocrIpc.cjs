/**
 * OCR 识别 IPC 处理器
 *
 * 处理图片文字识别
 * 支持按需启动Python服务，空闲自动停止
 */

const { ipcMain } = require("electron");

let ocrIpcRegistered = false;
const { get, post, waitForPythonApi } = require("../services/pythonApiClient.cjs");
const { startPythonService, stopPythonService, isRunning, resetIdleTimer, getPythonServiceInfo } = require("../services/pythonProcessService.cjs");

function formatError(error) {
  const errorStr = String(error);
  if (errorStr.includes("ECONNREFUSED")) {
    return "OCR服务不可用：Python服务未启动或端口未就绪。请重启应用或检查Python环境配置。";
  }
  if (errorStr.includes("ETIMEDOUT") || errorStr.includes("timeout")) {
    return "OCR服务响应超时，请稍后重试。";
  }
  if (errorStr.includes("ENOENT")) {
    return "OCR服务文件不存在，请检查应用安装是否完整。";
  }
  return errorStr;
}

async function ensurePythonServiceRunning(customDir) {
  if (isRunning()) {
    resetIdleTimer();
    return true;
  }

  console.log('[OCR] Python服务未运行，按需启动...');
  const result = await startPythonService({ autoRestart: true, maxRestarts: 3, customDir });
  if (result.success) {
    const apiReady = await waitForPythonApi(20000, 500);
    if (apiReady) {
      console.log('[OCR] Python服务已就绪');
      return true;
    }
    console.warn('[OCR] Python服务API未就绪');
    return false;
  }
  console.warn('[OCR] Python服务启动失败:', result.error);
  return false;
}

async function runDiagnose(serviceDir) {
  const { spawn } = require('child_process');
  const path = require('path');
  const fs = require('fs');

  return new Promise((resolve) => {
    if (!serviceDir) {
      resolve({
        success: false,
        error: '服务目录未指定，请确保已正确安装OCR插件',
        output: '',
      });
      return;
    }

    const scriptPath = path.join(serviceDir, 'diagnose.py');

    if (!fs.existsSync(scriptPath)) {
      resolve({
        success: false,
        error: '诊断脚本不存在',
        output: '',
      });
      return;
    }

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const cleanEnv = {};
    for (const key of Object.keys(process.env)) {
      const value = process.env[key];
      if (typeof value === 'string') {
        cleanEnv[key] = value;
      }
    }
    cleanEnv.PYTHONIOENCODING = 'utf-8';
    cleanEnv.PYTHONUNBUFFERED = '1';
    const proc = spawn(pythonCmd, [scriptPath], {
      cwd: serviceDir,
      env: cleanEnv,
    });

    let output = '';
    let errorOutput = '';

    proc.stdout?.on('data', (data) => {
      output += data.toString('utf-8');
    });

    proc.stderr?.on('data', (data) => {
      errorOutput += data.toString('utf-8');
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output,
        error: errorOutput,
        exitCode: code,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
        output: '',
      });
    });

    setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
        resolve({
          success: false,
          error: '诊断超时',
          output: output,
        });
      }
    }, 30000);
  });
}

async function installPythonDeps(serviceDir, force) {
  const { spawn } = require('child_process');
  const path = require('path');
  const fs = require('fs');

  return new Promise((resolve) => {
    if (!serviceDir) {
      resolve({
        success: false,
        error: '服务目录未指定，请确保已正确安装OCR插件',
        output: '',
      });
      return;
    }

    const scriptPath = path.join(serviceDir, 'install_deps.py');

    if (!fs.existsSync(scriptPath)) {
      resolve({
        success: false,
        error: '安装脚本不存在',
        output: '',
      });
      return;
    }

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const args = [scriptPath];
    if (force) {
      args.push('--force');
    }
    const cleanEnv = {};
    for (const key of Object.keys(process.env)) {
      const value = process.env[key];
      if (typeof value === 'string') {
        cleanEnv[key] = value;
      }
    }
    cleanEnv.PYTHONIOENCODING = 'utf-8';
    cleanEnv.PYTHONUNBUFFERED = '1';
    const proc = spawn(pythonCmd, args, {
      cwd: serviceDir,
      env: cleanEnv,
    });

    let output = '';
    let errorOutput = '';

    proc.stdout?.on('data', (data) => {
      output += data.toString('utf-8');
    });

    proc.stderr?.on('data', (data) => {
      errorOutput += data.toString('utf-8');
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output,
        error: errorOutput,
        exitCode: code,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
        output: '',
      });
    });

    setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
        resolve({
          success: false,
          error: '安装超时（可能需要更长时间，请尝试手动安装）',
          output: output,
        });
      }
    }, 300000);
  });
}

/**
 * 注册 OCR 相关 IPC 处理器
 */
function registerOcrIpc() {
  if (ocrIpcRegistered) return;
  ocrIpcRegistered = true;

  // OCR 识别 Base64 图片（超时时间 60 秒）
  ipcMain.handle("ocr:recognize", async (_event, { imageBase64, serviceDir }) => {
    try {
      const serviceReady = await ensurePythonServiceRunning(serviceDir);
      if (!serviceReady) {
        return JSON.parse(JSON.stringify({
          success: false,
          text: "",
          blocks: [],
          error: "OCR服务启动失败，请检查Python环境配置。",
        }));
      }

      resetIdleTimer();
      const response = await post(
        "/api/ocr/recognize",
        { image_base64: imageBase64 },
        { timeout: 60000 }
      );

      if (response.success && response.data) {
        return JSON.parse(JSON.stringify({
          success: true,
          text: response.data.text || "",
          blocks: response.data.blocks || [],
          error: response.data.error,
        }));
      }

      return JSON.parse(JSON.stringify({
        success: false,
        text: "",
        blocks: [],
        error: response.error ? formatError(response.error) : "OCR 识别失败",
      }));
    } catch (error) {
      return JSON.parse(JSON.stringify({
        success: false,
        text: "",
        blocks: [],
        error: formatError(error),
      }));
    }
  });

  // OCR 识别图片文件（超时时间 60 秒）
  ipcMain.handle("ocr:recognizeFile", async (_event, { filePath, serviceDir }) => {
    try {
      const serviceReady = await ensurePythonServiceRunning(serviceDir);
      if (!serviceReady) {
        return JSON.parse(JSON.stringify({
          success: false,
          text: "",
          blocks: [],
          error: "OCR服务启动失败，请检查Python环境配置。",
        }));
      }

      resetIdleTimer();
      const response = await get(
        `/api/ocr/recognize-file?file_path=${encodeURIComponent(filePath)}`,
        { timeout: 60000 }
      );

      if (response.success && response.data) {
        return JSON.parse(JSON.stringify({
          success: true,
          text: response.data.text || "",
          blocks: response.data.blocks || [],
          error: response.data.error,
        }));
      }

      return JSON.parse(JSON.stringify({
        success: false,
        text: "",
        blocks: [],
        error: response.error ? formatError(response.error) : "OCR 识别失败",
      }));
    } catch (error) {
      return JSON.parse(JSON.stringify({
        success: false,
        text: "",
        blocks: [],
        error: formatError(error),
      }));
    }
  });

  // 获取 OCR 服务状态
  ipcMain.handle("ocr:status", async () => {
    try {
      const serviceInfo = JSON.parse(JSON.stringify(getPythonServiceInfo()));
      
      if (!isRunning()) {
        const result = {
          available: false,
          message: "OCR服务未运行（将在首次使用时自动启动）",
          status: serviceInfo.status,
          lastError: serviceInfo.lastError || null,
          canManualStart: true,
        };
        return JSON.parse(JSON.stringify(result));
      }

      resetIdleTimer();
      const response = await get("/api/ocr/status");

      if (response.success && response.data) {
        const result = {
          available: response.data.available,
          message: response.data.message,
          status: serviceInfo.status,
          pid: serviceInfo.pid,
          uptime: serviceInfo.uptime,
          canManualStart: false,
        };
        return JSON.parse(JSON.stringify(result));
      }

      const result = {
        available: false,
        message: response.error ? formatError(response.error) : "无法获取 OCR 服务状态",
        status: serviceInfo.status,
        lastError: response.error || null,
        canManualStart: false,
      };
      return JSON.parse(JSON.stringify(result));
    } catch (error) {
      const serviceInfo = JSON.parse(JSON.stringify(getPythonServiceInfo()));
      const result = {
        available: false,
        message: formatError(error),
        status: serviceInfo.status,
        lastError: String(error),
        canManualStart: !isRunning(),
      };
      return JSON.parse(JSON.stringify(result));
    }
  });

  // 手动启动 OCR 服务
  ipcMain.handle("ocr:start", async (_event, { serviceDir, httpPort, wsPort, pythonPath, autoRestart, maxRestarts }) => {
    try {
      console.log('[OCR] 用户手动启动 Python 服务...');
      const result = await startPythonService({ 
        autoRestart: autoRestart ?? true, 
        maxRestarts: maxRestarts ?? 3, 
        customDir: serviceDir,
        httpPort,
        wsPort,
        pythonPath 
      });
      
      if (result.success) {
        await waitForPythonApi(15000, 500);
        console.log('[OCR] 手动启动成功');
        return JSON.parse(JSON.stringify({
          success: true,
          message: "OCR服务启动成功",
          pid: result.pid,
        }));
      }
      
      console.warn('[OCR] 手动启动失败:', result.error);
      return JSON.parse(JSON.stringify({
        success: false,
        message: "OCR服务启动失败: " + result.error,
        error: result.error,
      }));
    } catch (error) {
      const errorMessage = formatError(error);
      console.error('[OCR] 手动启动异常:', error);
      return JSON.parse(JSON.stringify({
        success: false,
        message: "OCR服务启动异常: " + errorMessage,
        error: errorMessage,
      }));
    }
  });

  // 手动停止 OCR 服务
  ipcMain.handle("ocr:stop", async () => {
    try {
      console.log('[OCR] 用户手动停止 Python 服务...');
      const result = await stopPythonService();
      
      if (result.success) {
        console.log('[OCR] 手动停止成功');
        return JSON.parse(JSON.stringify({
          success: true,
          message: "OCR服务已停止",
        }));
      }
      
      return JSON.parse(JSON.stringify({
        success: false,
        message: "停止服务失败: " + result.error,
        error: result.error,
      }));
    } catch (error) {
      const errorMessage = formatError(error);
      return JSON.parse(JSON.stringify({
        success: false,
        message: "停止服务异常: " + errorMessage,
        error: errorMessage,
      }));
    }
  });

  // 获取服务详细信息（用于诊断）
  ipcMain.handle("ocr:serviceInfo", async () => {
    try {
      return JSON.parse(JSON.stringify(getPythonServiceInfo()));
    } catch (error) {
      return JSON.parse(JSON.stringify({
        error: String(error),
      }));
    }
  });

  ipcMain.handle("ocr:diagnose", async (_event, { serviceDir }) => {
    try {
      const result = await runDiagnose(serviceDir);
      return JSON.parse(JSON.stringify(result));
    } catch (error) {
      return JSON.parse(JSON.stringify({
        success: false,
        error: String(error && error.message || error),
        output: '',
      }));
    }
  });

  ipcMain.handle("ocr:installDeps", async (_event, { serviceDir, force }) => {
    try {
      const result = await installPythonDeps(serviceDir, force);
      return JSON.parse(JSON.stringify(result));
    } catch (error) {
      return JSON.parse(JSON.stringify({
        success: false,
        error: String(error && error.message || error),
        output: '',
      }));
    }
  });

  // 检查端口是否被占用
  ipcMain.handle("ocr:checkPort", async (_event, port) => {
    try {
      const result = await new Promise((resolve) => {
        const net = require('net');
        const server = net.createServer();

        server.once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            resolve({ success: true, inUse: true, port });
          } else {
            resolve({ success: false, error: err.message });
          }
        });

        server.once('listening', () => {
          server.close();
          resolve({ success: true, inUse: false, port });
        });

        server.listen(port, '127.0.0.1');
      });
      return JSON.parse(JSON.stringify(result));
    } catch (error) {
      return JSON.parse(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  // 选择Python路径
  ipcMain.handle("ocr:selectPythonPath", async () => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Python', extensions: ['exe'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        title: '选择Python解释器'
      });

      if (result.canceled || result.filePaths.length === 0) {
        return JSON.parse(JSON.stringify({ success: false, canceled: true }));
      }

      return JSON.parse(JSON.stringify({ success: true, path: result.filePaths[0] }));
    } catch (error) {
      return JSON.parse(JSON.stringify({ success: false, error: String(error) }));
    }
  });
}

module.exports = {
  registerOcrIpc,
};
