const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { app } = require('electron');
const { detectPythonEnvironment } = require('./pythonEnvService.cjs');

const DEFAULT_CONFIG = {
  port: 8765,
  httpPort: 8766,
  autoRestart: true,
  maxRestarts: 3,
};

let serviceProcess = null;
let serviceConfig = { ...DEFAULT_CONFIG };
let serviceStatus = 'stopped';
let serviceStartTime = null;
let restartCount = 0;
let lastError = null;
let recentLogs = [];
const MAX_LOG_ENTRIES = 100;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
let idleTimer = null;
let isStoppingForIdle = false;

function addLog(level, message) {
  recentLogs.push({ timestamp: Date.now(), level, message });
  if (recentLogs.length > MAX_LOG_ENTRIES) {
    recentLogs = recentLogs.slice(-MAX_LOG_ENTRIES);
  }
}

function resetIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (serviceStatus === 'running' && !isStoppingForIdle) {
    idleTimer = setTimeout(() => {
      if (serviceStatus === 'running') {
        console.log('[Python Service] 空闲超时，自动停止服务');
        isStoppingForIdle = true;
        stopPythonService().finally(() => {
          isStoppingForIdle = false;
        });
      }
    }, IDLE_TIMEOUT_MS);
  }
}

function getServiceDirectory(customDir) {
  if (customDir && fs.existsSync(customDir)) {
    return customDir;
  }
  return null;
}

function getPythonExecutable(customDir) {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) return '';

  const serviceDir = getServiceDirectory(customDir);
  const exeName = process.platform === 'win32' ? 'python-service.exe' : 'python-service';
  return serviceDir ? path.join(serviceDir, exeName) : '';
}

async function getPythonInterpreter(config) {
  if (config.pythonPath && fs.existsSync(config.pythonPath)) {
    return config.pythonPath;
  }

  if (config.venvPath) {
    const venvPython = process.platform === 'win32'
      ? path.join(config.venvPath, 'Scripts', 'python.exe')
      : path.join(config.venvPath, 'bin', 'python');
    if (fs.existsSync(venvPython)) {
      return venvPython;
    }
  }

  const condaPaths = [
    '/opt/anaconda3/bin/python',
    '/opt/anaconda3/bin/python3',
    '/opt/miniconda3/bin/python',
    '/opt/miniconda3/bin/python3',
    path.join(os.homedir(), 'anaconda3', 'bin', 'python'),
    path.join(os.homedir(), 'anaconda3', 'bin', 'python3'),
    path.join(os.homedir(), 'miniconda3', 'bin', 'python'),
    path.join(os.homedir(), 'miniconda3', 'bin', 'python3'),
  ];

  for (const condaPath of condaPaths) {
    if (fs.existsSync(condaPath)) {
      return condaPath;
    }
  }

  const env = await detectPythonEnvironment({ timeout: 5000 });
  if (env.python3Path) {
    return env.python3Path;
  }
  if (env.pythonPath) {
    return env.pythonPath;
  }

  return process.platform === 'win32' ? 'python' : 'python3';
}

async function startPythonService(config = {}) {
  serviceConfig = { ...DEFAULT_CONFIG, ...config };

  if (serviceProcess && serviceStatus === 'running') {
    return { success: false, error: '服务已在运行中' };
  }

  try {
    serviceStatus = 'starting';
    addLog('info', '正在启动 Python 服务...');

    const serviceDir = getServiceDirectory(serviceConfig.customDir);
    if (!serviceDir) {
      addLog('error', 'Python服务目录不存在，请确保已正确安装OCR插件');
      lastError = 'Python服务目录不存在，请确保已正确安装OCR插件';
      serviceStatus = 'error';
      return {
        success: false,
        error: lastError,
      };
    }
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const packagedExePath = getPythonExecutable(serviceConfig.customDir);

    let execPath;
    let execArgs;

    if (isDev || !packagedExePath || !fs.existsSync(packagedExePath)) {
      const pythonPath = await getPythonInterpreter(serviceConfig);
      const modeText = isDev ? '开发模式' : '生产模式（回退到 Python）';
      addLog('info', `${modeText} - 使用 Python: ${pythonPath}`);

      const scriptPath = serviceConfig.scriptPath || path.join(serviceDir, 'main.py');
      addLog('info', `服务脚本路径: ${scriptPath}`);
      
      execPath = pythonPath;
      execArgs = [scriptPath];
    } else {
      addLog('info', `生产模式 - 使用可执行文件: ${packagedExePath}`);
      execPath = packagedExePath;
      execArgs = [];
    }

    const env = {};
    for (const key of Object.keys(process.env)) {
      const value = process.env[key];
      if (typeof value === 'string') {
        env[key] = value;
      }
    }
    env.PYTHONUNBUFFERED = '1';
    env.PYTHONIOENCODING = 'utf-8';
    env.SERVICE_PORT = String(serviceConfig.port || 8765);
    env.WS_HOST = '127.0.0.1';
    env.WS_PORT = String(serviceConfig.wsPort || 8765);
    env.HTTP_PORT = String(serviceConfig.httpPort || 8766);
    if (serviceConfig.env) {
      for (const key of Object.keys(serviceConfig.env)) {
        env[key] = String(serviceConfig.env[key]);
      }
    }

    let stderrOutput = '';

    serviceProcess = spawn(execPath, execArgs, {
      cwd: serviceConfig.workDir || serviceDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    serviceStartTime = Date.now();
    serviceStatus = 'starting';
    restartCount = 0;
    lastError = null;

    serviceProcess.stdout?.on('data', (data) => {
      const message = data.toString('utf-8').trim();
      if (message) {
        addLog('info', message);
        console.log(`[Python Service] ${message}`);
      }
    });

    serviceProcess.stderr?.on('data', (data) => {
      const message = data.toString('utf-8').trim();
      stderrOutput += message + '\n';
      if (message) {
        addLog('warn', message);
        console.warn(`[Python Service] ${message}`);
      }
    });

    serviceProcess.on('close', (code, signal) => {
      const wasRunning = serviceStatus === 'running';
      serviceProcess = null;
      serviceStartTime = null;

      if (signal) {
        addLog('info', `服务被信号 ${signal} 终止`);
      } else if (code !== 0) {
        addLog('error', `服务异常退出，退出码: ${code}`);
        const stderrSummary = stderrOutput.trim().split('\n').slice(-10).join('\n');
        lastError = `服务异常退出，退出码: ${code}${stderrSummary ? '\nPython错误输出:\n' + stderrSummary : ''}`;
        serviceStatus = 'error';
      } else {
        addLog('info', '服务已正常停止');
      }

      if (wasRunning && serviceConfig.autoRestart && restartCount < (serviceConfig.maxRestarts || 3)) {
        restartCount++;
        addLog('info', `自动重启服务 (${restartCount}/${serviceConfig.maxRestarts})...`);
        setTimeout(() => {
          startPythonService(serviceConfig);
        }, 2000);
      } else {
        serviceStatus = 'stopped';
      }
    });

    serviceProcess.on('error', (err) => {
      addLog('error', `进程错误: ${err.message}`);
      lastError = err.message;
      serviceStatus = 'error';
      serviceProcess = null;
    });

    addLog('info', `Python 服务已启动，PID: ${serviceProcess.pid}`);

    const httpPort = serviceConfig.httpPort || DEFAULT_CONFIG.httpPort;
    addLog('info', `等待 HTTP 服务就绪，端口: ${httpPort}`);
    
    const portReady = await waitForPort(httpPort, 30000);
    if (!portReady) {
      addLog('error', `HTTP 服务启动超时，端口 ${httpPort} 未就绪`);
      const stderrSummary = stderrOutput.trim().split('\n').slice(-10).join('\n');
      lastError = `HTTP 服务启动超时，端口 ${httpPort} 未就绪。请检查 Python 环境和依赖是否正确安装。${stderrSummary ? '\nPython错误输出:\n' + stderrSummary : ''}`;
      serviceStatus = 'error';
      
      try {
        serviceProcess.kill('SIGTERM');
        serviceProcess = null;
      } catch (e) {
        console.error('终止进程失败:', e);
      }
      
      return {
        success: false,
        error: lastError,
      };
    }

    addLog('info', `HTTP 服务已就绪，端口: ${httpPort}`);
    serviceStatus = 'running';
    resetIdleTimer();

    return {
      success: true,
      pid: serviceProcess.pid,
      port: serviceConfig.port,
      httpPort,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    addLog('error', `启动失败: ${errorMessage}`);
    lastError = errorMessage;
    serviceStatus = 'error';

    return { success: false, error: errorMessage };
  }
}

async function stopPythonService() {
  if (!serviceProcess) {
    return { success: true };
  }

  try {
    serviceStatus = 'stopping';
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    addLog('info', '正在停止 Python 服务...');

    if (process.platform === 'win32') {
      serviceProcess.kill('SIGTERM');
      setTimeout(() => {
        if (serviceProcess) {
          serviceProcess.kill('SIGKILL');
        }
      }, 5000);
    } else {
      serviceProcess.kill('SIGTERM');
    }

    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (serviceProcess) {
          serviceProcess.kill('SIGKILL');
        }
        resolve();
      }, 10000);

      serviceProcess?.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    serviceProcess = null;
    serviceStartTime = null;
    serviceStatus = 'stopped';
    addLog('info', 'Python 服务已停止');

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    addLog('error', `停止失败: ${errorMessage}`);

    return { success: false, error: errorMessage };
  }
}

function getPythonServiceInfo() {
  let uptime = null;
  if (serviceStartTime && serviceStatus === 'running') {
    uptime = Math.floor((Date.now() - serviceStartTime) / 1000);
  }

  return {
    status: serviceStatus,
    pid: serviceProcess?.pid || null,
    port: serviceConfig.port || null,
    httpPort: serviceConfig.httpPort || null,
    startedAt: serviceStartTime,
    uptime,
    restartCount,
    lastError,
    recentLogs: [...recentLogs],
  };
}

async function createTestService(serviceDir, scriptPath) {
  if (!fs.existsSync(serviceDir)) {
    fs.mkdirSync(serviceDir, { recursive: true });
  }

  const testScript = `#!/usr/bin/env python3
"""
AI Agent Python Service - Test Mode
"""
import os
import sys
import time
import json
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

class OCRHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/ocr/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'data': {'available': True, 'message': 'OCR service ready'}
            }).encode('utf-8'))
        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ocr_available': True}).encode('utf-8'))
    
    def do_POST(self):
        if self.path == '/api/ocr/recognize':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data)
                image_data = data.get('image_base64', '')
                text = '测试识别结果 - 这是一个测试文本' if image_data else ''
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'data': {
                        'text': text,
                        'blocks': [{'text': text, 'confidence': 95, 'box': [[0,0], [100,0], [100,20], [0,20]]}]
                    }
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))

def main():
    port = int(os.environ.get("HTTP_PORT", 8766))
    print(f"[Python Service] Starting HTTP server on port {port}")
    print(f"[Python Service] Python version: {sys.version}")
    
    server = HTTPServer(('127.0.0.1', port), OCRHandler)
    print(f"[Python Service] Server running on http://127.0.0.1:{port}")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[Python Service] Shutting down...")
        server.server_close()

if __name__ == "__main__":
    main()
`;

  fs.writeFileSync(scriptPath, testScript, 'utf-8');
  addLog('info', `已创建测试服务脚本: ${scriptPath}`);
}

function cleanup() {
  if (serviceProcess) {
    serviceProcess.kill('SIGTERM');
    serviceProcess = null;
  }
}

function getHttpPort() {
  return serviceConfig.httpPort || 8766;
}

function isRunning() {
  return serviceStatus === 'running';
}

async function waitForPort(port, maxWaitMs = 10000, intervalMs = 200) {
  const startTime = Date.now();
  let attempts = 0;

  return new Promise((resolve) => {
    const checkPort = () => {
      if (Date.now() - startTime >= maxWaitMs) {
        resolve(false);
        return;
      }

      const socket = new net.Socket();
      socket.setTimeout(100);
      attempts++;

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        const delay = Math.min(intervalMs * Math.pow(2, attempts - 1), 2000);
        setTimeout(checkPort, delay);
      });

      socket.on('error', () => {
        socket.destroy();
        const delay = Math.min(intervalMs * Math.pow(2, attempts - 1), 2000);
        setTimeout(checkPort, delay);
      });

      socket.connect(port, '127.0.0.1');
    };

    checkPort();
  });
}

module.exports = {
  startPythonService,
  stopPythonService,
  getPythonServiceInfo,
  cleanup,
  getHttpPort,
  isRunning,
  waitForPort,
  resetIdleTimer,
};