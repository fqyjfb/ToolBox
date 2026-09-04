// ToolBox/electron/ipc/emailIpc.cjs
// 邮箱插件 IPC 注册：email:* 通道，统一 { ok, data } / { ok:false, error, code } 返回。
// 与 S3 插件（s3:* 通道）同构：协议库在主进程，插件前端纯 UI。

const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const svc = require('../services/emailService.cjs');
const idleService = require('../services/emailIdleService.cjs');
const oauth = require('../services/emailOAuthService.cjs');

let emailIpcRegistered = false;

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

// 新邮件事件推送到主窗口（供插件前端 onNewMail 订阅）
function pushNewMail(id, evt) {
  const mainWindow = require('../window/mainWindow.cjs').getMainWindow();
  mainWindow?.webContents.send('email:new-mail', { id, ...evt });
}

function registerEmailIpc() {
  if (emailIpcRegistered) return;
  emailIpcRegistered = true;

  register('email:testConnection', svc.testConnection);
  register('email:listFolders', svc.listFolders);
  register('email:createFolder', svc.createFolder);
  register('email:renameFolder', svc.renameFolder);
  register('email:deleteFolder', svc.deleteFolder);
  register('email:setFolderSubscribed', svc.setFolderSubscribed);
  register('email:emptyFolder', svc.emptyFolder);
  register('email:markFolderSeen', svc.markFolderSeen);
  register('email:listMessages', svc.listMessages);
  register('email:getMessage', svc.getMessage);
  register('email:sendMessage', svc.sendMessage);
  register('email:setFlags', svc.setFlags);
  register('email:deleteMessages', svc.deleteMessages);
  register('email:moveMessages', svc.moveMessages);
  register('email:getUnreadCounts', svc.getUnreadCounts);
  register('email:searchMessages', svc.searchMessages);

  // IDLE 实时推送：启动监听（每个账号一个长连接），新邮件经主窗口 webContents 推送
  ipcMain.handle('email:watchStart', async (_event, payload) => {
    const { id, imap, credential } = payload || {};
    if (!id) return { ok: false, error: '缺少监听标识', code: 'UNKNOWN' };
    try {
      idleService.startWatch(id, imap, credential, (evt) => pushNewMail(id, evt));
      return { ok: true, data: true };
    } catch (err) {
      console.error('[emailIpc] email:watchStart 失败:', err);
      return { ok: false, error: toUserError(err), code: toErrorCode(err) };
    }
  });

  ipcMain.handle('email:watchStop', async (_event, payload) => {
    const { id } = payload || {};
    idleService.stopWatch(id);
    return { ok: true, data: true };
  });

  // OAuth2 授权码 + PKCE：启动浏览器授权流，返回 { accessToken, refreshToken, expiresAt, ... }
  ipcMain.handle('email:oauthStart', async (_event, payload) => {
    try {
      const data = await oauth.oauthStart(payload || {});
      return { ok: true, data };
    } catch (err) {
      console.error('[emailIpc] email:oauthStart 失败:', err);
      return { ok: false, error: err.message || 'OAuth2 授权失败', code: 'OAUTH_FAILED' };
    }
  });

  // 取消进行中的授权流（浏览器被关闭 / 用户点击取消），释放回跳端口
  ipcMain.handle('email:oauthCancel', async () => {
    try {
      oauth.oauthCancel();
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
      const att = await svc.downloadAttachment({ imap, credential, folder, uid, filename });
      await fs.promises.writeFile(filePath, att.content);
      return { ok: true, data: { saved: true, path: filePath } };
    } catch (err) {
      console.error('[emailIpc] email:getAttachment 失败:', err);
      return { ok: false, error: toUserError(err), code: toErrorCode(err) };
    }
  });
}

module.exports = { registerEmailIpc };
