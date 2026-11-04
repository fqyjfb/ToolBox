const { globalShortcut, Menu, app } = require('electron');

class ShortcutManager {
  constructor() {
    this.localShortcuts = new Map();
    this.globalShortcuts = new Map();
  }

  register(accelerator, callback, isGlobal = false) {
    if (isGlobal) {
      this._registerGlobal(accelerator, callback);
    } else {
      this._registerLocal(accelerator, callback);
    }
  }

  _registerGlobal(accelerator, callback) {
    if (globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator);
    }
    const ok = globalShortcut.register(accelerator, callback);
    if (ok) {
      this.globalShortcuts.set(accelerator, callback);
      console.info('[ShortcutManager] 全局快捷键已注册:', accelerator);
    } else {
      console.error('[ShortcutManager] 全局快捷键注册失败（可能被其他应用占用）:', accelerator);
    }
  }

  _registerLocal(accelerator, callback) {
    this.localShortcuts.set(accelerator, callback);
    this._rebuildMenu();
  }

  isRegistered(accelerator) {
    return this.localShortcuts.has(accelerator) || this.globalShortcuts.has(accelerator);
  }

  unregister(accelerator) {
    if (this.globalShortcuts.has(accelerator)) {
      globalShortcut.unregister(accelerator);
      this.globalShortcuts.delete(accelerator);
    }
    if (this.localShortcuts.has(accelerator)) {
      this.localShortcuts.delete(accelerator);
      this._rebuildMenu();
    }
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
    this.globalShortcuts.clear();
    this.localShortcuts.clear();
    this._rebuildMenu();
  }

  _rebuildMenu() {
    const template = [];

    if (process.platform === 'darwin') {
      template.push({
        label: app.name,
        submenu: [
          { role: 'about' },
          { role: 'quit' }
        ]
      });
    }

    const fileMenu = {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    };

    const editMenu = {
      label: 'Edit',
      submenu: [
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' }
      ]
    };

    const shortcutsMenu = {
      label: 'Shortcuts',
      submenu: []
    };

    this.localShortcuts.forEach((callback, accelerator) => {
      shortcutsMenu.submenu.push({
        label: `${accelerator}`,
        accelerator,
        click: callback
      });
    });

    template.push(fileMenu, editMenu, shortcutsMenu);

    if (process.platform === 'darwin') {
      template.push({
        role: 'window',
        submenu: [
          { role: 'minimize' },
          { role: 'front' }
        ]
      });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}

module.exports = ShortcutManager;