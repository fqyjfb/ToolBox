// ToolBox/electron/services/emailIdleService.cjs
// IMAP IDLE 常驻监听：每个账号一个长连接，新邮件到达时触发 onEvent 回调（供 emailIpc 推送事件）。
// 连接失败自动指数退避重连；stop 立即释放连接。

const { ImapFlow } = require('imapflow');
const { resolveCredential } = require('./emailOAuthService.cjs');

const CONNECT_TIMEOUT = 15000;
const MAX_RECONNECT_DELAY = 30000;

// id -> { imap, credential, onEvent, client, running, reconnectDelay }
const watches = new Map();

function createClient(imap, credential) {
  const auth = credential.accessToken
    ? { user: credential.username, accessToken: credential.accessToken }
    : { user: credential.username, pass: credential.password };
  return new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure !== false,
    auth,
    logger: false,
    connectionTimeout: CONNECT_TIMEOUT,
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runLoop(id, state) {
  while (state.running) {
    let client = null;
    try {
      // OAuth2 凭据在（重）建连前自动刷新令牌，避免长连接因令牌过期反复失败
      const authCredential = await resolveCredential(state.credential);
      client = createClient(state.imap, authCredential);
      state.client = client;
      client.on('error', () => {}); // 吞掉连接层错误，由重连逻辑接管
      await client.connect();
      state.reconnectDelay = 1000;

      // 先选中 INBOX，再注册 exists 监听，避免初始 SELECT 的 EXISTS 被误判为新邮件
      const lock = await client.getMailboxLock('INBOX');
      client.on('exists', (data) => {
        try {
          state.onEvent({ type: 'new', folder: 'INBOX', count: data ? data.count : null });
        } catch {
          /* ignore */
        }
      });
      try {
        while (state.running) {
          await client.idle(); // 阻塞直到有新事件，然后进入下一轮 idle
        }
      } finally {
        lock.release();
      }
    } catch (e) {
      // 连接中断 / idle 退出：若仍在运行则退避后重连
      if (!state.running) break;
    }

    // 清理本次连接
    try {
      if (client) await client.logout();
    } catch {
      /* ignore */
    }
    state.client = null;

    if (state.running) {
      await sleep(state.reconnectDelay);
      state.reconnectDelay = Math.min(state.reconnectDelay * 2, MAX_RECONNECT_DELAY);
    }
  }
}

function startWatch(id, imap, credential, onEvent) {
  if (watches.has(id)) return;
  const state = {
    imap,
    credential,
    onEvent,
    client: null,
    running: true,
    reconnectDelay: 1000,
  };
  watches.set(id, state);
  runLoop(id, state);
}

function stopWatch(id) {
  const state = watches.get(id);
  if (!state) return;
  state.running = false;
  const client = state.client;
  state.client = null;
  watches.delete(id);
  if (client) {
    try {
      client.close(); // 立即关闭连接，中断 idle
    } catch {
      /* ignore */
    }
  }
}

function stopAll() {
  for (const id of Array.from(watches.keys())) stopWatch(id);
}

module.exports = { startWatch, stopWatch, stopAll };
