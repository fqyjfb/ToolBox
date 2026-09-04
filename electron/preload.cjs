const { contextBridge, ipcRenderer, webUtils } = require('electron');

let navigateCallback = null;
let downloadProgressCallback = null;
let settingChangedCallback = null;
let openAddTodoCallback = null;
let openAddMemoCallback = null;
let launchPluginCallback = null;

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

ipcRenderer.on('launch-plugin', (event, pluginId) => {
  if (launchPluginCallback) {
    launchPluginCallback(pluginId);
  }
});

const s3Api = {
  listBuckets: (config) => ipcRenderer.invoke('s3:listBuckets', config),
  listFiles: (config, prefix) => ipcRenderer.invoke('s3:listFiles', { config, prefix }),
  getObject: (config, key) => ipcRenderer.invoke('s3:getObject', { config, key }),
  putObject: (config, key, body, contentType) => ipcRenderer.invoke('s3:putObject', { config, key, body, contentType }),
  deleteObject: (config, key) => ipcRenderer.invoke('s3:deleteObject', { config, key }),
  deleteObjects: (config, keys) => ipcRenderer.invoke('s3:deleteObjects', { config, keys }),
  copyObject: (config, sourceKey, destKey) => ipcRenderer.invoke('s3:copyObject', { config, sourceKey, destKey }),
  getPresignedUrl: (config, key, options) => ipcRenderer.invoke('s3:getPresignedUrl', { config, key, options }),
  uploadFile: (config, key, fileBuffer, contentType) => ipcRenderer.invoke('s3:uploadFile', { config, key, fileBuffer, contentType }),
  listAllObjects: (config, prefix) => ipcRenderer.invoke('s3:listAllObjects', { config, prefix }),
  createBucket: (config, bucketName) => ipcRenderer.invoke('s3:createBucket', { config, bucketName }),
  deleteBucket: (config, bucketName) => ipcRenderer.invoke('s3:deleteBucket', { config, bucketName }),
};

let emailNewMailCallback = null;
ipcRenderer.on('email:new-mail', (event, payload) => {
  if (emailNewMailCallback) emailNewMailCallback(payload);
});

const emailApi = {
  testConnection: (payload) => ipcRenderer.invoke('email:testConnection', payload),
  listFolders: (payload) => ipcRenderer.invoke('email:listFolders', payload),
  listMessages: (payload) => ipcRenderer.invoke('email:listMessages', payload),
  getMessage: (payload) => ipcRenderer.invoke('email:getMessage', payload),
  getAttachment: (payload) => ipcRenderer.invoke('email:getAttachment', payload),
  sendMessage: (payload) => ipcRenderer.invoke('email:sendMessage', payload),
  setFlags: (payload) => ipcRenderer.invoke('email:setFlags', payload),
  deleteMessages: (payload) => ipcRenderer.invoke('email:deleteMessages', payload),
  moveMessages: (payload) => ipcRenderer.invoke('email:moveMessages', payload),
  getUnreadCounts: (payload) => ipcRenderer.invoke('email:getUnreadCounts', payload),
  searchMessages: (payload) => ipcRenderer.invoke('email:searchMessages', payload),
  watchStart: (payload) => ipcRenderer.invoke('email:watchStart', payload),
  watchStop: (payload) => ipcRenderer.invoke('email:watchStop', payload),
  oauthStart: (payload) => ipcRenderer.invoke('email:oauthStart', payload),
  oauthCancel: () => ipcRenderer.invoke('email:oauthCancel'),
  onNewMail: (callback) => { emailNewMailCallback = callback; },
};

contextBridge.exposeInMainWorld('electron', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  restart: () => ipcRenderer.invoke('restart-app'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  openInternal: (url) => ipcRenderer.send('open-internal', url),
  openQuickLogin: (payload) => ipcRenderer.invoke('quick-login:open', payload),
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
  clearIconCache: (type) => ipcRenderer.invoke('clear-icon-cache', { type }),
  networkTest: (payload) => ipcRenderer.invoke('network:test', payload),
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
    recognize: (imageBase64, serviceDir) => ipcRenderer.invoke('ocr:recognize', { imageBase64: String(imageBase64 || ''), serviceDir: String(serviceDir || '') }),
    recognizeFile: (filePath, serviceDir) => ipcRenderer.invoke('ocr:recognizeFile', { filePath: String(filePath || ''), serviceDir: String(serviceDir || '') }),
    status: () => ipcRenderer.invoke('ocr:status'),
    start: (serviceDir, config) => {
      const safeConfig = {};
      if (config) {
        if (config.httpPort !== undefined) safeConfig.httpPort = Number(config.httpPort);
        if (config.wsPort !== undefined) safeConfig.wsPort = Number(config.wsPort);
        if (config.pythonPath !== undefined) safeConfig.pythonPath = String(config.pythonPath || '');
        if (config.autoRestart !== undefined) safeConfig.autoRestart = Boolean(config.autoRestart);
        if (config.maxRestarts !== undefined) safeConfig.maxRestarts = Number(config.maxRestarts);
      }
      return ipcRenderer.invoke('ocr:start', { serviceDir: String(serviceDir || ''), ...safeConfig });
    },
    stop: () => ipcRenderer.invoke('ocr:stop'),
    serviceInfo: () => ipcRenderer.invoke('ocr:serviceInfo'),
    diagnose: (serviceDir) => ipcRenderer.invoke('ocr:diagnose', { serviceDir: String(serviceDir || '') }),
    installDeps: (serviceDir, force) => ipcRenderer.invoke('ocr:installDeps', { serviceDir: String(serviceDir || ''), force: Boolean(force) }),
    getInstallProgress: () => ipcRenderer.invoke('ocr:getInstallProgress'),
    checkPort: (port) => ipcRenderer.invoke('ocr:checkPort', Number(port)),
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
    install: (pluginId, repo, releaseUrl) => ipcRenderer.invoke('plugin:install', { pluginId, repo, releaseUrl }),
    uninstall: (pluginId) => ipcRenderer.invoke('plugin:uninstall', pluginId),
    toggleEnabled: (pluginId, enabled) => ipcRenderer.invoke('plugin:toggle-enabled', { pluginId, enabled }),
    installFromFile: () => ipcRenderer.invoke('plugin:install-from-file'),
    installFromPath: (filePath) => ipcRenderer.invoke('plugin:install-from-path', filePath),
    installFromGithub: (id, repo) => ipcRenderer.invoke('plugin:install-from-github', { id, repo }),
    openWindow: (pluginId, userId) => ipcRenderer.invoke('plugin:open-window', { pluginId, userId }),
    openExtensionsDir: () => ipcRenderer.invoke('plugin:open-extensions-dir'),
    minimizeWindow: () => ipcRenderer.send('plugin-window-minimize'),
    maximizeWindow: () => ipcRenderer.send('plugin-window-maximize'),
    closeWindow: () => ipcRenderer.send('plugin-window-close'),
    saveFile: (filePath, data) => ipcRenderer.invoke('plugin:save-file', { path: filePath, data }),
    storage: {
      get: (pluginId, userId, key) =>
        ipcRenderer.invoke('sqlite:plugin:get', { pluginId, userId, key }),
      set: (pluginId, userId, key, value) =>
        ipcRenderer.invoke('sqlite:plugin:set', { pluginId, userId, key, value }),
      delete: (pluginId, userId, key) =>
        ipcRenderer.invoke('sqlite:plugin:delete', { pluginId, userId, key }),
    },
  },
  s3: s3Api,
  email: emailApi,
  screenshot: {
    startCapture: () => ipcRenderer.invoke('start-screenshot-capture'),
    cancel: () => ipcRenderer.send('cancel-screenshot'),
    save: (data) => ipcRenderer.invoke('save-screenshot', data),
    copyToClipboard: (dataUrl) => ipcRenderer.send('copy-screenshot-to-clipboard', dataUrl),
    complete: () => ipcRenderer.send('screenshot-session-complete'),
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
    moveItem: (itemPath, targetFolderPath) => ipcRenderer.invoke('notes-move-item', itemPath, targetFolderPath),
    copyItem: (sourcePath) => ipcRenderer.invoke('notes-copy-item', sourcePath),
    importDroppedFiles: (rootPath, filePaths) => ipcRenderer.invoke('notes-import-dropped-files', rootPath, filePaths),
  },
  lock: {
    getStatus: () => ipcRenderer.invoke('lock:getStatus'),
    setPassword: (password) => ipcRenderer.invoke('lock:setPassword', password),
  },
  offlineTools: {
    getDir: () => ipcRenderer.invoke('offline-tools:get-dir'),
    setDir: (dirPath) => ipcRenderer.invoke('offline-tools:set-dir', dirPath),
    list: (dirPath) => ipcRenderer.invoke('offline-tools:list', dirPath),
    open: (filePath) => ipcRenderer.invoke('offline-tools:open', filePath),
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
  onLaunchPlugin: (callback) => {
    launchPluginCallback = callback;
  },
  ipcRenderer: {
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, listener) => ipcRenderer.on(channel, listener),
    off: (channel, listener) => ipcRenderer.off(channel, listener),
  },
});