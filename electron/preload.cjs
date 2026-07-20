const { contextBridge, ipcRenderer, webUtils } = require('electron');

let navigateCallback = null;
let downloadProgressCallback = null;
let settingChangedCallback = null;
let openAddTodoCallback = null;
let openAddMemoCallback = null;

const screenshotApi = {
  startScreenshotCapture: () => ipcRenderer.invoke('start-screenshot-capture'),
  cancelScreenshot: () => ipcRenderer.send('cancel-screenshot'),
  saveScreenshot: (data) => ipcRenderer.invoke('save-screenshot', data),
  copyScreenshotToClipboard: (dataUrl) => ipcRenderer.send('copy-screenshot-to-clipboard', dataUrl),
  screenshotSessionComplete: () => ipcRenderer.send('screenshot-session-complete'),
};

ipcRenderer.on('navigate-to', (event, path) => {
  if (navigateCallback) {
    navigateCallback(path);
  }
});

ipcRenderer.on('open-add-todo', () => {
  if (openAddTodoCallback) {
    openAddTodoCallback();
  }
});

ipcRenderer.on('open-add-memo', () => {
  if (openAddMemoCallback) {
    openAddMemoCallback();
  }
});

ipcRenderer.on('open-notes-chat', () => {
  if (navigateCallback) {
    navigateCallback('/tools/notes?chatMode=1');
  }
});

ipcRenderer.on('update-download-progress', (event, progress) => {
  if (downloadProgressCallback) {
    downloadProgressCallback(progress);
  }
});

ipcRenderer.on('setting-changed', (event, setting) => {
  if (settingChangedCallback) {
    settingChangedCallback(setting);
  }
});

contextBridge.exposeInMainWorld('electron', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  restart: () => ipcRenderer.invoke('restart-app'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  openInternal: (url) => ipcRenderer.send('open-internal', url),
  openFile: (path) => ipcRenderer.send('open-file', path),
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getFileIcon: (path) => ipcRenderer.invoke('get-file-icon', path),
  fileExists: (path) => ipcRenderer.invoke('file-exists', path),
  scanDesktopApps: () => ipcRenderer.invoke('scan-desktop-apps'),
  getDroppedFiles: (fileDataList) => ipcRenderer.invoke('get-dropped-files', fileDataList),
  getFileOrFolderPath: (item) => {
    if (!item) return undefined;
    return webUtils.getPathForFile(item);
  },
  getAutostartStatus: () => ipcRenderer.invoke('get-autostart-status'),
  setAutostartStatus: (enable) => ipcRenderer.invoke('set-autostart-status', enable),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSetting: (setting) => ipcRenderer.invoke('update-setting', setting),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  openUserDataFolder: () => ipcRenderer.invoke('open-user-data-folder'),
  getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
  updateShortcut: (shortcut) => ipcRenderer.invoke('update-shortcut', shortcut),
  resetShortcuts: () => ipcRenderer.invoke('reset-shortcuts'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  downloadUpdate: (url) => ipcRenderer.invoke('download-update', url),
  installUpdate: (filePath) => ipcRenderer.invoke('install-update', filePath),
  toggleFloatWindow: () => ipcRenderer.invoke('toggle-float-window'),
  getFloatConfig: () => ipcRenderer.invoke('get-float-config'),
  updateFloatConfig: (config) => ipcRenderer.invoke('update-float-config', config),
  resetFloatConfig: () => ipcRenderer.invoke('reset-float-config'),
  ocr: {
    recognize: (imageBase64, serviceDir) => ipcRenderer.invoke('ocr:recognize', { imageBase64, serviceDir }),
    recognizeFile: (filePath, serviceDir) => ipcRenderer.invoke('ocr:recognizeFile', { filePath, serviceDir }),
    status: () => ipcRenderer.invoke('ocr:status'),
    start: (serviceDir, config) => ipcRenderer.invoke('ocr:start', { serviceDir, ...config }),
    stop: () => ipcRenderer.invoke('ocr:stop'),
    serviceInfo: () => ipcRenderer.invoke('ocr:serviceInfo'),
    diagnose: (serviceDir) => ipcRenderer.invoke('ocr:diagnose', { serviceDir }),
    installDeps: (serviceDir, force) => ipcRenderer.invoke('ocr:installDeps', { serviceDir, force }),
    checkPort: (port) => ipcRenderer.invoke('ocr:checkPort', port),
    selectPythonPath: () => ipcRenderer.invoke('ocr:selectPythonPath'),
  },
  fileManager: {
    getSystemPaths: () => ipcRenderer.invoke('fileManager:getSystemPaths'),
    getPath: (pathType) => ipcRenderer.invoke('fileManager:getPath', pathType),
    listFiles: (dirPath) => ipcRenderer.invoke('fileManager:listFiles', dirPath),
    getParentPath: (currentPath) => ipcRenderer.invoke('fileManager:getParentPath', currentPath),
    openFile: (filePath) => ipcRenderer.invoke('fileManager:openFile', filePath),
    getFavorites: () => ipcRenderer.invoke('fileManager:getFavorites'),
    addFavorite: (path, name) => ipcRenderer.invoke('fileManager:addFavorite', path, name),
    removeFavorite: (path) => ipcRenderer.invoke('fileManager:removeFavorite', path),
    getTargetPaths: () => ipcRenderer.invoke('fileManager:getTargetPaths'),
    addTargetPath: (path, name) => ipcRenderer.invoke('fileManager:addTargetPath', path, name),
    removeTargetPath: (id) => ipcRenderer.invoke('fileManager:removeTargetPath', id),
    copyFiles: (sourcePaths, destPath) => ipcRenderer.invoke('fileManager:copyFiles', sourcePaths, destPath),
    deleteItem: (itemPath) => ipcRenderer.invoke('fileManager:deleteItem', itemPath),
  },
  ipInfo: {
    query: (ip) => ipcRenderer.invoke('ip-info:query', ip),
  },
  systemInfo: {
    get: () => ipcRenderer.invoke('system-info:get'),
  },
  plugin: {
    getAvailable: () => ipcRenderer.invoke('plugin:get-available'),
    getInstalled: () => ipcRenderer.invoke('plugin:get-installed'),
    install: (pluginId, repo) => ipcRenderer.invoke('plugin:install', { pluginId, repo }),
    uninstall: (pluginId) => ipcRenderer.invoke('plugin:uninstall', pluginId),
    toggleEnabled: (pluginId, enabled) => ipcRenderer.invoke('plugin:toggle-enabled', { pluginId, enabled }),
    installFromFile: () => ipcRenderer.invoke('plugin:install-from-file'),
    installFromPath: (filePath) => ipcRenderer.invoke('plugin:install-from-path', filePath),
    installFromGithub: (id, repo) => ipcRenderer.invoke('plugin:install-from-github', { id, repo }),
    openWindow: (pluginId) => ipcRenderer.invoke('plugin:open-window', { pluginId }),
    openExtensionsDir: () => ipcRenderer.invoke('plugin:open-extensions-dir'),
    minimizeWindow: () => ipcRenderer.send('plugin-window-minimize'),
    maximizeWindow: () => ipcRenderer.send('plugin-window-maximize'),
    closeWindow: () => ipcRenderer.send('plugin-window-close'),
  },
  screenshot: {
    startCapture: () => ipcRenderer.invoke('start-screenshot-capture'),
    cancel: () => ipcRenderer.send('cancel-screenshot'),
    save: (data) => ipcRenderer.invoke('save-screenshot', data),
    copyToClipboard: (dataUrl) => ipcRenderer.send('copy-screenshot-to-clipboard', dataUrl),
    complete: () => ipcRenderer.send('screenshot-session-complete'),
  },
  api: {
    startScreenshotCapture: () => ipcRenderer.invoke('start-screenshot-capture'),
    cancelScreenshot: () => ipcRenderer.send('cancel-screenshot'),
    saveScreenshot: (data) => ipcRenderer.invoke('save-screenshot', data),
    copyScreenshotToClipboard: (dataUrl) => ipcRenderer.send('copy-screenshot-to-clipboard', dataUrl),
    screenshotSessionComplete: () => ipcRenderer.send('screenshot-session-complete'),
  },
  python: {
    start: () => ipcRenderer.invoke('python:start'),
    stop: () => ipcRenderer.invoke('python:stop'),
    status: () => ipcRenderer.invoke('python:status'),
  },
  log: {
    open: () => ipcRenderer.send('log:open'),
    addLog: (level, message, context, stack) => ipcRenderer.invoke('log:addLog', { level, message, context, stack }),
    getLogs: () => ipcRenderer.invoke('log:getLogs'),
    getSettings: () => ipcRenderer.invoke('log:getSettings'),
    updateSettings: (newSettings) => ipcRenderer.invoke('log:updateSettings', newSettings),
    clearLogs: () => ipcRenderer.invoke('log:clearLogs'),
    exportLogs: () => ipcRenderer.invoke('log:exportLogs'),
    getStats: () => ipcRenderer.invoke('log:getStats'),
    importLogs: (jsonString) => ipcRenderer.invoke('log:importLogs', jsonString),
  },
  notes: {
    hasRootPath: () => ipcRenderer.invoke('notes-has-root-path'),
    getRootPath: () => ipcRenderer.invoke('notes-get-root-path'),
    setRootPath: (rootPath) => ipcRenderer.invoke('notes-set-root-path', rootPath),
    selectFolder: () => ipcRenderer.invoke('notes-select-folder'),
    validateFolder: (folderPath) => ipcRenderer.invoke('notes-validate-folder', folderPath),
    scanFolder: (rootPath) => ipcRenderer.invoke('notes-scan-folder', rootPath),
    getFileTree: () => ipcRenderer.invoke('notes-get-file-tree'),
    createFolder: (parentPath, name) => ipcRenderer.invoke('notes-create-folder', parentPath, name),
    createFolderForce: (parentPath, name, mode) => ipcRenderer.invoke('notes-create-folder-force', parentPath, name, mode),
    createNote: (parentPath, name, content) => ipcRenderer.invoke('notes-create-note', parentPath, name, content),
    createNoteForce: (parentPath, name, mode, content) => ipcRenderer.invoke('notes-create-note-force', parentPath, name, mode, content),
    readFile: (filePath) => ipcRenderer.invoke('notes-read-file', filePath),
    saveFile: (filePath, content) => ipcRenderer.invoke('notes-save-file', filePath, content),
    renameItem: (oldPath, newName) => ipcRenderer.invoke('notes-rename-item', oldPath, newName),
    deleteItem: (itemPath) => ipcRenderer.invoke('notes-delete-item', itemPath),
    indexAll: (rootPath) => ipcRenderer.invoke('notes-index-all', rootPath),
    openFileInFolder: (filePath) => ipcRenderer.invoke('notes-open-file-in-folder', filePath),
    readFileAsBuffer: (filePath) => ipcRenderer.invoke('notes-read-file-as-buffer', filePath),
    convertOfficeToHtml: (filePath) => ipcRenderer.invoke('notes-convert-office-to-html', filePath),
  },
  lock: {
    getStatus: () => ipcRenderer.invoke('lock:getStatus'),
    setPassword: (password) => ipcRenderer.invoke('lock:setPassword', password),
  },
  onDownloadProgress: (callback) => {
    downloadProgressCallback = callback;
  },
  onNavigate: (callback) => {
    navigateCallback = callback;
  },
  onSettingChanged: (callback) => {
    settingChangedCallback = callback;
  },
  onOpenAddTodo: (callback) => {
    openAddTodoCallback = callback;
  },
  onOpenAddMemo: (callback) => {
    openAddMemoCallback = callback;
  },
  ipcRenderer: {
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, listener) => ipcRenderer.on(channel, listener),
    off: (channel, listener) => ipcRenderer.off(channel, listener),
  },
});

contextBridge.exposeInMainWorld('api', screenshotApi);

const noopStore = {
  getState: () => ({ activeExtensionPanelId: null }),
  setState: () => {},
};
contextBridge.exposeInMainWorld('useAppStore', noopStore);