const { ipcMain, BrowserWindow, Menu, MenuItem, nativeTheme } = require('electron');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG_FILE = path.join(app.getPath('userData'), 'offline-tools.json');

const offlineWindows = new Map();
const pendingModals = new Map();

let registered = false;

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function listHtmlFiles(dirPath) {
  const files = [];
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    return { success: false, error: error.message };
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.html')) continue;
    const filePath = path.join(dirPath, entry.name);
    try {
      const stat = fs.statSync(filePath);
      files.push({
        name: entry.name.replace(/\.html?$/i, ''),
        fileName: entry.name,
        path: filePath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      });
    } catch { /* ignore */ }
  }
  return { success: true, files };
}

// 应用内错误提示浮层（替代原生 alert）
function showToast(parent, message) {
  const text = String(message ?? '');
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font-family:"Segoe UI","Microsoft YaHei",sans-serif;background:#ffffff;}
    .box{display:flex;align-items:flex-start;gap:8px;padding:12px 16px;border-radius:8px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;box-shadow:0 4px 12px rgba(0,0,0,.15);font-size:13px;line-height:1.5;word-break:break-word;}
    svg{flex-shrink:0;width:18px;height:18px;margin-top:1px;stroke:#dc2626;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
    p{margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
  </style></head><body>
    <div class="box"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>${esc}</p></div>
  </body></html>`;

  const win = new BrowserWindow({
    parent,
    frame: false,
    resizable: false,
    movable: false,
    focusable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    useContentSize: true,
    width: 420,
    height: 76,
    webPreferences: { sandbox: true },
  });

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  win.once('ready-to-show', () => {
    if (parent.isDestroyed()) { win.destroy(); return; }
    const [pw, ph] = parent.getContentSize();
    win.setPosition(pw - 420 - 24, ph - 76 - 24);
    win.showInactive();
  });

  const timer = setTimeout(() => {
    if (!win.isDestroyed()) win.destroy();
  }, Math.max(2500, Math.min(8000, text.length * 100)));
  win.on('closed', () => clearTimeout(timer));
}

// 风格化模态窗（替代原生 confirm/prompt）
function showModal(parent, { mode, message, defaultValue = '', title }) {
  return new Promise((resolve) => {
    let settled = false;
    let win;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (win && !win.isDestroyed()) {
        pendingModals.delete(win.id);
        win.destroy();
      }
      resolve(result);
    };

    const esc = String(message ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const escDefault = String(defaultValue ?? '').replace(/"/g, '&quot;');
    const isPrompt = mode === 'prompt';
    const heading = title ? String(title).replace(/[<>&"]/g, '') : (isPrompt ? '输入' : '确认');
    const inputHtml = isPrompt ? `<input id="ot-input" type="text" value="${escDefault}" />` : '';

    const html = `<!doctype html><html class="${nativeTheme.shouldUseDarkColors ? 'dark' : ''}"><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;}
      body{margin:0;font-family:"Segoe UI","Microsoft YaHei",sans-serif;background:#ffffff;color:#111827;}
      .dark body{background:#1f2937;color:#f3f4f6;}
      .wrap{padding:20px;}
      h3{margin:0 0 10px;font-size:14px;font-weight:600;line-height:1.25;}
      p{margin:0;font-size:13px;line-height:1.5;color:#4b5563;word-break:break-word;}
      .dark p{color:#d1d5db;}
      input{margin-top:12px;width:100%;padding:7px 10px;font-size:13px;border:1px solid #d1d5db;border-radius:6px;background:#ffffff;color:#111827;outline:none;}
      .dark input{background:#374151;border-color:#4b5563;color:#f3f4f6;}
      input:focus{border-color:#6366f1;}
      .btns{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;}
      button{padding:6px 14px;font-size:13px;border-radius:6px;cursor:pointer;font-weight:500;transition:filter .15s;}
      #ot-cancel{background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;}
      .dark #ot-cancel{background:#4b5563;color:#e5e7eb;border-color:#6b7280;}
      #ot-ok{background:#18181b;color:#ffffff;border:none;}
      .dark #ot-ok{background:#6366f1;}
      button:hover{filter:brightness(1.1);}
    </style></head><body>
      <div class="wrap">
        <h3>${heading}</h3>
        <p>${esc}</p>
        ${inputHtml}
        <div class="btns">
          <button id="ot-cancel">取消</button>
          <button id="ot-ok">确定</button>
        </div>
      </div>
      <script>
        const btnOk=document.getElementById('ot-ok'),btnCancel=document.getElementById('ot-cancel'),input=document.getElementById('ot-input');
        function ok(){window.otModal.done({canceled:false,value:input?input.value:''});}
        btnCancel.addEventListener('click',()=>window.otModal.done({canceled:true}));
        btnOk.addEventListener('click',ok);
        document.addEventListener('keydown',e=>{
          if(e.key==='Enter')ok();
          else if(e.key==='Escape')window.otModal.done({canceled:true});
        });
        if(input){input.focus();input.select();}
        else{btnOk.focus();}
      </script>
    </body></html>`;

    win = new BrowserWindow({
      parent,
      modal: true,
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      show: false,
      useContentSize: true,
      width: Math.min(480, Math.max(320, String(message ?? '').length * 8 + 80)),
      height: isPrompt ? 200 : 165,
      webPreferences: {
        preload: path.join(__dirname, '../window/offline-tool-modal-preload.cjs'),
        sandbox: false,
      },
    });
    win.setMenuBarVisibility(false);

    pendingModals.set(win.id, finish);
    win.once('ready-to-show', () => win.show());
    win.on('closed', () => finish({ canceled: true }));
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });
}

// 浏览器风格右键菜单
function attachContextMenu(webContents) {
  webContents.on('context-menu', (_event, params) => {
    const menu = new Menu();
    if (params.editFlags.canCut) menu.append(new MenuItem({ label: '剪切', role: 'cut' }));
    if (params.editFlags.canCopy) menu.append(new MenuItem({ label: '复制', role: 'copy' }));
    if (params.editFlags.canPaste) menu.append(new MenuItem({ label: '粘贴', role: 'paste' }));
    if (params.editFlags.canSelectAll) menu.append(new MenuItem({ label: '全选', role: 'selectAll' }));
    if (params.mediaType === 'image' && params.hasImageContents) {
      menu.append(new MenuItem({ label: '复制图片', role: 'copyImage' }));
    }
    if (menu.items.length > 0) menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({ label: '刷新', role: 'reload' }));
    menu.popup();
  });
}

function openHtmlWindow(filePath) {
  const existing = offlineWindows.get(filePath);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return { success: true };
  }

  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 400,
    minHeight: 300,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../window/offline-tool-preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.removeMenu();

  attachContextMenu(win.webContents);
  win.loadFile(filePath);

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => offlineWindows.delete(filePath));

  offlineWindows.set(filePath, win);
  return { success: true };
}

function registerOfflineToolsIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle('offline-tools:get-dir', async () => {
    return loadConfig().dir || null;
  });

  ipcMain.handle('offline-tools:set-dir', async (_event, dirPath) => {
    const config = loadConfig();
    config.dir = dirPath;
    saveConfig(config);
    return { success: true };
  });

  ipcMain.handle('offline-tools:list', async (_event, dirPath) => listHtmlFiles(dirPath));

  ipcMain.handle('offline-tools:open', async (_event, filePath) => openHtmlWindow(filePath));

  // 工具页面 alert → 应用内提示
  ipcMain.on('offline-tool:alert', (event, message) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) showToast(win, message);
  });

  // confirm / prompt → 风格化模态窗
  ipcMain.on('offline-tool:confirm', (event, { message, title }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) { event.returnValue = false; return; }
    showModal(win, { mode: 'confirm', message, title })
      .then((r) => { event.returnValue = !r.canceled; });
  });

  ipcMain.on('offline-tool:prompt', (event, { message, defaultValue, title }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) { event.returnValue = null; return; }
    showModal(win, { mode: 'prompt', message, defaultValue, title })
      .then((r) => { event.returnValue = r.canceled ? null : r.value; });
  });

  ipcMain.on('offline-tool-modal-result', (event, result) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const finish = pendingModals.get(win.id);
    if (finish) finish(result || { canceled: true });
  });
}

module.exports = { registerOfflineToolsIpc };
