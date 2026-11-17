// 便签 IPC：主窗口与便签墙窗口均通过这里访问 stickyNotesService。
const { ipcMain, clipboard } = require('electron');
const service = require('../services/stickyNotesService.cjs');

let registered = false;

const registerStickyNotesIpc = () => {
  if (registered) return;
  registered = true;

  const handle = (channel, fn) => {
    ipcMain.handle(channel, (event, payload) => {
      try {
        return fn(payload, event);
      } catch (error) {
        console.error(`[StickyNotes] ${channel} 失败:`, error.message);
        return { ok: false, error: '便签操作失败，请重试' };
      }
    });
  };

  handle('sticky-notes:list', () => ({ ok: true, notes: service.list() }));
  handle('sticky-notes:list-pinned', () => {
    // origin：便签墙窗口左上角的桌面坐标，渲染层据此把绝对坐标换算成窗口内坐标
    const wallModule = require('../window/stickyNoteWallWindow.cjs');
    return { ok: true, notes: service.listPinned(), origin: wallModule.getWallOrigin() };
  });
  handle('sticky-notes:get', (id) => service.get(id));
  handle('sticky-notes:create', (input) => service.create(input));
  handle('sticky-notes:update', (input) => service.update(input));
  handle('sticky-notes:remove', (id) => service.remove(id));
  handle('sticky-notes:set-pinned', (payload) => service.setPinned(payload));
  handle('sticky-notes:save-bounds', (payload) => service.saveBounds(payload));

  // 穿透控制通道：由便签墙窗口调用
  ipcMain.handle('sticky-wall:set-interactive', (event, value) => {
    const wallModule = require('../window/stickyNoteWallWindow.cjs');
    if (!wallModule.isWallSender(event.sender)) {
      return { ok: false, error: '权限拒绝' };
    }
    wallModule.setInteractive(Boolean(value));
    return { ok: true };
  });

  ipcMain.handle('sticky-wall:set-drag-active', (event, value) => {
    const wallModule = require('../window/stickyNoteWallWindow.cjs');
    if (!wallModule.isWallSender(event.sender)) {
      return { ok: false, error: '权限拒绝' };
    }
    wallModule.setDragActive(Boolean(value));
    return { ok: true };
  });

  // 进入/退出编辑：桌面层子窗口无法激活，编辑时需临时解挂拿键盘焦点
  ipcMain.handle('sticky-wall:editing', (event, value) => {
    const wallModule = require('../window/stickyNoteWallWindow.cjs');
    if (!wallModule.isWallSender(event.sender)) {
      return { ok: false, error: '权限拒绝' };
    }
    if (value) {
      wallModule.beginEditing();
    } else {
      wallModule.endEditing();
    }
    return { ok: true };
  });

  // 复制便签正文（file:// 下 navigator.clipboard 不可靠）
  ipcMain.handle('sticky-notes:copy-text', (event, text) => {
    const wallModule = require('../window/stickyNoteWallWindow.cjs');
    if (!wallModule.isWallSender(event.sender)) {
      return { ok: false, error: '权限拒绝' };
    }
    clipboard.writeText(String(text ?? ''));
    return { ok: true };
  });

  // 便签墙窗口「在应用中打开」
  ipcMain.on('sticky-note:open-in-app', (event, noteId) => {
    const wallModule = require('../window/stickyNoteWallWindow.cjs');
    if (!wallModule.isWallSender(event.sender)) return;
    const mainWindowModule = require('../window/mainWindow.cjs');
    const mainWindow = mainWindowModule.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindowModule.showMainWindow();
    mainWindow.webContents.send(
      'navigate-to',
      `/tools/sticky-note?focus=${encodeURIComponent(String(noteId || ''))}`,
    );
  });
};

module.exports = { registerStickyNotesIpc };
