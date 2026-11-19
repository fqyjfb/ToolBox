import { iconCacheService, type IconCacheType } from './iconCacheService';
import { isElectron } from '../utils/environment';

// 微批合并窗口：卡片逐个挂载时，同一窗口内到达的请求合并成一次解析
const BATCH_WINDOW_MS = 16;
// Web 端单个图标的候选竞速上限
const WEB_FETCH_TIMEOUT_MS = 8000;
// 结果条数上限，与磁盘缓存 maxItems 对齐；超出按最早写入淘汰
const MAX_RESOLVED = 500;

// 已解析地址的跨进程持久化：主进程磁盘缓存只有 IPC 异步通道可取，
// 这里在渲染层同步回填一份地址映射，让重启后首帧即可出图。
// TTL 与主进程 iconCache.ttl（config.cjs）保持一致为 7 天；
// 仅 Electron 持久化 local-media: 地址，Web 的 blob: 重启后必然失效。
const PERSIST_KEY = 'toolbox_icon_resolved_v1';
const PERSIST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
type PersistedEntry = { value: string; ts: number };

const cacheKey = (url: string, type: IconCacheType) => `${type}:${url}`;

// 解析结果：{ key => 可直接用于 <img> 的地址 }。
// Electron 为 local-media://，Web 为 blob:；解析失败不记录，下次挂载可重试。
const resolved = new Map<string, string>();
let persisted: Record<string, PersistedEntry> | null = null;

const loadPersisted = (): Record<string, PersistedEntry> => {
  if (persisted) return persisted;
  persisted = {};
  if (!isElectron() || typeof localStorage === 'undefined') return persisted;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return persisted;
    const parsed = JSON.parse(raw) as Record<string, PersistedEntry>;
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed || {})) {
      if (!entry || typeof entry.value !== 'string' || !entry.value.startsWith('local-media:')) continue;
      if (!Number.isFinite(entry.ts) || now - entry.ts > PERSIST_TTL_MS) continue;
      // 直接写入内存表，不再走 remember()，避免启动期重复落盘
      resolved.set(key, entry.value);
      persisted[key] = entry;
    }
  } catch {
    persisted = {};
  }
  return persisted;
};

const savePersisted = (): void => {
  if (!persisted || !isElectron() || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(persisted));
  } catch {
    // 配额不足时退化为「仅内存表」，不影响图标渲染
  }
};

if (isElectron()) loadPersisted();

const revoke = (value: string) => {
  if (value.startsWith('blob:')) URL.revokeObjectURL(value);
};

const remember = (key: string, value: string) => {
  const previous = resolved.get(key);
  if (previous !== undefined) revoke(previous);
  resolved.set(key, value);

  if (isElectron()) {
    const store = loadPersisted();
    if (value.startsWith('local-media:')) store[key] = { value, ts: Date.now() };
    else delete store[key];
    savePersisted();
  }

  if (resolved.size <= MAX_RESOLVED) return;
  const oldest = resolved.keys().next().value;
  if (oldest === undefined || oldest === key) return;
  const oldestValue = resolved.get(oldest);
  if (oldestValue !== undefined) revoke(oldestValue);
  resolved.delete(oldest);
  if (persisted && delete persisted[oldest]) savePersisted();
};

/** 地址失效（磁盘缓存被淘汰/文件缺失）时清除映射，供组件重试解析 */
const forget = (url: string, type: IconCacheType): void => {
  const key = cacheKey(url, type);
  const value = resolved.get(key);
  if (value !== undefined) revoke(value);
  resolved.delete(key);
  if (persisted && delete persisted[key]) savePersisted();
};

/** 同步读取已解析结果，供首帧直接出图；未解析过返回 undefined */
const peek = (url: string, type: IconCacheType): string | undefined => resolved.get(cacheKey(url, type));

// ---------------------------------------------------------------------------
// 两条解析通道：Electron 走主进程批量 IPC，Web 走 Cache API + 候选竞速
// ---------------------------------------------------------------------------

const resolveViaElectron = async (
  urls: string[],
  type: IconCacheType
): Promise<Map<string, string>> => {
  const results = new Map<string, string>();
  if (!window.electron?.resolveIcons) return results;

  try {
    const resolvedMap = await window.electron.resolveIcons(urls, type);
    for (const url of urls) {
      const localUrl = resolvedMap?.[url];
      if (localUrl) results.set(url, localUrl);
    }
  } catch {
    // IPC 失败按「全部拿不到」处理，由渲染层显示兜底图标
  }
  return results;
};

const fetchOne = async (url: string, controller: AbortController): Promise<Response> => {
  const timer = setTimeout(() => controller.abort(), WEB_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
};

// 直连常被 CORS 拦下、weserv 代理可补上，两者并发竞速，先返回可用响应者胜
const fetchWithRace = async (urls: string[]): Promise<Response | null> => {
  if (urls.length === 0) return null;

  // 每个候选各持一个 controller：共用 controller 会连胜者的响应体一起中止，
  // 之后 response.blob() 就读不出来了。落败者才需要中止。
  const entries = urls.map((url) => ({ url, controller: new AbortController() }));

  try {
    if (entries.length === 1) return await fetchOne(entries[0].url, entries[0].controller);

    const won = await Promise.any(
      entries.map(async (entry) => ({ entry, response: await fetchOne(entry.url, entry.controller) }))
    );
    for (const entry of entries) {
      if (entry !== won.entry) entry.controller.abort();
    }
    return won.response;
  } catch {
    return null;
  }
};

const resolveViaWeb = async (
  urls: string[],
  type: IconCacheType
): Promise<Map<string, string>> => {
  const results = new Map<string, string>();

  await Promise.all(urls.map(async (url) => {
    const cached = await iconCacheService.get(url, type);
    if (cached) {
      results.set(url, URL.createObjectURL(await cached.blob()));
      return;
    }

    const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
    const response = await fetchWithRace(proxied === url ? [url] : [url, proxied]);
    if (!response) return;

    await iconCacheService.set(url, response.clone(), type);
    results.set(url, URL.createObjectURL(await response.blob()));
  }));

  return results;
};

// ---------------------------------------------------------------------------
// 微批调度
// ---------------------------------------------------------------------------

type Batch = {
  urls: Set<string>;
  type: IconCacheType;
  started: boolean;
  promise: Promise<void>;
};

const batches = new Map<IconCacheType, Batch>();

const openBatch = (type: IconCacheType): Batch => {
  let finish = () => {};
  const promise = new Promise<void>((resolve) => { finish = resolve; });

  const batch: Batch = { urls: new Set(), type, started: false, promise };
  setTimeout(() => {
    batch.started = true;
    batches.delete(type);
    void run(batch.urls, type).finally(finish);
  }, BATCH_WINDOW_MS);

  batches.set(type, batch);
  return batch;
};

// 发车后到落地前，同 key 的后续调用直接复用在途批次，不再另起一次 IPC
const inflight = new Map<string, Promise<void>>();

const run = async (urls: Set<string>, type: IconCacheType): Promise<void> => {
  const list = [...urls];
  if (list.length === 0) return;

  const results = isElectron()
    ? await resolveViaElectron(list, type)
    : await resolveViaWeb(list, type);

  for (const url of list) {
    const key = cacheKey(url, type);
    inflight.delete(key);
    const value = results.get(url);
    // 失败的刻意不记录，下次挂载可以重试（网络恢复后无需重启）
    if (value) remember(key, value);
  }
};

/**
 * 保证给定 URL 已完成一次解析尝试。
 * 同一窗口内的调用合并成一次 IPC（Electron）或一批本地加载（Web），
 * 避免每张卡片各自发起一次请求。
 */
const ensure = (urls: string[], type: IconCacheType): Promise<void> => {
  const waiting: Promise<void>[] = [];
  const missing: string[] = [];

  for (const url of urls) {
    if (!url) continue;
    const key = cacheKey(url, type);
    if (resolved.has(key)) continue;
    const pending = inflight.get(key);
    if (pending) waiting.push(pending);
    else missing.push(url);
  }

  if (waiting.length === 0 && missing.length === 0) return Promise.resolve();

  let promises = waiting;
  if (missing.length > 0) {
    // 已发车的批次不能再追加，否则新来的 URL 会跟着一批不包含它的请求一起返回
    const current = batches.get(type);
    const batch = current && !current.started ? current : openBatch(type);
    for (const url of missing) {
      batch.urls.add(url);
      inflight.set(cacheKey(url, type), batch.promise);
    }
    promises = [...waiting, batch.promise];
  }

  return Promise.all(promises).then(() => undefined);
};

export const iconResolver = { peek, ensure, forget };
export type { IconCacheType };
