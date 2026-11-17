// 便签墙 preload：暴露便签墙窗口需要的最小能力，不透传任意 IPC。
// 不再注入 --sticky-note-id（便签墙一次管理所有便签）。
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stickyWallAPI', {
  listPinned: () => ipcRenderer.invoke('sticky-notes:list-pinned'),
  get: (id) => ipcRenderer.invoke('sticky-notes:get', id),
  update: (input) => ipcRenderer.invoke('sticky-notes:update', input),
  saveBounds: (input) => ipcRenderer.invoke('sticky-notes:save-bounds', input),
  unpin: (id) => ipcRenderer.invoke('sticky-notes:set-pinned', { id, pinned: false }),
  openInApp: (id) => ipcRenderer.send('sticky-note:open-in-app', id),

  // 穿透控制（mousemove 单源判定 + forceInteractive）
  setInteractive: (value) => ipcRenderer.invoke('sticky-wall:set-interactive', value),
  setDragActive: (value) => ipcRenderer.invoke('sticky-wall:set-drag-active', value),

  // 进入/退出编辑（桌面层子窗口需临时解挂才能拿到键盘焦点）
  setEditing: (value) => ipcRenderer.invoke('sticky-wall:editing', value),

  // 复制正文（file:// 下 navigator.clipboard 不可靠，走主进程 clipboard）
  copyText: (text) => ipcRenderer.invoke('sticky-notes:copy-text', text),

  // 窗口坐标原点变化（显示器分辨率/排列变化时由主进程推送）
  onOriginChanged: (callback) => {
    const handler = (_event, origin) => callback(origin);
    ipcRenderer.on('sticky-wall:origin-changed', handler);
    return () => ipcRenderer.removeListener('sticky-wall:origin-changed', handler);
  },

  onChanged: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('sticky-notes:changed', handler);
    return () => ipcRenderer.removeListener('sticky-notes:changed', handler);
  },
});
