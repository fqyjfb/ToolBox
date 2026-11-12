const { contextBridge, ipcRenderer, webUtils } = require('electron');

let configChangedCallback = null;
let appearanceChangedCallback = null;
let themeChangedCallback = null;
let petStateCallback = null;
let petCardCallback = null;

ipcRenderer.on('float-config-changed', (event, config) => {
  if (configChangedCallback) {
    configChangedCallback(config);
  }
});

ipcRenderer.on('appearance-changed', (event, data) => {
  if (appearanceChangedCallback) {
    appearanceChangedCallback(data);
  }
});

ipcRenderer.on('theme-changed', (event, data) => {
  if (themeChangedCallback) {
    themeChangedCallback(data);
  }
});

// AI 请求生命周期驱动的桌宠状态（thinking / speaking / happy / sad）
ipcRenderer.on('float:pet-state', (event, data) => {
  if (petStateCallback) {
    petStateCallback(data);
  }
});

// 可交互气泡卡片（剪贴板提示、待办提醒等）
ipcRenderer.on('float-pet-card', (event, data) => {
  if (petCardCallback) {
    petCardCallback(data);
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  dragStart: () => ipcRenderer.send('float-drag-start'),
  dragMove: () => ipcRenderer.send('float-drag-move'),
  dragEnd: () => ipcRenderer.send('float-drag-end'),
  showContextMenu: () => ipcRenderer.send('float-show-context-menu'),
  floatAction: (action) => ipcRenderer.send('float-window-action', action),
  setInteractiveCard: (active) => ipcRenderer.send('float:interactive-card', Boolean(active)),
  getFloatConfig: () => ipcRenderer.invoke('get-float-config'),
  getFloatConfigWithIcons: () => ipcRenderer.invoke('get-float-config-with-icons'),
  setExpanded: (expanded) => ipcRenderer.send('float-expanded', expanded),
  onConfigChanged: (callback) => {
    configChangedCallback = callback;
  },
  getAppearance: () => ipcRenderer.invoke('float-get-appearance'),
  onAppearanceChanged: (callback) => {
    appearanceChangedCallback = callback;
  },
  getTheme: () => ipcRenderer.invoke('float-get-theme'),
  onThemeChanged: (callback) => {
    themeChangedCallback = callback;
  },
  onPetState: (callback) => {
    petStateCallback = callback;
  },
  onPetCard: (callback) => {
    petCardCallback = callback;
  },
  // P2-3/P2-4 拖入文件：Electron 42 起必须用 webUtils.getPathForFile 取真实路径
  getPathForFile: (file) => {
    try { return webUtils.getPathForFile(file); } catch { return ''; }
  },
  shelfAdd: (paths) => ipcRenderer.invoke('float:shelf-add', paths),
  setDragOver: (active) => ipcRenderer.send('float:drag-over', Boolean(active)),
  // 球体命中上报：替代主进程 250ms 光标轮询，决定窗口是否穿透
  setBallHover: (active) => ipcRenderer.send('float:ball-hover', Boolean(active)),
  getGesturesEnabled: () => ipcRenderer.invoke('float:gestures-enabled'),
});
