const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { app } = require('electron');
const { detectPythonEnvironment } = require('./pythonEnvService.cjs');
const { setPort: setApiPort } = require('./pythonApiClient.cjs');

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

// ===== 端口配置持久化（修复5） =====
// 注：app.getPath('userData') 在不同 Electron 版本下对 ready 时机要求不一致，
// 采用惰性函数延迟到函数调用时再解析，保证模块加载阶段不依赖 app 状态。
function getConfigFilePath() {
  return path.join(app.getPath('userData'), 'ocr-service-config.json');
}

function loadPersistedConfig() {
  try {
    const configFile = getConfigFilePath();
    if (fs.existsSync(configFile)) {
      return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    }
  } catch (e) {
    console.warn('[Python Service] 读取持久化配置失败:', e.message);
  }
  return {};
}

function savePersistedConfig(config) {
  try {
    const existing = loadPersistedConfig();
    fs.writeFileSync(getConfigFilePath(), JSON.stringify({ ...existing, ...config }, null, 2));
  } catch (e) {
    console.warn('[Python Service] 保存持久化配置失败:', e.message);
  }
}

// ===== 端口工具函数（修复1、修复2） =====
function checkPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      resolve(err.code === 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '127.0.0.1');
  });
}

function getListeningProcessPids(port) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    const cmd = process.platform === 'win32'
      ? `netstat -ano | findstr :${port} | findstr LISTENING`
      : `lsof -ti :${port}`;

    exec(cmd, (err, stdout) => {
      if (err || !stdout.trim()) return resolve([]);
      const pids = new Set();
      if (process.platform === 'win32') {
        for (const line of stdout.trim().split('\n')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') pids.add(pid);
        }
      } else {
        for (const pid of stdout.trim().split('\n')) {
          if (pid.trim()) pids.add(pid.trim());
        }
      }
      resolve([...pids]);
    });
  });
}

function killProcessOnPort(port) {
  return new Promise(async (resolve) => {
    const { exec } = require('child_process');
    const pids = await getListeningProcessPids(port);
    if (pids.length === 0) return resolve(false);

    let killedCount = 0;
    let pending = pids.length;
    for (const pid of pids) {
      const killCmd = process.platform === 'win32'
        ? `taskkill /F /PID ${pid}`
        : `kill -9 ${pid}`;
      exec(killCmd, (killErr) => {
        if (!killErr) killedCount++;
        if (--pending === 0) resolve(killedCount > 0);
      });
    }
  });
}

function waitForPortFree(port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      checkPortInUse(port).then((inUse) => {
        if (!inUse) resolve(true);
        else if (Date.now() - start >= timeoutMs) resolve(false);
        else setTimeout(check, 200);
      });
    };
    check();
  });
}

async function findAvailablePort(preferredPort, maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = preferredPort + i;
    if (port > 65535) break;
    if (!(await checkPortInUse(port))) return port;
  }
  return null;
}

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
  // 修复5：合并持久化配置（优先级：传入config > 持久化配置 > 默认值）
  const persisted = loadPersistedConfig();
  serviceConfig = { ...DEFAULT_CONFIG, ...persisted, ...config };

  // 若本次传入了端口配置，持久化保存
  if (config.httpPort) {
    savePersistedConfig({
      httpPort: config.httpPort,
      wsPort: config.wsPort,
      pythonPath: config.pythonPath,
    });
  }

  setApiPort(serviceConfig.httpPort || DEFAULT_CONFIG.httpPort);

  if (serviceProcess && serviceStatus === 'running') {
    return { success: false, error: '服务已在运行中' };
  }

  try {
    serviceStatus = 'starting';
    addLog('info', '正在启动 Python 服务...');

    // 修复1：启动前检测端口占用并清理残留进程
    let httpPort = serviceConfig.httpPort || DEFAULT_CONFIG.httpPort;
    const portInUse = await checkPortInUse(httpPort);
    if (portInUse) {
      addLog('warn', `端口 ${httpPort} 已被占用，正在清理残留进程...`);
      const killed = await killProcessOnPort(httpPort);
      if (killed) {
        addLog('info', `已清理占用端口 ${httpPort} 的进程`);
        const freed = await waitForPortFree(httpPort, 5000);
        if (!freed) {
          addLog('warn', `端口 ${httpPort} 未及时释放，尝试备用端口...`);
          const fallbackPort = await findAvailablePort(httpPort);
          if (fallbackPort) {
            addLog('info', `切换到备用端口: ${fallbackPort}`);
            httpPort = fallbackPort;
            serviceConfig.httpPort = fallbackPort;
            setApiPort(fallbackPort);
          } else {
            lastError = `端口 ${httpPort} 被占用且无可用备用端口，请手动释放或更换端口`;
            serviceStatus = 'error';
            return { success: false, error: lastError };
          }
        }
      } else {
        // 无法自动清理（可能是其他应用），尝试备用端口
        addLog('warn', `端口 ${httpPort} 被其他进程占用，尝试备用端口...`);
        const fallbackPort = await findAvailablePort(httpPort);
        if (fallbackPort) {
          addLog('info', `切换到备用端口: ${fallbackPort}`);
          httpPort = fallbackPort;
          serviceConfig.httpPort = fallbackPort;
          setApiPort(fallbackPort);
        } else {
          lastError = `端口 ${httpPort} 被占用且无可用备用端口，请手动释放或更换端口`;
          serviceStatus = 'error';
          return { success: false, error: lastError };
        }
      }
    }

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
    env.HTTP_PORT = String(httpPort);
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

        // 修复3：检测端口绑定失败
        const portErrorPatterns = [
          /address already in use/i,
          /WinError 10048/i,
          /error while attempting to bind/i,
          /EADDRINUSE/i,
        ];
        if (portErrorPatterns.some(p => p.test(message))) {
          lastError = `端口 ${httpPort} 绑定失败：${message}`;
          serviceStatus = 'error';
        }
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

    addLog('info', `等待 HTTP 服务就绪，端口: ${httpPort}`);
    
    const { success: portReady, cancel: cancelPortWait } = await waitForPort(httpPort, 30000, 200, () => serviceStatus === 'error');
    
    if (serviceStatus === 'error' && lastError) {
      cancelPortWait();
      addLog('error', `服务启动失败: ${lastError}`);
      const errorMsg = `OCR服务依赖未安装或已损坏，请运行安装依赖功能`;
      return {
        success: false,
        error: lastError.includes('依赖') ? errorMsg : lastError,
      };
    }
    
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

    // 修复2：校验监听端口的进程是否为本次启动的进程
    const listenerPids = await getListeningProcessPids(httpPort);
    const currentPid = String(serviceProcess.pid);
    if (listenerPids.length > 0 && !listenerPids.includes(currentPid)) {
      addLog('error', `端口 ${httpPort} 被其他进程(PID:${listenerPids.join(',')})占用，当前进程 PID: ${currentPid}`);
      lastError = `端口 ${httpPort} 被进程 ${listenerPids.join(',')} 占用，请先终止该进程`;
      serviceStatus = 'error';
      try { serviceProcess.kill('SIGKILL'); } catch {}
      serviceProcess = null;
      return { success: false, error: lastError };
    }

    addLog('info', `HTTP 服务已就绪，端口: ${httpPort}，进程校验通过`);
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

    let sigkillTimer = null;
    if (process.platform === 'win32') {
      serviceProcess.kill('SIGTERM');
      sigkillTimer = setTimeout(() => {
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
        if (sigkillTimer) {
          clearTimeout(sigkillTimer);
          sigkillTimer = null;
        }
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

function isRunning() {
  return serviceStatus === 'running';
}

async function waitForPort(port, maxWaitMs = 10000, intervalMs = 200, abortCondition) {
  const startTime = Date.now();
  let attempts = 0;
  let cancelled = false;
  let cleanup = null;

  const cancelWait = () => {
    cancelled = true;
    if (cleanup) cleanup();
  };

  const result = await new Promise((resolve) => {
    const checkPort = () => {
      if (cancelled) {
        resolve(false);
        return;
      }
      if (abortCondition && abortCondition()) {
        resolve(false);
        return;
      }
      if (Date.now() - startTime >= maxWaitMs) {
        resolve(false);
        return;
      }

      const socket = new net.Socket();
      socket.setTimeout(100);
      attempts++;

      const onComplete = () => {
        socket.destroy();
      };

      socket.on('connect', () => {
        onComplete();
        resolve(true);
      });

      socket.on('timeout', () => {
        onComplete();
        const delay = Math.min(intervalMs * Math.pow(2, attempts - 1), 2000);
        setTimeout(checkPort, delay);
      });

      socket.on('error', () => {
        onComplete();
        const delay = Math.min(intervalMs * Math.pow(2, attempts - 1), 2000);
        setTimeout(checkPort, delay);
      });

      socket.connect(port, '127.0.0.1');
    };

    cleanup = () => {
      try {
        const s = new net.Socket();
        s.destroy();
      } catch {}
    };

    checkPort();
  });

  return { success: result, cancel: cancelWait };
}

module.exports = {
  startPythonService,
  stopPythonService,
  getPythonServiceInfo,
  isRunning,
  resetIdleTimer,
  killProcessOnPort,
  getListeningProcessPids,
  checkPortInUse,
  waitForPortFree,
};
