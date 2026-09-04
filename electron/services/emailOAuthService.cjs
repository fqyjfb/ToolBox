// ToolBox/electron/services/emailOAuthService.cjs
// 邮箱 OAuth2 授权码 + PKCE 授权服务（Gmail / Outlook）。
//
// 职责：
// 1. 生成授权 URL（授权码 + PKCE），经系统浏览器打开；
// 2. 在本机 loopback（127.0.0.1:<port>）起一个一次性 HTTP 服务器，捕获授权码回跳；
// 3. 用授权码向 token 端点交换 access_token / refresh_token；
// 4. 内存缓存令牌，并提供 getAccessToken 自动刷新（供连接池 / IDLE 复用）。
//
// 安全说明：
// - PKCE（S256）对公共客户端（无 clientSecret）安全；clientSecret 仅在有值时附带。
// - 回跳地址固定为 http://localhost:<port>/callback，state 为 128 位随机串，防 CSRF。
// - loopback 服务器仅绑定 127.0.0.1，令牌不落盘（仅内存缓存）。

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { shell } = require('electron');

const DEFAULT_PORT = 53682; // 固定回跳端口；Google/Azure 原生应用均支持任意端口回跳
const AUTH_TIMEOUT = 5 * 60 * 1000; // 授权页最长等待 5 分钟
const TOKEN_REFRESH_SKEW = 60 * 1000; // 令牌提前 60s 判定过期，留出网络余量

// —— 环境变量加载：开发读取 .env；打包产物从 env-secrets.cjs 读取（CI 构建时生成）——
(function loadEnvSecrets() {
  // 1) 优先加载构建脚本生成的 env-secrets.cjs（生产打包产物内的密钥，不会进 git）
  try {
    const builtIn = require(path.join(__dirname, '..', 'lib', 'env-secrets.cjs'));
    if (builtIn && typeof builtIn === 'object') {
      for (const [k, v] of Object.entries(builtIn)) {
        if (v != null && v !== '' && process.env[k] == null) {
          process.env[k] = String(v);
        }
      }
    }
  } catch {
    /* env-secrets.cjs 不存在（开发模式），继续走 .env 加载 */
  }

  // 2) 开发模式：从项目根目录 .env 读取密钥（轻量解析，不引入 dotenv 依赖）
  try {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const envFile = path.join(projectRoot, '.env');
    if (fs.existsSync(envFile)) {
      const raw = fs.readFileSync(envFile, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        let key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (process.env[key] == null) process.env[key] = value;
      }
    }
  } catch {
    /* 忽略 .env 解析错误 */
  }
})();

// 服务商 OAuth2 端点
const PROVIDERS = {
  gmail: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://mail.google.com/', // IMAP + SMTP 全量访问
  },
  outlook: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send offline_access',
  },
};

// 内置 OAuth 客户端：密钥全部从环境变量读取，禁止硬编码到仓库
// 环境变量名：
//   GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET
//   OUTLOOK_OAUTH_CLIENT_ID / OUTLOOK_OAUTH_CLIENT_SECRET
const DEFAULT_CLIENTS = {
  gmail: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  },
  outlook: {
    clientId: process.env.OUTLOOK_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.OUTLOOK_OAUTH_CLIENT_SECRET || '',
  },
};

// `${provider}:${username}` -> { accessToken, refreshToken, expiresAt }
const tokenCache = new Map();

// —— PKCE 工具 ——

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createVerifier() {
  return base64url(crypto.randomBytes(32));
}

function createChallenge(verifier) {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

// —— HTTPS 表单请求（token 端点） ——

function postForm(url, params) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = params.toString();
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          let json;
          try {
            json = JSON.parse(body);
          } catch {
            reject(new Error('OAuth2 服务端响应异常'));
            return;
          }
          if (res.statusCode >= 400 || json.error) {
            reject(new Error(json.error_description || json.error || `OAuth2 请求失败(${res.statusCode})`));
            return;
          }
          resolve(json);
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('OAuth2 请求超时'));
    });
    req.setTimeout(15000);
    req.write(data);
    req.end();
  });
}

// —— 令牌交换 / 刷新 ——

function exchangeCode(provider, clientId, clientSecret, code, redirectUri, verifier) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  });
  if (clientSecret) params.set('client_secret', clientSecret);
  return postForm(PROVIDERS[provider].tokenUrl, params);
}

function refreshTokens(provider, clientId, clientSecret, refreshToken) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });
  if (clientSecret) params.set('client_secret', clientSecret);
  return postForm(PROVIDERS[provider].tokenUrl, params);
}

// —— loopback 服务器辅助 ——

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => reject(err);
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve(server.address().port);
    });
  });
}

function resultPage(ok, title, message) {
  const color = ok ? '#16a34a' : '#dc2626';
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f6f8;">
<div style="text-align:center;padding:32px 40px;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);">
<div style="font-size:40px;color:${color};">${ok ? '✓' : '✕'}</div>
<h2 style="margin:12px 0 4px;color:#111;">${title}</h2>
<p style="margin:0;color:#555;">${message}</p>
</div></body></html>`;
}

// 从 id_token（JWT）解析邮箱：授权成功即回填账号邮箱，免去用户手动输入
function decodeIdTokenEmail(idToken) {
  if (!idToken) return null;
  try {
    const parts = String(idToken).split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload?.email || payload?.preferred_username || null;
  } catch {
    return null;
  }
}

// —— 授权流（授权码 + PKCE） ——

// 进行中的授权流（同一时刻仅一个：共享固定回跳端口）
let activeAuth = null;

async function oauthStart({ provider, clientId, clientSecret, username }) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error('不支持的 OAuth2 服务商：' + (provider || '(空)'));

  // 优先使用调用方传入的 clientId，否则回退到内置默认客户端
  const defaults = DEFAULT_CLIENTS[provider] || {};
  const resolvedClientId = String(clientId || defaults.clientId || '').trim();
  const resolvedSecret = String(clientSecret || defaults.clientSecret || '').trim() || undefined;
  if (!resolvedClientId) {
    throw new Error(
      '尚未配置 OAuth 客户端：请在主进程 emailOAuthService.cjs 的 DEFAULT_CLIENTS 填入 ' +
        provider +
        ' 的 clientId（或在前端「高级」中填写自定义 clientId）',
    );
  }
  clientId = resolvedClientId;
  clientSecret = resolvedSecret;

  // 同一时刻仅允许一个授权流：先取消上一个并等待其释放回跳端口
  if (activeAuth) {
    activeAuth.cancel();
    await activeAuth.closed;
  }

  const verifier = createVerifier();
  const challenge = createChallenge(verifier);
  const state = crypto.randomBytes(16).toString('hex');

  const server = http.createServer();
  const port = await listen(server, DEFAULT_PORT);
  const redirectUri = `http://localhost:${port}/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: cfg.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline', // 申请 refresh_token（Google 需要；Outlook 忽略该参数）
    prompt: 'consent', // 强制显示授权页，确保拿到 refresh_token
  });
  const authUrl = `${cfg.authUrl}?${params.toString()}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    let handle = null;
    let closeResolve;
    const closed = new Promise((r) => {
      closeResolve = r;
    });
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        server.close(() => closeResolve());
      } catch {
        closeResolve();
      }
      if (activeAuth === handle) activeAuth = null;
      fn(value);
    };
    handle = { cancel: () => finish(reject, new Error('OAuth2 授权已取消')), closed };
    activeAuth = handle;

    timer = setTimeout(() => {
      finish(reject, new Error('OAuth2 授权超时，请重试'));
    }, AUTH_TIMEOUT);

    server.on('request', async (req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const code = url.searchParams.get('code');
      const oauthErr = url.searchParams.get('error');
      const returnedState = url.searchParams.get('state');

      if (oauthErr) {
        res.end(resultPage(false, '授权未完成', '错误：' + oauthErr + '，可关闭此页返回应用。'));
        finish(reject, new Error('OAuth2 授权失败：' + oauthErr));
        return;
      }
      if (returnedState !== state || !code) {
        res.end(resultPage(false, '授权未完成', 'state 校验失败，可关闭此页返回应用。'));
        finish(reject, new Error('OAuth2 state 校验失败'));
        return;
      }

      try {
        const tokens = await exchangeCode(provider, clientId, clientSecret, code, redirectUri, verifier);
        const resolvedUsername =
          decodeIdTokenEmail(tokens.id_token) || String(username || '').trim();
        res.end(
          resultPage(
            true,
            '授权成功',
            resolvedUsername ? '账号 ' + resolvedUsername + ' 已授权，可关闭此页返回应用。' : '可关闭此页返回应用继续添加账号。',
          ),
        );
        const tokenData = {
          provider,
          username: resolvedUsername,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
          clientId,
          clientSecret: clientSecret || undefined,
        };
        tokenCache.set(cacheKey(provider, tokenData.username), {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          expiresAt: tokenData.expiresAt,
        });
        finish(resolve, tokenData);
      } catch (e) {
        res.end(resultPage(false, '授权失败', (e && e.message) || '令牌交换失败，可关闭此页返回应用。'));
        finish(reject, e);
      }
    });

    server.on('error', (e) => finish(reject, e));

    // 打开系统默认浏览器进行授权
    shell.openExternal(authUrl);
  });
}

// 取消当前进行中的授权流（浏览器被关闭 / 用户点击取消时调用）
function oauthCancel() {
  if (activeAuth) activeAuth.cancel();
}

// —— 令牌缓存 / 自动刷新 ——

function cacheKey(provider, username) {
  return `${provider || 'oauth'}:${username || ''}`;
}

// 获取当前可用 access_token：有效则直接返回；过期则用 refresh_token 自动刷新并缓存
async function getAccessToken(credential) {
  if (!credential || !credential.accessToken) return credential?.accessToken ?? null;
  const key = cacheKey(credential.provider, credential.username);
  const cached = tokenCache.get(key);
  const now = Date.now();

  if (cached?.accessToken && cached.expiresAt && now < cached.expiresAt - TOKEN_REFRESH_SKEW) {
    return cached.accessToken;
  }

  const refreshToken = cached?.refreshToken || credential.refreshToken;
  if (!refreshToken) {
    // 无 refresh_token 可刷新，返回当前令牌（可能已过期，交由上层认证失败提示）
    return credential.accessToken;
  }

  const tokens = await refreshTokens(
    credential.provider,
    credential.clientId,
    credential.clientSecret,
    refreshToken,
  );
  const entry = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || refreshToken,
    expiresAt: now + (tokens.expires_in || 3600) * 1000,
  };
  tokenCache.set(key, entry);
  return entry.accessToken;
}

// 将凭据中的 accessToken 解析为「当前可用令牌」；非 OAuth（密码）凭据原样返回
async function resolveCredential(credential) {
  if (!credential || !credential.accessToken) return credential;
  const token = await getAccessToken(credential);
  if (token === credential.accessToken) return credential;
  return { ...credential, accessToken: token };
}

module.exports = {
  oauthStart,
  oauthCancel,
  getAccessToken,
  resolveCredential,
};
