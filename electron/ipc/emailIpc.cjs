// ToolBox/electron/ipc/emailIpc.cjs
// 邮箱插件 IPC 注册：email:* 通道，统一 { ok, data } / { ok:false, error, code } 返回。
// 与 S3 插件（s3:* 通道）同构：协议库在主进程，插件前端纯 UI。

const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');

let svc = null;
let idleService = null;
let oauth = null;
let emailIpcRegistered = false;

// 新邮件订阅者：watch id -> Set<WebContents>。
// 插件窗口与主窗口都可能调用 watchStart；事件必须发给所有存活订阅者，
// 同时保留对主窗口的既有发送行为（去重后统一发送）。
const newMailSubscribers = new Map();

function addNewMailSubscriber(id, webContents) {
  if (!id || !webContents || webContents.isDestroyed?.()) return;
  let set = newMailSubscribers.get(id);
  if (!set) {
    set = new Set();
    newMailSubscribers.set(id, set);
  }
  set.add(webContents);
  webContents.once('destroyed', () => removeNewMailSubscriber(id, webContents));
}

function removeNewMailSubscriber(id, webContents) {
  const set = newMailSubscribers.get(id);
  if (!set) return;
  set.delete(webContents);
  if (set.size === 0) newMailSubscribers.delete(id);
}

function removeNewMailSubscribers(webContents) {
  if (!webContents) return;
  for (const id of Array.from(newMailSubscribers.keys())) {
    removeNewMailSubscriber(id, webContents);
  }
  // 窗口关闭时同步释放该 owner 持有的 IDLE 长连接，最后一个 owner 离开才真正断开。
  try {
    if (idleService && typeof idleService.stopWatchByOwner === 'function') {
      idleService.stopWatchByOwner(String(webContents.id));
    }
  } catch {
    /* ignore */
  }
}

const getEmailService = () => {
  if (!svc) svc = require('../services/emailService.cjs');
  return svc;
};

const getEmailIdleService = () => {
  if (!idleService) idleService = require('../services/emailIdleService.cjs');
  return idleService;
};

const getEmailOAuthService = () => {
  if (!oauth) oauth = require('../services/emailOAuthService.cjs');
  return oauth;
};

// —— 错误码映射 ——

function toErrorCode(err) {
  if (!err) return 'UNKNOWN';
  const code = String(err.code || '');
  const msg = String(err.message || '');
  const text = `${code} ${msg}`;

  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|getaddrinfo/i.test(text)) {
    return 'NETWORK_ERROR';
  }
  if (/ETIMEDOUT|ESOCKETTIMEDOUT|timed out|timeout/i.test(text)) {
    return 'TIMEOUT';
  }
  if (err.authenticationFailed || /authentication|login failed|invalid credentials|\b535\b|\bAUTH/i.test(text)) {
    return 'AUTH_FAILED';
  }
  if (/NONEXISTENT|MAILBOX|folder.*not|not.*exist/i.test(msg)) {
    return 'BAD_FOLDER';
  }
  return 'UNKNOWN';
}

function toUserError(err) {
  if (!err) return '未知错误';
  switch (toErrorCode(err)) {
    case 'AUTH_FAILED':
      return '认证失败：请检查邮箱地址、密码或授权码';
    case 'NETWORK_ERROR':
      return '无法连接服务器：请检查服务器地址、端口与网络';
    case 'TIMEOUT':
      return '连接超时：请检查网络后重试';
    case 'BAD_FOLDER':
      return '文件夹不存在';
    default:
      return err.message || '未知错误';
  }
}

// —— 通用 handler 包装 ——

function register(name, handler) {
  ipcMain.handle(name, async (_event, payload) => {
    try {
      const data = await handler(payload || {});
      return { ok: true, data };
    } catch (err) {
      console.error(`[emailIpc] ${name} 失败:`, err);
      return { ok: false, error: toUserError(err), code: toErrorCode(err) };
    }
  });
}

// 新邮件事件推送：主窗口 + 所有存活的插件订阅者，统一去重后发送。
// 通道名与载荷结构保持不变，插件无需任何改动。
function pushNewMail(id, evt) {
  const payload = { id, ...evt };
  const targets = new Set();
  const mainWindow = require('../window/mainWindow.cjs').getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) targets.add(mainWindow.webContents);
  const subscribers = newMailSubscribers.get(id);
  if (subscribers) {
    for (const webContents of subscribers) {
      if (webContents && !webContents.isDestroyed()) targets.add(webContents);
    }
  }
  for (const webContents of targets) {
    try {
      webContents.send('email:new-mail', payload);
    } catch {
      /* 单个窗口发送失败不影响其余订阅者 */
    }
  }
}

function registerEmailIpc() {
  if (emailIpcRegistered) return;
  emailIpcRegistered = true;

  const registerService = (name, method) => {
    register(name, (payload) => getEmailService()[method](payload));
  };

  registerService('email:testConnection', 'testConnection');
  registerService('email:listFolders', 'listFolders');
  registerService('email:createFolder', 'createFolder');
  registerService('email:renameFolder', 'renameFolder');
  registerService('email:deleteFolder', 'deleteFolder');
  registerService('email:setFolderSubscribed', 'setFolderSubscribed');
  registerService('email:emptyFolder', 'emptyFolder');
  registerService('email:markFolderSeen', 'markFolderSeen');
  registerService('email:listMessages', 'listMessages');
  registerService('email:getMessage', 'getMessage');
  registerService('email:sendMessage', 'sendMessage');
  registerService('email:setFlags', 'setFlags');
  registerService('email:deleteMessages', 'deleteMessages');
  registerService('email:moveMessages', 'moveMessages');
  registerService('email:getUnreadCounts', 'getUnreadCounts');
  registerService('email:searchMessages', 'searchMessages');

  // IDLE 实时推送：启动监听（每个账号一个长连接），新邮件经主窗口 webContents 推送
  ipcMain.handle('email:watchStart', async (event, payload) => {
    const { id, imap, credential } = payload || {};
    if (!id) return { ok: false, error: '缺少监听标识', code: 'UNKNOWN' };
    try {
      addNewMailSubscriber(id, event.sender);
      getEmailIdleService().startWatch(id, imap, credential, (evt) => pushNewMail(id, evt), String(event.sender.id));
      return { ok: true, data: true };
    } catch (err) {
      console.error('[emailIpc] email:watchStart 失败:', err);
      return { ok: false, error: toUserError(err), code: toErrorCode(err) };
    }
  });

  ipcMain.handle('email:watchStop', async (event, payload) => {
    const { id } = payload || {};
    if (id) removeNewMailSubscriber(id, event.sender);
    if (idleService) idleService.stopWatch(id, String(event.sender.id));
    return { ok: true, data: true };
  });

  // OAuth2 授权码 + PKCE：启动浏览器授权流，返回 { accessToken, refreshToken, expiresAt, ... }
  ipcMain.handle('email:oauthStart', async (_event, payload) => {
    try {
      const data = await getEmailOAuthService().oauthStart(payload || {});
      return { ok: true, data };
    } catch (err) {
      console.error('[emailIpc] email:oauthStart 失败:', err);
      return { ok: false, error: err.message || 'OAuth2 授权失败', code: 'OAUTH_FAILED' };
    }
  });

  // 取消进行中的授权流（浏览器被关闭 / 用户点击取消），释放回跳端口
  ipcMain.handle('email:oauthCancel', async () => {
    try {
      if (oauth) oauth.oauthCancel();
      return { ok: true, data: true };
    } catch (err) {
      console.error('[emailIpc] email:oauthCancel 失败:', err);
      return { ok: false, error: err.message || '取消失败', code: 'OAUTH_FAILED' };
    }
  });

  // 附件下载：主进程弹「另存为」对话框（路径由系统产生，规避路径穿越风险）
  ipcMain.handle('email:getAttachment', async (_event, payload) => {
    const { imap, credential, folder, uid, filename } = payload || {};
    try {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: '保存附件',
        defaultPath: filename || 'attachment',
      });
      if (canceled || !filePath) {
        return { ok: true, data: { saved: false, path: null } };
      }
      const att = await getEmailService().downloadAttachment({ imap, credential, folder, uid, filename });
      await fs.promises.writeFile(filePath, att.content);
      return { ok: true, data: { saved: true, path: filePath } };
    } catch (err) {
      console.error('[emailIpc] email:getAttachment 失败:', err);
      return { ok: false, error: toUserError(err), code: toErrorCode(err) };
    }
  });
}

function disposeEmailServices() {
  newMailSubscribers.clear();
  if (idleService && typeof idleService.stopAll === 'function') idleService.stopAll();
  if (svc && typeof svc.disposePool === 'function') svc.disposePool();
}

module.exports = { registerEmailIpc, disposeEmailServices, removeNewMailSubscribers };
