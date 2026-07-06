const os = require('os');

function getOSVersion() {
  if (process.platform !== 'win32') {
    return os.version();
  }

  try {
    const { execSync } = require('child_process');
    const output = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v ProductName /v DisplayVersion /v CurrentBuild /v UBR',
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    );

    const lines = output.split('\n');
    let productName = '';
    let displayVersion = '';
    let currentBuild = '';
    let ubr = '';

    lines.forEach(line => {
      if (line.includes('ProductName')) {
        productName = line.split('REG_SZ')[1]?.trim() || '';
      } else if (line.includes('DisplayVersion')) {
        displayVersion = line.split('REG_SZ')[1]?.trim() || '';
      } else if (line.includes('CurrentBuild')) {
        currentBuild = line.split('REG_SZ')[1]?.trim() || '';
      } else if (line.includes('UBR')) {
        ubr = line.split('REG_DWORD')[1]?.trim() || '';
        if (ubr) {
          ubr = parseInt(ubr, 16).toString();
        }
      }
    });

    if (!productName) {
      return 'Microsoft Windows';
    }

    const buildNum = parseInt(currentBuild, 10) || 0;
    if (buildNum >= 22000 && productName.includes('Windows 10')) {
      productName = productName.replace('Windows 10', 'Windows 11');
    }

    if (displayVersion) {
      return `${productName} ${displayVersion} (Build ${currentBuild}.${ubr})`;
    }
    return `${productName} (Build ${currentBuild}.${ubr})`;
  } catch {
    return 'Microsoft Windows';
  }
}

function getCPUInfo() {
  if (process.platform !== 'win32') {
    return os.cpus()[0]?.model || '未知处理器';
  }

  try {
    const { execSync } = require('child_process');
    const output = execSync(
      'reg query "HKLM\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0" /v ProcessorNameString',
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    );

    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('ProcessorNameString')) {
        const value = line.split('REG_SZ')[1]?.trim();
        if (value) {
          return value;
        }
      }
    }
  } catch {}

  return os.cpus()[0]?.model || '未知处理器';
}

function getSystemInfo() {
  const cpus = os.cpus();

  return {
    os_name: 'Microsoft Windows',
    os_version: getOSVersion(),
    os_arch: os.arch() === 'x64' ? 'x64 (64位)' : os.arch() === 'ia32' ? 'x86 (32位)' : os.arch(),
    computer_name: os.hostname(),
    user_name: os.userInfo().username,
    cpu_info: getCPUInfo(),
    cpu_cores: cpus.length,
    total_memory: os.totalmem(),
    available_memory: os.freemem(),
    uptime_seconds: Math.floor(os.uptime()),
  };
}

module.exports = {
  getSystemInfo,
};