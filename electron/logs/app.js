(function() {
  let allLogs = [];
  let settings = {
    enabled: false,
    maxEntries: 500,
    levels: { error: true, warn: true, info: false, debug: false },
    showTimestamp: true,
    autoClean: true
  };

  const levelIcons = {
    error: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    warn: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    debug: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 4v4l3 3"></path></svg>'
  };

  async function loadSettings() {
    try {
      const saved = await window.logAPI.getSettings();
      if (saved) {
        settings = { ...settings, ...saved };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return settings;
  }

  async function loadLogs() {
    try {
      const saved = await window.logAPI.getLogs();
      if (saved) {
        allLogs = saved;
      }
    } catch (e) {
      console.error('Failed to load logs:', e);
      allLogs = [];
    }
    return allLogs;
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function highlightText(text, keyword) {
    if (!keyword) return escapeHtml(text);
    const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
    const escaped = escapeHtml(text);
    return escaped.replace(regex, '<span class="highlight">$1</span>');
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getTimeRangeMs(value) {
    const map = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    return map[value] || 0;
  }

  function updateStats() {
    const stats = { error: 0, warn: 0, info: 0, debug: 0, total: allLogs.length };
    allLogs.forEach(log => {
      if (stats[log.level] !== undefined) {
        stats[log.level]++;
      }
    });

    document.getElementById('statError').textContent = stats.error;
    document.getElementById('statWarn').textContent = stats.warn;
    document.getElementById('statInfo').textContent = stats.info;
    document.getElementById('statDebug').textContent = stats.debug;
    document.getElementById('statTotal').textContent = stats.total;
  }

  function updateModuleFilter() {
    const modules = new Set();
    allLogs.forEach(log => {
      if (log.context) modules.add(log.context);
    });

    const select = document.getElementById('moduleFilter');
    const currentValue = select.value;
    select.innerHTML = '<option value="all">全部模块</option>';

    Array.from(modules).sort().forEach(module => {
      const option = document.createElement('option');
      option.value = module;
      option.textContent = module;
      select.appendChild(option);
    });

    if (Array.from(modules).includes(currentValue)) {
      select.value = currentValue;
    }
  }

  function renderLogs() {
    const searchText = document.getElementById('searchInput').value.trim();
    const levelFilter = document.getElementById('levelFilter').value;
    const moduleFilter = document.getElementById('moduleFilter').value;
    const timeFilter = document.getElementById('timeFilter').value;

    const now = Date.now();
    const timeRangeMs = getTimeRangeMs(timeFilter);

    let filteredLogs = allLogs.filter(log => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (moduleFilter !== 'all' && log.context !== moduleFilter) return false;
      if (timeRangeMs > 0 && (now - log.timestamp) > timeRangeMs) return false;
      if (searchText && !log.message.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });

    const logList = document.getElementById('logList');
    const emptyState = document.getElementById('emptyState');

    if (filteredLogs.length === 0) {
      logList.innerHTML = '';
      logList.appendChild(emptyState);
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';

    const fragment = document.createDocumentFragment();

    filteredLogs.slice().reverse().forEach(log => {
      const entry = document.createElement('div');
      entry.className = `log-entry ${log.level}`;

      const header = document.createElement('div');
      header.className = 'log-entry-header';

      const levelSpan = document.createElement('span');
      levelSpan.className = `log-level ${log.level}`;
      levelSpan.innerHTML = `${levelIcons[log.level]}${log.level.toUpperCase()}`;

      const contextSpan = document.createElement('span');
      contextSpan.className = 'log-context';
      contextSpan.textContent = `[${log.context || 'App'}]`;

      const timestampSpan = document.createElement('span');
      timestampSpan.className = 'log-timestamp';
      timestampSpan.textContent = settings.showTimestamp ? formatTime(log.timestamp) : '';

      header.appendChild(levelSpan);
      header.appendChild(contextSpan);
      if (settings.showTimestamp) header.appendChild(timestampSpan);

      const messageDiv = document.createElement('div');
      messageDiv.className = 'log-message';
      messageDiv.innerHTML = highlightText(log.message, searchText);

      entry.appendChild(header);
      entry.appendChild(messageDiv);

      if (log.stack) {
        const stackDiv = document.createElement('div');
        stackDiv.className = 'log-stack';
        stackDiv.textContent = log.stack;
        entry.appendChild(stackDiv);
      }

      fragment.appendChild(entry);
    });

    logList.innerHTML = '';
    logList.appendChild(fragment);
  }

  async function init() {
    await loadSettings();
    await loadLogs();
    updateStats();
    updateModuleFilter();
    renderLogs();

    document.getElementById('searchInput').addEventListener('input', renderLogs);
    document.getElementById('levelFilter').addEventListener('change', renderLogs);
    document.getElementById('moduleFilter').addEventListener('change', renderLogs);
    document.getElementById('timeFilter').addEventListener('change', renderLogs);

    document.getElementById('btnRefresh').addEventListener('click', async () => {
      const logs = await window.logAPI.refreshLogs();
      allLogs = logs;
      updateStats();
      updateModuleFilter();
      renderLogs();
    });

    document.getElementById('btnClear').addEventListener('click', async () => {
      if (confirm('确定要清空所有日志吗？')) {
        await window.logAPI.clearLogs();
        allLogs = [];
        updateStats();
        updateModuleFilter();
        renderLogs();
      }
    });

    document.getElementById('btnExport').addEventListener('click', async () => {
      const data = await window.logAPI.exportLogs();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `toolbox_logs_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    document.getElementById('btnClose').addEventListener('click', () => {
      window.logAPI.closeWindow();
    });

    window.logAPI.onLogsUpdated((logs) => {
      allLogs = logs;
      updateStats();
      updateModuleFilter();
      renderLogs();
    });

    window.logAPI.onSettingsUpdated((newSettings) => {
      settings = newSettings;
      updateStats();
      updateModuleFilter();
      renderLogs();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init().catch(console.error);
    });
  } else {
    init().catch(console.error);
  }
})();
