const { contextBridge, ipcRenderer, webUtils } = require('electron');

const ALLOWED_INVOKE_CHANNELS = new Set([
  'clipboard:writeImage',
  'clipboard:watch:start',
  'clipboard:watch:stop',
]);
const ALLOWED_LISTEN_CHANNELS = new Set(['clipboard:changed', 'clipboard:image-changed']);

// navigate / download-progress 同样可能有多订阅方，与 setting-changed 一样走 Set 多播，
// onNavigate / onDownloadProgress 返回退订函数（此前为单槽赋值，后注册者会顶掉前者）。
const navigateCallbacks = new Set();
const downloadProgressCallbacks = new Set();
// setting-changed 有多个订阅方（App / baseApi / PluginService 各自按 networkConfig 缓存），
// 单槽赋值会让后注册者把前者顶掉，改为多播并支持退订。
const settingChangedCallbacks = new Set();
let showReminderCallback = null;
let pendingReminder = null;

// 托盘「新建」子菜单的三个动作：回调由目标页面挂载后才注册，而主进程是「先 navigate-to、
// 紧接着（300ms 后）发 open-add-*」。首次进入时页面还要加载路由模块，往往赶不上，
// 槽位为空时消息被直接丢弃 —— 表现为「只跳转、不弹窗」，再点一次才正常（页面已挂载）。
// 与 show-reminder 同样处理：暂存待办动作，等页面注册回调时补发。
const openAddCallbacks = { todo: null, memo: null, reminder: null };
const pendingOpenAdd = { todo: false, memo: false, reminder: false };

ipcRenderer.on('navigate-to', (event, path) => {
  navigateCallbacks.forEach((cb) => cb(path));
});

Object.keys(openAddCallbacks).forEach((kind) => {
  ipcRenderer.on(`open-add-${kind}`, () => {
    const callback = openAddCallbacks[kind];
    if (callback) {
      callback();
    } else {
      pendingOpenAdd[kind] = true;
    }
  });
});

// 注册回调，并把此前暂存的动作补发一次（页面挂载晚于主进程下发时靠这条兜住）
const registerOpenAddCallback = (kind, callback) => {
  openAddCallbacks[kind] = callback;
  if (!pendingOpenAdd[kind]) return;
  pendingOpenAdd[kind] = false;
  callback();
};

// 悬浮球 AI 面板「存为待办」：面板只负责发起，真正写入仍走渲染层的 todoService。
// 与 open-add-* 同理，页面回调可能尚未注册，先暂存再补发。
const floatSaveTodoCallbacks = new Set();
const pendingFloatSaveTodo = [];

ipcRenderer.on('float-ai-save-todo', (event, payload) => {
  if (floatSaveTodoCallbacks.size === 0) {
    pendingFloatSaveTodo.push(payload);
    return;
  }
  floatSaveTodoCallbacks.forEach((callback) => {
    try {
      callback(payload);
    } catch (error) {
      console.error('[Preload] float-ai-save-todo 处理失败:', error);
    }
  });
});

// 主进程等待超时：丢弃尚未投递的队列项，避免登录后凭空多建一条待办
ipcRenderer.on('float-ai-save-todo-cancel', (event, payload = {}) => {
  for (let i = pendingFloatSaveTodo.length - 1; i >= 0; i--) {
    if (pendingFloatSaveTodo[i].requestId === payload.requestId) {
      pendingFloatSaveTodo.splice(i, 1);
    }
  }
});

// 主进程 second-instance 收到 --reminder <id> 后，从数据库读取并下发到渲染进程弹窗
ipcRenderer.on('show-reminder', (event, reminder) => {
  if (showReminderCallback) {
    showReminderCallback(reminder);
  } else {
    pendingReminder = reminder;
  }
});

ipcRenderer.on('update-download-progress', (event, progress) => {
  downloadProgressCallbacks.forEach((cb) => cb(progress));
});

ipcRenderer.on('setting-changed', (event, setting) => {
  // 单个订阅方抛错不应影响其余订阅方（原先单槽时只有一个回调，不存在该问题）
  settingChangedCallbacks.forEach((callback) => {
    try {
      callback(setting);
    } catch (error) {
      console.error('[Preload] setting-changed 回调执行失败:', error && error.message ? error.message : error);
    }
  });
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
  createFolder: (payload) => ipcRenderer.invoke('email:createFolder', payload),
  renameFolder: (payload) => ipcRenderer.invoke('email:renameFolder', payload),
  deleteFolder: (payload) => ipcRenderer.invoke('email:deleteFolder', payload),
  setFolderSubscribed: (payload) => ipcRenderer.invoke('email:setFolderSubscribed', payload),
  emptyFolder: (payload) => ipcRenderer.invoke('email:emptyFolder', payload),
  markFolderSeen: (payload) => ipcRenderer.invoke('email:markFolderSeen', payload),
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
  // 边缘吸附停靠态：渲染层光标跨界事件转发（mouseleave → 延迟折叠 / mouseenter → 取消折叠）
  edgeSnapCursorLeft: () => ipcRenderer.send('edge-snap:cursor-left'),
  edgeSnapCursorEnter: () => ipcRenderer.send('edge-snap:cursor-enter'),
  edgeSnapImeState: (composing) => ipcRenderer.send('edge-snap:ime-state', composing),
  // 窗口模式切换（小窗/大窗），模式持久化由主进程负责
  setWindowMode: (mode) => ipcRenderer.send('window-mode-set', mode),
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
  // P1: 启动应用（带可选参数）
  launchAppWithOptions: (options) => ipcRenderer.invoke('launch-app-with-options', options),
  // P1: 在资源管理器中定位文件
  revealInFolder: (filePath) => ipcRenderer.invoke('reveal-in-folder', filePath),
  // P1: 扫描开始菜单已安装应用
  scanInstalledApps: () => ipcRenderer.invoke('scan-installed-apps'),
  onScanInstalledAppsProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('scan-installed-apps-progress', handler);
    return () => ipcRenderer.removeListener('scan-installed-apps-progress', handler);
  },
  // P2: 全局快捷键
  registerQuickLaunchHotkey: (payload) => ipcRenderer.invoke('register-quick-launch-hotkey', payload),
  unregisterQuickLaunchHotkey: (appId) => ipcRenderer.invoke('unregister-quick-launch-hotkey', appId),
  getQuickLaunchHotkeys: () => ipcRenderer.invoke('get-quick-launch-hotkeys'),
  // P2: 配置导入导出
  exportQuickLaunchConfig: (content) => ipcRenderer.invoke('export-quick-launch-config', content),
  importQuickLaunchConfig: () => ipcRenderer.invoke('import-quick-launch-config'),
  getAutostartStatus: () => ipcRenderer.invoke('get-autostart-status'),
  setAutostartStatus: (enable) => ipcRenderer.invoke('set-autostart-status', enable),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSetting: (setting) => ipcRenderer.invoke('update-setting', setting),
  setThemeSnapshot: (colors) => ipcRenderer.invoke('theme:set-snapshot', colors),
  setAIConfigSnapshot: (config) => ipcRenderer.invoke('ai-config:set-snapshot', config),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  clearIconCache: (type) => ipcRenderer.invoke('clear-icon-cache', { type }),
  resolveIcons: (urls, type) => ipcRenderer.invoke('icon:resolve', { urls, type }),
  getIconCacheStats: () => ipcRenderer.invoke('get-icon-cache-stats'),
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
  // 悬浮球洞察气泡：每日快照（天气/黄历/打卡，预格式化文案）与轻量事件（打卡成功等）
  floatDailySnapshot: (payload) => ipcRenderer.send('float:daily-snapshot', payload),
  floatInsightEvent: (payload) => ipcRenderer.send('float:insight-event', payload),
  getFloatConfig: () => ipcRenderer.invoke('get-float-config'),
  updateFloatConfig: (config) => ipcRenderer.invoke('update-float-config', config),
  resetFloatConfig: () => ipcRenderer.invoke('reset-float-config'),
  ocr: {
    recognize: (imageBase64) => ipcRenderer.invoke('ocr:recognize', { imageBase64: String(imageBase64 || '') }),
    recognizeFile: (filePath) => ipcRenderer.invoke('ocr:recognizeFile', { filePath: String(filePath || '') }),
    status: () => ipcRenderer.invoke('ocr:status'),
    start: () => ipcRenderer.invoke('ocr:start'),
    stop: () => ipcRenderer.invoke('ocr:stop'),
    serviceInfo: () => ipcRenderer.invoke('ocr:serviceInfo'),
    runtimeInfo: () => ipcRenderer.invoke('ocr:runtimeInfo'),
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
    onInstallProgress: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('plugin:install-progress', listener);
      return () => ipcRenderer.removeListener('plugin:install-progress', listener);
    },
    storage: {
      get: (pluginId, userId, key) =>
        ipcRenderer.invoke('sqlite:plugin:get', { pluginId, userId, key }),
      set: (pluginId, userId, key, value) =>
        ipcRenderer.invoke('sqlite:plugin:set', { pluginId, userId, key, value }),
      delete: (pluginId, userId, key) =>
        ipcRenderer.invoke('sqlite:plugin:delete', { pluginId, userId, key }),
    },
  },
  sqlite: {
    invoke: (channel, payload) => {
      if (typeof channel !== 'string' || !/^sqlite:[A-Za-z:]+$/.test(channel)) {
        return Promise.reject(new Error('不支持的 sqlite 通道'));
      }
      return ipcRenderer.invoke(channel, payload);
    },
  },
  // 定时提醒：主进程 Windows 计划任务管理（schtasks 注册/删除）
  reminder: {
    schedule: (reminder) => ipcRenderer.invoke('reminder:schedule', reminder),
    remove: (id) => ipcRenderer.invoke('reminder:remove', id),
    notify: (reminder) => ipcRenderer.invoke('reminder:notify', reminder),
  },
  s3: s3Api,
  email: emailApi,
  screenshot: {
    startCapture: () => ipcRenderer.invoke('start-screenshot-capture'),
    translate: (dataUrl) => ipcRenderer.invoke('screenshot:translate', dataUrl),
    cancel: () => ipcRenderer.send('cancel-screenshot'),
    save: (data) => ipcRenderer.invoke('save-screenshot', data),
    copyToClipboard: (dataUrl) => ipcRenderer.send('copy-screenshot-to-clipboard', dataUrl),
    complete: () => ipcRenderer.send('screenshot-session-complete'),
    onData: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('screenshot:data', handler);
      return () => ipcRenderer.removeListener('screenshot:data', handler);
    },
  },
  translate: {
    open: (payload) => ipcRenderer.invoke('translate:open', payload),
    selection: () => ipcRenderer.invoke('translate:selection'),
    close: () => ipcRenderer.invoke('translate:close'),
    copy: (text) => ipcRenderer.invoke('translate:copy', { text }),
    history: {
      list: (payload) => ipcRenderer.invoke('translate:history:list', payload),
      save: (record) => ipcRenderer.invoke('translate:history:save', record),
      remove: (id) => ipcRenderer.invoke('translate:history:delete', { id }),
      clear: () => ipcRenderer.invoke('translate:history:clear'),
    },
  },
  log: {
    open: () => ipcRenderer.send('log:open'),
    minimize: () => ipcRenderer.send('log:minimize'),
    close: () => ipcRenderer.send('log:close'),
    onNewEntry: (callback) => {
      const listener = (_event, entry) => callback(entry);
      ipcRenderer.on('log:newEntry', listener);
      return () => ipcRenderer.removeListener('log:newEntry', listener);
    },
    onCleared: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('log:cleared', listener);
      return () => ipcRenderer.removeListener('log:cleared', listener);
    },
    addLog: (level, message, context, stack) => ipcRenderer.invoke('log:addLog', { level, message, context, stack }),
    getLogs: () => ipcRenderer.invoke('log:getLogs'),
    getSettings: () => ipcRenderer.invoke('log:getSettings'),
    updateSettings: (newSettings) => ipcRenderer.invoke('log:updateSettings', newSettings),
    clearLogs: () => ipcRenderer.invoke('log:clearLogs'),
    exportLogs: () => ipcRenderer.invoke('log:exportLogs'),
    getStats: () => ipcRenderer.invoke('log:getStats'),
    importLogs: (jsonString) => ipcRenderer.invoke('log:importLogs', jsonString),
  },
  ai: {
    chat: (payload) => ipcRenderer.invoke('ai-chat', payload),
  },
  floatAi: {
    // 悬浮球 AI 结果「存为待办」：返回退订函数，卸载时务必调用
    onSaveTodo: (callback) => {
      floatSaveTodoCallbacks.add(callback);
      while (pendingFloatSaveTodo.length > 0) {
        const payload = pendingFloatSaveTodo.shift();
        try {
          callback(payload);
        } catch (error) {
          console.error('[Preload] float-ai-save-todo 补发失败:', error);
        }
      }
      return () => { floatSaveTodoCallbacks.delete(callback); };
    },
    // 创建结果回执：主进程据此确认「存为待办」是否真实成功
    reportSaveTodo: (payload) => ipcRenderer.send('float-ai-save-todo-result', payload),
  },
  // 划词工具条「问AI」：主窗口带文本打开小橘面板（chat 模式，输入框预填）
  floatPanel: {
    openChat: (text) => ipcRenderer.invoke('float-panel-open-chat', { text }),
  },
  notes: {
    hasRootPath: () => ipcRenderer.invoke('notes-has-root-path'),
    getRootPath: () => ipcRenderer.invoke('notes-get-root-path'),
    setRootPath: (rootPath) => ipcRenderer.invoke('notes-set-root-path', rootPath),
    // 视图根（当前固定目录）/ 对话根（对话整理独立目录）：仅同步给主进程做越界放行
    setViewPath: (viewPath) => ipcRenderer.invoke('notes-set-view-path', viewPath),
    setChatRootPath: (chatPath) => ipcRenderer.invoke('notes-set-chat-path', chatPath),
    // 所有固定目录：切视图后其它固定目录中的文件仍需可读写
    setPinnedRoots: (paths) => ipcRenderer.invoke('notes-set-pinned-roots', paths),
    selectFolder: () => ipcRenderer.invoke('notes-select-folder'),
    validateFolder: (folderPath) => ipcRenderer.invoke('notes-validate-folder', folderPath),
    createFolder: (parentPath, name) => ipcRenderer.invoke('notes-create-folder', parentPath, name),
    createFolderForce: (parentPath, name, mode) => ipcRenderer.invoke('notes-create-folder-force', parentPath, name, mode),
    createNote: (parentPath, name, content) => ipcRenderer.invoke('notes-create-note', parentPath, name, content),
    createNoteForce: (parentPath, name, mode, content) => ipcRenderer.invoke('notes-create-note-force', parentPath, name, mode, content),
    readFile: (filePath) => ipcRenderer.invoke('notes-read-file', filePath),
    saveFile: (filePath, content) => ipcRenderer.invoke('notes-save-file', filePath, content),
    renameItem: (oldPath, newName) => ipcRenderer.invoke('notes-rename-item', oldPath, newName),
    deleteItem: (itemPath) => ipcRenderer.invoke('notes-delete-item', itemPath),
    // 移入系统回收站（可恢复），与 deleteItem 的彻底删除区分
    trashItem: (itemPath) => ipcRenderer.invoke('notes-trash-item', itemPath),
    indexAll: (rootPath) => ipcRenderer.invoke('notes-index-all', rootPath),
    openFileInFolder: (filePath) => ipcRenderer.invoke('notes-open-file-in-folder', filePath),
    readFileAsBuffer: (filePath) => ipcRenderer.invoke('notes-read-file-as-buffer', filePath),
    statFile: (filePath) => ipcRenderer.invoke('notes-stat', filePath),
    exportPdf: (payload) => ipcRenderer.invoke('notes-export-pdf', payload),
    exportHtml: (payload) => ipcRenderer.invoke('notes-export-html', payload),
    moveItem: (itemPath, targetFolderPath) => ipcRenderer.invoke('notes-move-item', itemPath, targetFolderPath),
    copyItem: (sourcePath) => ipcRenderer.invoke('notes-copy-item', sourcePath),
    sendItem: (sourcePath, target) => ipcRenderer.invoke('notes-send-item', sourcePath, target),
    importDroppedFiles: (rootPath, filePaths) => ipcRenderer.invoke('notes-import-dropped-files', rootPath, filePaths),
    // 划词工具条「转笔记」：写入「对话整理」目录（未配置对话根时回落主根）
    saveOrganizedNote: (payload) => ipcRenderer.invoke('notes-save-organized-note', payload),
    scanFolderAsync: (rootPath) => ipcRenderer.invoke('notes-scan-folder-async', { rootPath }),
    getFileTreeAsync: (rootPath) => ipcRenderer.invoke('notes-get-file-tree-async', { rootPath }),
    writeDraft: (absolutePath, content) => ipcRenderer.invoke('notes-write-draft', { absolutePath, content }),
    readDraft: (absolutePath) => ipcRenderer.invoke('notes-read-draft', { absolutePath }),
    deleteDraft: (absolutePath) => ipcRenderer.invoke('notes-delete-draft', { absolutePath }),
    listDrafts: () => ipcRenderer.invoke('notes-list-drafts'),
    searchNotes: (opts) => ipcRenderer.invoke('notes-search-notes', opts),
    getFavorites: () => ipcRenderer.invoke('notes-get-favorites'),
    setFavorites: (favorites) => ipcRenderer.invoke('notes-set-favorites', { favorites }),
    toggleFavorite: (absolutePath) => ipcRenderer.invoke('notes-toggle-favorite', { absolutePath }),
    listTemplates: () => ipcRenderer.invoke('notes-list-templates'),
    saveAttachment: (notePath, fileName, data) => ipcRenderer.invoke('notes-save-attachment', { notePath, fileName, data }),
    startWatching: (rootPath) => ipcRenderer.invoke('notes-start-watching', { rootPath }),
    stopWatching: () => ipcRenderer.invoke('notes-stop-watching'),
    onFsChanged: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('notes-fs-changed', listener);
      return () => ipcRenderer.removeListener('notes-fs-changed', listener);
    },
  },
  lock: {
    getStatus: () => ipcRenderer.invoke('lock:getStatus'),
    setPassword: (password) => ipcRenderer.invoke('lock:setPassword', password),
  },
  appLock: {
    getConfig: () => ipcRenderer.invoke('appLock:getConfig'),
    getStatus: () => ipcRenderer.invoke('appLock:getStatus'),
    setMasterEnabled: (enabled) => ipcRenderer.invoke('appLock:setMasterEnabled', enabled),
    addApp: (payload) => ipcRenderer.invoke('appLock:addApp', payload),
    removeApp: (id) => ipcRenderer.invoke('appLock:removeApp', id),
    toggleApp: (id, enabled) => ipcRenderer.invoke('appLock:toggleApp', { id, enabled }),
    resolveApp: (exePath) => ipcRenderer.invoke('appLock:resolveApp', exePath),
  },
  offlineTools: {
    getDir: () => ipcRenderer.invoke('offline-tools:get-dir'),
    setDir: (dirPath) => ipcRenderer.invoke('offline-tools:set-dir', dirPath),
    list: (dirPath) => ipcRenderer.invoke('offline-tools:list', dirPath),
    open: (filePath) => ipcRenderer.invoke('offline-tools:open', filePath),
  },
  onDownloadProgress: (callback) => {
    downloadProgressCallbacks.add(callback);
    return () => downloadProgressCallbacks.delete(callback);
  },
  onNavigate: (callback) => {
    navigateCallbacks.add(callback);
    return () => navigateCallbacks.delete(callback);
  },
  onSettingChanged: (callback) => {
    settingChangedCallbacks.add(callback);
    // 返回退订函数：调用方卸载时正确退订，而不是再注册一个空函数把别人顶掉
    return () => {
      settingChangedCallbacks.delete(callback);
    };
  },
  onOpenAddTodo: (callback) => registerOpenAddCallback('todo', callback),
  onOpenAddMemo: (callback) => registerOpenAddCallback('memo', callback),
  onOpenAddReminder: (callback) => registerOpenAddCallback('reminder', callback),
  onShowReminder: (callback) => {
    showReminderCallback = callback;
    if (pendingReminder) {
      const data = pendingReminder;
      pendingReminder = null;
      callback(data);
    }
  },
  ipcRenderer: {
    invoke: (channel, ...args) => {
      if (!ALLOWED_INVOKE_CHANNELS.has(channel)) {
        return Promise.reject(new Error(`channel not allowed: ${channel}`));
      }
      return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel, listener) => {
      if (ALLOWED_LISTEN_CHANNELS.has(channel)) ipcRenderer.on(channel, listener);
    },
    off: (channel, listener) => ipcRenderer.off(channel, listener),
  },
});