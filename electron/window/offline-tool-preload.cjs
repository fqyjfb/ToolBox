const { ipcRenderer } = require('electron');

// alert: 异步转发到主进程，以应用内 toast 呈现
window.alert = (message) => {
  ipcRenderer.send('offline-tool:alert', String(message ?? ''));
};

// confirm/prompt: 同步等待主进程风格化模态窗结果，保持原生语义
window.confirm = (message) => {
  return ipcRenderer.sendSync('offline-tool:confirm', {
    message: String(message ?? ''),
    title: document.title,
  });
};

window.prompt = (message, defaultValue) => {
  const result = ipcRenderer.sendSync('offline-tool:prompt', {
    message: String(message ?? ''),
    defaultValue: String(defaultValue ?? ''),
    title: document.title,
  });
  return result.canceled ? null : result.value;
};
