// notesSearchService —— 笔记全文搜索：流式扫描正文 + front matter tag + 文件名，加权打分并做 mtime/size 增量缓存。

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const readline = require('readline');
const { app } = require('electron');
const fileTypeUtils = require('./fileTypeUtils.cjs');

const SEARCH_CACHE_FILENAME = 'search-cache.json';
const SEARCH_CACHE_SUBDIR = 'notes';

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.attachments',
  '.drafts',
  '.vscode',
  '.idea',
]);

const MAX_FILE_BYTES_DEFAULT = 50 * 1024 * 1024;
const MAX_MATCHES_PER_FILE = 25;
const SNIPPET_CONTEXT = 60;

function getCacheFilePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, SEARCH_CACHE_SUBDIR, SEARCH_CACHE_FILENAME);
}

async function loadCache() {
  try {
    const filePath = getCacheFilePath();
    if (!fs.existsSync(filePath)) return {};
    const content = await fsp.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('[notesSearchService] loadCache failed:', err);
    return {};
  }
}

// fire-and-forget：先写 .tmp 再 rename，降低 JSON 损坏概率。
async function saveCache(cache) {
  try {
    const filePath = getCacheFilePath();
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp.${Date.now()}`;
    await fsp.writeFile(tmp, JSON.stringify(cache, null, 2), 'utf-8');
    await fsp.rename(tmp, filePath);
  } catch (err) {
    console.warn('[notesSearchService] saveCache failed:', err);
  }
}

async function collectTextFiles(rootPath, fileTypes) {
  const result = [];

  const wantType = fileTypes && fileTypes.length > 0
    ? new Set(fileTypes)
    : null;

  async function walk(dir) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = entry.name;
      if (!name) continue;
      if (name.startsWith('.') || name.startsWith('~')) continue;
      if (SKIP_DIR_NAMES.has(name)) continue;
      const fullPath = path.join(dir, name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;

      const fileType = fileTypeUtils.getFileType(fullPath);
      if (!fileType) continue;
      if (!fileTypeUtils.isTextFile(fullPath)) continue;
      if (wantType && !wantType.has(fileType)) continue;

      let stat;
      try {
        stat = await fsp.stat(fullPath);
      } catch {
        continue;
      }
      result.push({
        path: fullPath,
        name,
        fileType,
        size: stat.size,
        mtime: stat.mtimeMs,
      });
    }
  }

  await walk(rootPath);
  return result;
}

function trimLine(line, start, end, totalLen) {
  let s = line.slice(start, end);
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  if (start > 0) s = '…' + s;
  if (end < totalLen) s = s + '…';
  return s;
}

function makeSnippet(line, queryLower) {
  const lower = line.toLowerCase();
  const idx = lower.indexOf(queryLower);
  const ctx = SNIPPET_CONTEXT;
  if (idx === -1) {
    return trimLine(line, 0, Math.min(line.length, ctx * 2), line.length);
  }
  const start = Math.max(0, idx - ctx);
  const end = Math.min(line.length, idx + queryLower.length + ctx);
  return trimLine(line, start, end, line.length);
}

// 宽容解析 front matter 的 tags 字段，支持 `tags: [a, b]` 与 YAML list 两种写法。
function parseFrontMatterTags(headText) {
  if (!headText) return [];
  if (!headText.startsWith('---')) return [];
  const endIdx = headText.indexOf('\n---', 3);
  if (endIdx === -1) return [];
  const block = headText.slice(3, endIdx);
  const tags = [];

  const arrayMatch = block.match(/^\s*tags\s*:\s*\[([^\]]*)\]\s*$/im);
  if (arrayMatch) {
    arrayMatch[1].split(',').forEach((t) => {
      const v = t.trim().replace(/^["']|["']$/g, '');
      if (v) tags.push(v);
    });
    return tags;
  }

  const inlineMatch = block.match(/^\s*tags\s*:\s*([^\n]+)$/im);
  if (inlineMatch) {
    const rest = inlineMatch[1].trim();
    if (rest) {
      rest.split(/[\s,]+/).forEach((v) => {
        const v2 = v.replace(/^["']|["']$/g, '');
        if (v2) tags.push(v2);
      });
      return tags;
    }
  }

  const lines = block.split(/\r?\n/);
  let inTagsList = false;
  for (const line of lines) {
    if (/^\s*tags\s*:\s*$/.test(line)) {
      inTagsList = true;
      continue;
    }
    if (inTagsList) {
      const m = line.match(/^\s*-\s*(.+?)\s*$/);
      if (m) {
        tags.push(m[1].replace(/^["']|["']$/g, ''));
      } else if (/^\S/.test(line)) {
        inTagsList = false;
      }
    }
  }
  return tags;
}

// 流式扫描单文件：逐行匹配，仅保留前 HEAD_LINES 行用于 front matter 解析。
function scanFile(file, queryOriginal, queryLower, options) {
  const { maxFileBytes = MAX_FILE_BYTES_DEFAULT } = options || {};
  const matches = [];
  let lineNo = 0;

  if (file.size > maxFileBytes) {
    return Promise.resolve({ matches, lineCount: 0, skipped: true });
  }

  return new Promise((resolve) => {
    let stream;
    try {
      stream = fs.createReadStream(file.path, { encoding: 'utf-8' });
    } catch (err) {
      console.warn('[notesSearchService] createReadStream failed:', file.path, err);
      resolve({ matches, lineCount: 0, skipped: true });
      return;
    }

    const HEAD_LINES = 60;
    let headText = '';

    let tagHitAlreadyAdded = false;

    const fileNameLower = file.name.toLowerCase();
    if (fileNameLower.includes(queryLower)) {
      matches.push({ field: 'title', line: 1, snippet: file.name });
    }

    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    rl.on('line', (line) => {
      lineNo += 1;
      if (lineNo <= HEAD_LINES) {
        headText += line + '\n';
      }
      if (matches.length >= MAX_MATCHES_PER_FILE) return;
      if (line.toLowerCase().includes(queryLower)) {
        matches.push({ field: 'body', line: lineNo, snippet: makeSnippet(line, queryLower) });
      }
    });

    rl.on('close', () => {
      if (!tagHitAlreadyAdded && headText) {
        const tags = parseFrontMatterTags(headText);
        if (tags.some((t) => t.toLowerCase().includes(queryLower))) {
          matches.unshift({
            field: 'tag',
            line: 1,
            snippet: `tags: ${tags.join(', ')}`,
          });
          tagHitAlreadyAdded = true;
        }
      }
      resolve({ matches, lineCount: lineNo, skipped: false });
    });

    rl.on('error', (err) => {
      console.warn('[notesSearchService] readline error:', file.path, err);
      resolve({ matches, lineCount: lineNo, skipped: false });
    });
  });
}

// 全文搜索入口：收集候选 → 扫描/读缓存 → 打分排序 → 截断。
async function searchNotes(opts) {
  const startTime = Date.now();

  const rootPath = opts && typeof opts.rootPath === 'string' ? opts.rootPath : '';
  const queryRaw = opts && typeof opts.query === 'string' ? opts.query.trim() : '';
  const fileTypes = opts && Array.isArray(opts.fileTypes) ? opts.fileTypes : null;
  const maxResults = typeof opts?.maxResults === 'number' && opts.maxResults > 0 ? opts.maxResults : 50;
  const caseSensitive = !!opts?.caseSensitive;
  const maxFileBytes = typeof opts?.maxFileBytes === 'number' && opts.maxFileBytes > 0
    ? opts.maxFileBytes
    : MAX_FILE_BYTES_DEFAULT;

  const empty = (extra = {}) => ({
    success: true,
    results: [],
    scanned: 0,
    truncated: false,
    elapsedMs: Date.now() - startTime,
    ...extra,
  });

  if (!rootPath) {
    return { ...empty({ success: false }), error: '未提供 rootPath' };
  }
  if (!queryRaw) {
    return empty();
  }

  const queryLower = caseSensitive ? queryRaw : queryRaw.toLowerCase();

  let cache = {};
  try {
    const allFiles = await collectTextFiles(rootPath, fileTypes);
    const candidates = allFiles.filter((f) => f.size <= maxFileBytes);
    const skippedBySize = allFiles.length - candidates.length;

    cache = await loadCache();

    const fileResults = [];
    let scannedTotal = 0;

    for (const file of candidates) {
      const cached = cache[file.path];
      let fileMatches;

      const cacheValid = cached
        && cached.mtime === file.mtime
        && cached.size === file.size
        && cached.cachedQuery === queryLower
        && Array.isArray(cached.matches);

      if (cacheValid) {
        fileMatches = cached.matches.slice(0, MAX_MATCHES_PER_FILE);
      } else {
        const scanRes = await scanFile(file, queryRaw, queryLower, { maxFileBytes });
        fileMatches = scanRes.matches;
        cache[file.path] = {
          mtime: file.mtime,
          size: file.size,
          indexedAt: Date.now(),
          cachedQuery: queryLower,
          matches: fileMatches,
        };
      }
      scannedTotal += 1;

      if (fileMatches.length > 0) {
        let score = 0;
        let bodyHits = 0;
        let titleHits = 0;
        let tagHits = 0;
        for (const m of fileMatches) {
          if (m.field === 'title') {
            score += 10;
            titleHits += 1;
          } else if (m.field === 'tag') {
            score += 8;
            tagHits += 1;
          } else if (m.field === 'body') {
            score += 1;
            bodyHits += 1;
          }
        }
        fileResults.push({
          path: file.path,
          name: file.name,
          fileType: file.fileType,
          score,
          titleHits,
          tagHits,
          bodyHits,
          size: file.size,
          mtime: file.mtime,
          matches: fileMatches,
        });
      }
    }

    fileResults.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.bodyHits !== a.bodyHits) return b.bodyHits - a.bodyHits;
      if (b.titleHits !== a.titleHits) return b.titleHits - a.titleHits;
      if (b.tagHits !== a.tagHits) return b.tagHits - a.tagHits;
      return a.size - b.size;
    });

    const truncated = fileResults.length > maxResults;
    const sliced = truncated ? fileResults.slice(0, maxResults) : fileResults;

    saveCache(cache).catch(() => {});

    return {
      success: true,
      results: sliced,
      scanned: scannedTotal + skippedBySize,
      truncated,
      elapsedMs: Date.now() - startTime,
    };
  } catch (err) {
    console.error('[notesSearchService] searchNotes failed:', err);
    return {
      success: false,
      results: [],
      scanned: 0,
      truncated: false,
      elapsedMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : '搜索失败',
    };
  }
}

module.exports = {
  searchNotes,
  collectTextFiles,
  parseFrontMatterTags,
  makeSnippet,
  loadCache,
  saveCache,
  MAX_FILE_BYTES_DEFAULT,
};
