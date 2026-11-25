// ToolBox/electron/services/emailService.cjs
// 邮箱协议层：IMAP 收信（imapflow）+ SMTP 发信（nodemailer）+ MIME 解析（mailparser）
// 均 MIT 许可，可闭源发布。方法名与参数对照 imapflow / nodemailer / mailparser 官方文档。
//
// 说明：
// - 凭据（credential）每次由插件前端临时传入，本层不持久化、不落盘。
// - 按账号维护 IMAP 连接池：同一账号的操作串行复用连接（异步互斥），空闲超时回收、出错驱逐，
//   避免每次操作重复「建连 + TLS 握手 + 认证」导致的卡顿。
// - OAuth2 凭据在建立连接前经 emailOAuthService.resolveCredential 自动刷新令牌。
// - IMAP 分页采用「序号区间（seq range）」：total - offset 反推起止序号。

const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const { resolveCredential } = require('./emailOAuthService.cjs');

const CONNECT_TIMEOUT = 15000; // 连接/握手总超时（毫秒）
const POOL_IDLE_TTL = 2 * 60 * 1000; // 空闲连接回收阈值（毫秒）

// —— 客户端构造 ——

// 构造 IMAP 客户端（密码 / OAuth 二选一）
function createImapClient(imap, credential) {
  const auth = credential.accessToken
    ? { user: credential.username, accessToken: credential.accessToken }
    : { user: credential.username, pass: credential.password };

  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure !== false,
    auth,
    logger: false,
    connectionTimeout: CONNECT_TIMEOUT,
  });
  // 吞掉连接建立后异步触发的底层 socket 错误（如 ECONNRESET），避免其成为主进程未捕获异常；
  // 连接/操作阶段错误仍由各方法内 await 抛出并交由 emailIpc 统一转为友好提示。
  client.on('error', () => {});
  return client;
}

// 构造 SMTP 传输器
function createSmtpTransport(smtp, credential) {
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465, // 465 隐式 TLS；其余端口走 STARTTLS
    auth: credential.accessToken
      ? { type: 'OAuth2', user: credential.username, accessToken: credential.accessToken }
      : { user: credential.username, pass: credential.password },
    connectionTimeout: CONNECT_TIMEOUT,
    greetingTimeout: CONNECT_TIMEOUT,
    socketTimeout: 30000,
  });
  transport.on('error', () => {});
  return transport;
}

// —— 连接池 ——

// key -> { client, busy, lastUsed, tail }（tail 为串行化互斥链的尾 Promise）
const pool = new Map();

function poolKey(imap, credential) {
  return `${imap.host}:${imap.port}:${credential.username}`;
}

function getOrCreateEntry(key) {
  let entry = pool.get(key);
  if (!entry) {
    entry = { client: null, busy: false, lastUsed: Date.now(), tail: Promise.resolve(), reapTimer: null };
    pool.set(key, entry);
  } else if (entry.reapTimer) {
    clearTimeout(entry.reapTimer);
    entry.reapTimer = null;
  }
  return entry;
}

function scheduleEntryReap(key) {
  const entry = pool.get(key);
  if (!entry) return;
  if (entry.reapTimer) clearTimeout(entry.reapTimer);
  entry.reapTimer = setTimeout(() => {
    entry.reapTimer = null;
    if (entry.busy || !entry.client) return;
    try {
      entry.client.close();
    } catch {
      /* ignore */
    }
    entry.client = null;
    pool.delete(key);
  }, POOL_IDLE_TTL);
}

// 在同一账号连接上串行执行 fn(client)，连接按需创建/复用，出错自动断开重建
async function withClient(imap, credential, fn) {
  const entry = getOrCreateEntry(poolKey(imap, credential));

  // 异步互斥：等待前序操作完成，保证同一 ImapFlow 连接不被并发使用
  let release;
  const gate = new Promise((r) => (release = r));
  const prev = entry.tail;
  entry.tail = gate;
  await prev;

  entry.busy = true;
  entry.lastUsed = Date.now();
  try {
    if (!entry.client) {
      // 建连前解析 OAuth2 令牌（密码凭据原样返回）
      const authCredential = await resolveCredential(credential);
      entry.client = createImapClient(imap, authCredential);
      await entry.client.connect();
    }
    return await fn(entry.client);
  } catch (err) {
    // 连接可能已损坏：关闭并置空，下次调用重建
    try {
      entry.client?.close();
    } catch {
      /* ignore */
    }
    entry.client = null;
    throw err;
  } finally {
    entry.busy = false;
    entry.lastUsed = Date.now();
    release();
    scheduleEntryReap(poolKey(imap, credential));
  }
}

// 退出时关闭池中所有连接，释放服务端资源
function disposePool() {
  for (const [, entry] of pool) {
    if (entry.reapTimer) {
      clearTimeout(entry.reapTimer);
      entry.reapTimer = null;
    }
    try {
      entry.client?.close();
    } catch {
      /* ignore */
    }
    entry.client = null;
  }
  pool.clear();
}

// —— 连接 / 文件夹 ——

// 测试连接（独立建连，验证凭据/服务器可用性）
async function testConnection({ imap, credential }) {
  const authCredential = await resolveCredential(credential);
  const client = createImapClient(imap, authCredential);
  await client.connect();
  await client.logout();
  return { ok: true };
}

// list() 原始项 → 前端 Folder 结构（delimiter 供前端还原层级树）
function toFolderMeta(m) {
  return {
    path: m.path,
    delimiter: m.delimiter || '/',
    specialUse: m.specialUse || null,
    subscribed: m.subscribed,
  };
}

// 服务端层级分隔符（NAMESPACE 随建连获取，缺失回退 RFC 常用 '/'）
function folderDelimiter(client) {
  return (client.namespace && client.namespace.delimiter) || '/';
}

// 列出文件夹（含特殊用途 \Sent \Trash \Drafts 等）
async function listFolders({ imap, credential }) {
  return withClient(imap, credential, async (client) => (await client.list()).map(toFolderMeta));
}

// 新建文件夹：parent 为空建在根层级。imapflow 的 CREATE 成功后自动 SUBSCRIBE，回传最新列表
async function createFolder({ imap, credential, parent, name }) {
  return withClient(imap, credential, async (client) => {
    const path = parent ? `${parent}${folderDelimiter(client)}${name}` : name;
    const res = await client.mailboxCreate(path);
    if (res && res.created === false) throw new Error('文件夹已存在');
    return (await client.list()).map(toFolderMeta);
  });
}

// 重命名：仅替换末级名称、保留所属层级，回传最新列表与新完整路径
async function renameFolder({ imap, credential, path, name }) {
  return withClient(imap, credential, async (client) => {
    const delim = folderDelimiter(client);
    const cut = path.lastIndexOf(delim);
    const newPath = cut >= 0 ? path.slice(0, cut + delim.length) + name : name;
    const res = await client.mailboxRename(path, newPath);
    return { folders: (await client.list()).map(toFolderMeta), path: (res && res.newPath) || newPath };
  });
}

// 删除文件夹，回传最新列表
async function deleteFolder({ imap, credential, path }) {
  return withClient(imap, credential, async (client) => {
    await client.mailboxDelete(path);
    return (await client.list()).map(toFolderMeta);
  });
}

// 订阅 / 取消订阅（决定文件夹是否出现在 LSUB 列表），回传最新列表
async function setFolderSubscribed({ imap, credential, path, subscribed }) {
  return withClient(imap, credential, async (client) => {
    if (subscribed) await client.mailboxSubscribe(path);
    else await client.mailboxUnsubscribe(path);
    return (await client.list()).map(toFolderMeta);
  });
}

// 清空文件夹：全部标记 \Deleted 后 EXPUNGE（空文件夹直接返回）
async function emptyFolder({ imap, credential, path }) {
  return withClient(imap, credential, async (client) => {
    const lock = await client.getMailboxLock(path);
    try {
      if (client.mailbox.exists) await client.messageDelete({ all: true }, { uid: true });
      return { ok: true };
    } finally {
      lock.release();
    }
  });
}

// 文件夹内全部标记已读（空文件夹直接返回）
async function markFolderSeen({ imap, credential, path }) {
  return withClient(imap, credential, async (client) => {
    const lock = await client.getMailboxLock(path);
    try {
      if (client.mailbox.exists) await client.messageFlagsAdd({ all: true }, ['\\Seen'], { uid: true });
      return { ok: true };
    } finally {
      lock.release();
    }
  });
}

// —— 邮件 ——

// 分页拉取邮件头（序号区间分页，最新在前）
async function listMessages({ imap, credential, folder, offset = 0, limit = 50 }) {
  return withClient(imap, credential, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const total = client.mailbox.exists;
      const start = Math.max(1, total - offset - limit + 1);
      const end = total - offset;
      if (end < 1) return { messages: [], total, hasMore: false };

      const messages = [];
      for await (const m of client.fetch(`${start}:${end}`, {
        envelope: true,
        flags: true,
        internalDate: true,
        bodyStructure: true,
      })) {
        messages.push({
          uid: m.uid,
          messageId: m.envelope?.messageId || null,
          from: m.envelope?.from?.[0] || null,
          subject: m.envelope?.subject || '(无主题)',
          seen: m.flags ? m.flags.has('\\Seen') : false,
          hasAttachment: hasAttachment(m.bodyStructure),
          date: m.internalDate ? m.internalDate.getTime() : Date.now(),
        });
      }
      messages.reverse(); // fetch 按序号升序（旧→新），反转为新→旧
      return { messages, total, hasMore: start > 1 };
    } finally {
      lock.release();
    }
  });
}

// —— 正文解析缓存（LRU + TTL）——
// 同一封邮件（账号 + 文件夹 + uid）只下载并 simpleParser 一次；重复打开 / 取附件命中缓存，
// 消除反复打开大邮件的网络与解析开销。删除 / 移动时主动失效。
const BODY_CACHE_MAX = 30;
const BODY_CACHE_TTL = 10 * 60 * 1000; // 10 分钟
const bodyCache = new Map(); // key -> { parsed, ts }

function bodyCacheKey(imap, credential, folder, uid) {
  return `${imap.host}:${credential.username}:${folder}:${uid}`;
}

function getBodyCache(key) {
  const entry = bodyCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > BODY_CACHE_TTL) {
    bodyCache.delete(key);
    return null;
  }
  // LRU：命中移到末尾
  bodyCache.delete(key);
  bodyCache.set(key, entry);
  return entry.parsed;
}

function setBodyCache(key, parsed) {
  if (bodyCache.has(key)) bodyCache.delete(key);
  else if (bodyCache.size >= BODY_CACHE_MAX) {
    const first = bodyCache.keys().next().value;
    if (first != null) bodyCache.delete(first);
  }
  bodyCache.set(key, { parsed, ts: Date.now() });
}

function invalidateBodyCache(imap, credential, folder, uids) {
  if (!uids || !uids.length) return;
  for (const uid of uids) bodyCache.delete(bodyCacheKey(imap, credential, folder, uid));
}

// mailparser 结果 → getMessage 返回结构（纯元数据，不含附件内容 Buffer）
function parsedToDetail(parsed, uid) {
  return {
    uid,
    messageId: parsed.messageId || null,
    from: parsed.from?.value?.[0] || null,
    to: parsed.to?.value || [],
    cc: parsed.cc?.value || [],
    subject: parsed.subject || '(无主题)',
    text: parsed.text || null,
    html: parsed.html ? String(parsed.html) : null,
    date: parsed.date ? parsed.date.getTime() : Date.now(),
    attachments: (parsed.attachments || []).map((a) => ({
      filename: a.filename || '未命名附件',
      contentType: a.contentType || 'application/octet-stream',
      size: a.size || 0,
      cid: a.cid || null,
    })),
  };
}

// 拉取单封完整邮件（正文 + 附件元数据；附件内容不返回，走 downloadAttachment）
async function getMessage({ imap, credential, folder, uid }) {
  const key = bodyCacheKey(imap, credential, folder, uid);
  const cached = getBodyCache(key);
  if (cached) return parsedToDetail(cached, uid);
  return withClient(imap, credential, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const { content } = await client.download(uid, undefined, { uid: true });
      const buf = await streamToBuffer(content);
      const parsed = await simpleParser(buf);
      setBodyCache(key, parsed);
      return parsedToDetail(parsed, uid);
    } finally {
      lock.release();
    }
  });
}

// 下载附件内容（返回 Buffer，由 emailIpc 负责弹框与落盘）
// 命中正文缓存则不再下载整封邮件；未命中才下载并回填缓存。
async function downloadAttachment({ imap, credential, folder, uid, filename }) {
  const key = bodyCacheKey(imap, credential, folder, uid);
  let parsed = getBodyCache(key);
  if (!parsed) {
    parsed = await withClient(imap, credential, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const { content } = await client.download(uid, undefined, { uid: true });
        const buf = await streamToBuffer(content);
        const p = await simpleParser(buf);
        setBodyCache(key, p);
        return p;
      } finally {
        lock.release();
      }
    });
  }
  const att = (parsed.attachments || []).find((a) => a.filename === filename);
  if (!att) throw new Error('未找到对应附件');
  return {
    filename: att.filename,
    contentType: att.contentType || 'application/octet-stream',
    content: att.content,
  };
}

// 发送邮件（支持回复线程 inReplyTo / references）
async function sendMessage({ smtp, credential, mail }) {
  const authCredential = await resolveCredential(credential);
  const transporter = createSmtpTransport(smtp, authCredential);
  const info = await transporter.sendMail({
    from: mail.from,
    to: mail.to,
    cc: mail.cc,
    bcc: mail.bcc,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    inReplyTo: mail.inReplyTo,
    references: mail.references,
    attachments: (mail.attachments || []).map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
  return { messageId: info.messageId, accepted: info.accepted };
}

// 标记已读 / 未读（add=true 加 flags，add=false 移除）
async function setFlags({ imap, credential, folder, uids, add, flags }) {
  return withClient(imap, credential, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const range = uids.join(',');
      if (add) await client.messageFlagsAdd(range, flags, { uid: true });
      else await client.messageFlagsRemove(range, flags, { uid: true });
      return { ok: true };
    } finally {
      lock.release();
    }
  });
}

// 删除：优先移入垃圾箱，无垃圾箱则硬删
async function deleteMessages({ imap, credential, folder, trashFolder, uids }) {
  return withClient(imap, credential, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const range = uids.join(',');
      if (trashFolder && trashFolder !== folder) {
        await client.messageMove(range, trashFolder, { uid: true });
      } else {
        await client.messageDelete(range, { uid: true });
      }
      invalidateBodyCache(imap, credential, folder, uids);
      return { ok: true };
    } finally {
      lock.release();
    }
  });
}

// 移动邮件到指定文件夹
async function moveMessages({ imap, credential, fromFolder, toFolder, uids }) {
  return withClient(imap, credential, async (client) => {
    const lock = await client.getMailboxLock(fromFolder);
    try {
      await client.messageMove(uids.join(','), toFolder, { uid: true });
      invalidateBodyCache(imap, credential, fromFolder, uids);
      return { ok: true };
    } finally {
      lock.release();
    }
  });
}

// 查询各文件夹未读数（IMAP STATUS，用于侧边栏未读角标）
// 返回 { [folder]: unseen }，单个文件夹查询失败记为 0（不阻断整体）
// 仅统计收件箱（\\Inbox）未读数：路径与大小写由 specialUse 优先判定，
// 不再遍历所有 folder；省去 N-1 次 IMAP 往返且消除 path 大小写差异导致的 0/NaN
async function getUnreadCounts({ imap, credential }) {
  return withClient(imap, credential, async (client) => {
    const list = await client.list();
    const inbox = list.find((b) => b.specialUse === '\\Inbox' || b.path.toLowerCase() === 'inbox');
    if (!inbox) return { INBOX: 0 };
    try {
      const st = await client.status(inbox.path, { unseen: true });
      return { INBOX: st.unseen || 0 };
    } catch {
      return { INBOX: 0 };
    }
  });
}

// 全文搜索（IMAP SEARCH：主题 / 发件人 / 正文 任一匹配）
async function searchMessages({ imap, credential, folder, query, limit = 50 }) {
  const q = String(query || '').trim();
  if (!q) return { messages: [], total: 0 };
  return withClient(imap, credential, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const uids = await client.search(
        { or: [{ from: q }, { subject: q }, { body: q }] },
        { uid: true },
      );
      if (!uids || uids.length === 0) return { messages: [], total: 0 };
      const picked = uids.slice(-limit); // uid 单调递增，取最新 limit 封
      const messages = [];
      for await (const m of client.fetch(picked, {
        envelope: true,
        flags: true,
        internalDate: true,
        bodyStructure: true,
      }, { uid: true })) {
        messages.push({
          uid: m.uid,
          messageId: m.envelope?.messageId || null,
          from: m.envelope?.from?.[0] || null,
          subject: m.envelope?.subject || '(无主题)',
          seen: m.flags ? m.flags.has('\\Seen') : false,
          hasAttachment: hasAttachment(m.bodyStructure),
          date: m.internalDate ? m.internalDate.getTime() : Date.now(),
        });
      }
      messages.reverse();
      return { messages, total: uids.length };
    } finally {
      lock.release();
    }
  });
}

// —— 辅助 ——

// 判断邮件是否含附件（bodyStructure 递归；disposition === 'attachment'）
function hasAttachment(node) {
  if (!node) return false;
  if (Array.isArray(node.childNodes)) return node.childNodes.some(hasAttachment);
  return node.disposition === 'attachment';
}

// 上限保护：整封邮件（含附件）会一次性读入内存，超大附件曾可打爆主进程。
// 拒绝时直接给出友好错误（调用方 catch 后经 IPC 返回，无需再映射）。
function streamToBuffer(stream, maxBytes = 100 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    stream.on('data', (c) => {
      total += c.length;
      if (total > maxBytes) {
        stream.destroy();
        reject(new Error('邮件过大（超过 100MB），无法读取'));
        return;
      }
      chunks.push(c);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

module.exports = {
  testConnection,
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  setFolderSubscribed,
  emptyFolder,
  markFolderSeen,
  listMessages,
  getMessage,
  downloadAttachment,
  sendMessage,
  setFlags,
  deleteMessages,
  moveMessages,
  getUnreadCounts,
  searchMessages,
  disposePool,
};
