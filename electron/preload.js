const { contextBridge, ipcRenderer } = require('electron');

let navigateCallback = null;
let downloadProgressCallback = null;
let settingChangedCallback = null;
let openAddTodoCallback = null;

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
  openExternal: (url) => ipcRenderer.send('open-external', url),
  openInternal: (url) => ipcRenderer.send('open-internal', url),
  openFile: (path) => ipcRenderer.send('open-file', path),
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getFileIcon: (path) => ipcRenderer.invoke('get-file-icon', path),
  scanDesktopApps: () => ipcRenderer.invoke('scan-desktop-apps'),
  getDroppedFiles: (fileDataList) => ipcRenderer.invoke('get-dropped-files', fileDataList),
  getAutostartStatus: () => ipcRenderer.invoke('get-autostart-status'),
  setAutostartStatus: (enable) => ipcRenderer.invoke('set-autostart-status', enable),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSetting: (setting) => ipcRenderer.invoke('update-setting', setting),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  openUserDataFolder: () => ipcRenderer.invoke('open-user-data-folder'),
  getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
  updateShortcut: (shortcut) => ipcRenderer.invoke('update-shortcut', shortcut),
  getVersion: () => ipcRenderer.invoke('get-version'),
  downloadUpdate: (url) => ipcRenderer.invoke('download-update', url),
  installUpdate: (filePath) => ipcRenderer.invoke('install-update', filePath),
  toggleFloatWindow: () => ipcRenderer.invoke('toggle-float-window'),
  getFloatConfig: () => ipcRenderer.invoke('get-float-config'),
  updateFloatConfig: (config) => ipcRenderer.invoke('update-float-config', config),
  resetFloatConfig: () => ipcRenderer.invoke('reset-float-config'),
  ocr: {
    recognize: (imageBase64) => ipcRenderer.invoke('ocr:recognize', imageBase64),
    recognizeFile: (filePath) => ipcRenderer.invoke('ocr:recognizeFile', filePath),
    status: () => ipcRenderer.invoke('ocr:status'),
    start: () => ipcRenderer.invoke('ocr:start'),
    stop: () => ipcRenderer.invoke('ocr:stop'),
    serviceInfo: () => ipcRenderer.invoke('ocr:serviceInfo'),
    diagnose: () => ipcRenderer.invoke('ocr:diagnose'),
    installDeps: () => ipcRenderer.invoke('ocr:installDeps'),
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
  ipcRenderer: {
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, listener) => ipcRenderer.on(channel, listener),
    off: (channel, listener) => ipcRenderer.off(channel, listener),
  },
});