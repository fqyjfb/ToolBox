const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const fs = require('fs');

const execAsync = promisify(exec);

const DEFAULT_OPTIONS = {
  timeout: 30000,
  checkPip: true,
  checkPoetry: true,
  checkConda: false,
};

let cachedEnv = null;
const CACHE_DURATION = 30000;

function getOSType() {
  const platform = process.platform;
  if (platform === 'darwin') return 'darwin';
  if (platform === 'win32') return 'win32';
  if (platform === 'linux') return 'linux';
  return 'unknown';
}

async function safeExec(command, timeout = 30000) {
  try {
    const result = await execAsync(command, { timeout, encoding: 'utf-8' });
    return result;
  } catch {
    return null;
  }
}

async function detectPythonPath(osType, timeout) {
  let pythonPath = null;
  let python3Path = null;

  if (osType === 'win32') {
    const pythonResult = await safeExec('where python', timeout);
    if (pythonResult?.stdout) {
      pythonPath = pythonResult.stdout.split('\n')[0].trim();
    }

    if (!pythonPath && timeout > 2000) {
      const python3Result = await safeExec('where python3', Math.min(timeout - 2000, 3000));
      if (python3Result?.stdout) {
        python3Path = python3Result.stdout.split('\n')[0].trim();
      }
    }
  } else {
    const pythonResult = await safeExec('which python', timeout);
    if (pythonResult?.stdout) {
      pythonPath = pythonResult.stdout.trim();
    }

    const python3Result = await safeExec('which python3', timeout);
    if (python3Result?.stdout) {
      python3Path = python3Result.stdout.trim();
    }
  }

  return { pythonPath, python3Path };
}

async function detectPythonEnvironment(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const timeout = opts.timeout || 30000;
  const osType = getOSType();

  if (cachedEnv && Date.now() - cachedEnv.timestamp < CACHE_DURATION) {
    return cachedEnv.data;
  }

  const { pythonPath, python3Path } = await detectPythonPath(osType, timeout);

  const result = {
    os: osType,
    pythonPath,
    python3Path,
  };

  cachedEnv = { timestamp: Date.now(), data: result };
  return result;
}

function clearEnvCache() {
  cachedEnv = null;
}

module.exports = {
  detectPythonEnvironment,
  clearEnvCache,
};
