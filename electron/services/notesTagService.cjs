// notesTagService —— 标签优先写文件 YAML front matter；读不到则回退 notes_settings.json.tag_overrides 侧挂表。

const fs = require('fs');
const path = require('path');
const notesService = require('./notesService.cjs');

const TAG_OVERRIDES_KEY = 'tag_overrides';
const SKIP_DIR_NAMES = new Set(['node_modules', '.git', '.attachments', '.drafts', '.vscode', '.idea']);
// front matter 只可能出现在文本笔记里，二进制（视频/图片/PDF/Office）不读内容
const TAG_SOURCE_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.html', '.htm', '.json']);
const MAX_TAG_SOURCE_BYTES = 50 * 1024 * 1024;

// 取用于解析 front matter 的文本；null = 不该读/读不到，调用方走侧挂表兜底
// 双闸门（扩展名 + 体积）必需：GB 级文件整包读成字符串会让主进程直接 abort
function readTagSource(absolutePath) {
  if (!TAG_SOURCE_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())) return null;
  try {
    if (fs.statSync(absolutePath).size > MAX_TAG_SOURCE_BYTES) return null;
    return fs.readFileSync(absolutePath, 'utf-8');
  } catch {
    return null;
  }
}

// --- 内部工具 ---

function getOverridesMap() {
  try {
    const raw = notesService.getSetting(TAG_OVERRIDES_KEY);
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  } catch {}
  return {};
}

function saveOverridesMap(map) {
  try { notesService.saveSetting(TAG_OVERRIDES_KEY, map); return true; }
  catch (error) { console.error('[notesTagService] saveOverridesMap failed:', error); return false; }
}

function normalizeTags(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const t of input) {
    if (typeof t !== 'string') continue;
    const v = t.trim().replace(/^["']|["']$/g, '');
    if (!v || seen.has(v)) continue;
    seen.add(v); out.push(v);
  }
  return out;
}

// --- front matter 解析 ---

// 仅识别 `---\n...\n---\n` 起首块；null 表示无 front matter。
function extractFrontMatter(content) {
  if (typeof content !== 'string' || !content.startsWith('---')) return null;
  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) return null;
  const yaml = content.slice(3, endIdx).replace(/\r/g, '');
  const body = content.slice(endIdx + 4).replace(/^\r?\n/, '');
  return { yaml, body };
}

// 解析 YAML `tags:` 字段（数组 / 行内 / YAML list 三种写法）。
function parseTagsFromYaml(yaml) {
  if (!yaml) return [];
  const tags = [];

  // 形式 1：tags: [a, b, c]
  const arrayMatch = yaml.match(/^\s*tags\s*:\s*\[([^\]]*)\]\s*$/im);
  if (arrayMatch) {
    arrayMatch[1].split(',').forEach((t) => {
      const v = t.trim().replace(/^["']|["']$/g, '');
      if (v) tags.push(v);
    });
    return tags;
  }
  // 形式 2：tags: a b c
  const inlineMatch = yaml.match(/^\s*tags\s*:\s*([^\n]+)$/im);
  if (inlineMatch) {
    const rest = inlineMatch[1].trim();
    if (rest && !rest.startsWith('-')) {
      rest.split(/[\s,]+/).forEach((v) => {
        const v2 = v.replace(/^["']|["']$/g, '');
        if (v2) tags.push(v2);
      });
      return tags;
    }
  }
  // 形式 3：tags:\n  - a\n  - b
  const lines = yaml.split(/\r?\n/);
  let inList = false;
  for (const line of lines) {
    if (/^\s*tags\s*:\s*$/.test(line)) { inList = true; continue; }
    if (inList) {
      const m = line.match(/^\s*-\s*(.+?)\s*$/);
      if (m) tags.push(m[1].replace(/^["']|["']$/g, ''));
      else if (/^\S/.test(line)) inList = false;
    }
  }
  return tags;
}

// 替换/新增 YAML 的 tags 字段，保留其它字段。
function writeTagsToYaml(yaml, tags) {
  const normalized = normalizeTags(tags);
  const tagsLine = `tags: [${normalized.join(', ')}]`;
  const lines = yaml.split(/\r?\n/);
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*tags\s*:/.test(lines[i])) { idx = i; break; }
  }
  if (idx >= 0) {
    // 若是 list 形式连同 - 子行一并删
    if (/^\s*tags\s*:\s*$/.test(lines[idx])) {
      let end = idx + 1;
      while (end < lines.length && /^\s*-\s*/.test(lines[end])) end += 1;
      lines.splice(idx, end - idx, tagsLine);
    } else {
      lines[idx] = tagsLine;
    }
  } else {
    if (yaml.length > 0 && !yaml.endsWith('\n')) lines.push('');
    lines.push(tagsLine);
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.length > 0 ? lines.join('\n') + '\n' : tagsLine + '\n';
}

// --- 单文件读写 ---

function getFileTags(absolutePath) {
  if (!absolutePath || typeof absolutePath !== 'string') {
    return { success: false, tags: [], source: 'none', error: '无效的文件路径' };
  }
  if (!fs.existsSync(absolutePath)) {
    return { success: false, tags: [], source: 'none', error: '文件不存在' };
  }
  const content = readTagSource(absolutePath);
  if (content !== null) {
    const fm = extractFrontMatter(content);
    if (fm) return { success: true, tags: normalizeTags(parseTagsFromYaml(fm.yaml)), source: 'frontmatter' };
  }
  const overrides = getOverridesMap();
  const ovr = overrides[absolutePath];
  if (Array.isArray(ovr) && ovr.length > 0) return { success: true, tags: normalizeTags(ovr), source: 'override' };
  return { success: true, tags: [], source: 'none' };
}

// 写入策略：已有 front matter → 就地替换 tags；否则 tags 非空才插新 front matter；读不了就落侧挂表
function setFileTags(absolutePath, tags) {
  if (!absolutePath || typeof absolutePath !== 'string') {
    return { success: false, tags: [], error: '无效的文件路径' };
  }
  const normalized = normalizeTags(Array.isArray(tags) ? tags : []);
  if (!fs.existsSync(absolutePath)) {
    const overrides = getOverridesMap();
    if (normalized.length === 0) delete overrides[absolutePath];
    else overrides[absolutePath] = normalized;
    saveOverridesMap(overrides);
    return { success: true, tags: normalized, mode: 'override' };
  }
  const content = readTagSource(absolutePath);
  if (content === null) {
    const overrides = getOverridesMap();
    if (normalized.length > 0) overrides[absolutePath] = normalized;
    else delete overrides[absolutePath];
    saveOverridesMap(overrides);
    return { success: true, tags: normalized, mode: 'override' };
  }
  const fm = extractFrontMatter(content);
  if (fm) {
    try {
      const newContent = `---\n${writeTagsToYaml(fm.yaml, normalized)}---\n${fm.body}`;
      fs.writeFileSync(absolutePath, newContent, 'utf-8');
      const overrides = getOverridesMap();
      if (overrides[absolutePath]) { delete overrides[absolutePath]; saveOverridesMap(overrides); }
      return { success: true, tags: normalized, mode: 'frontmatter' };
    } catch (error) {
      const overrides = getOverridesMap();
      if (normalized.length > 0) overrides[absolutePath] = normalized;
      else delete overrides[absolutePath];
      saveOverridesMap(overrides);
      return { success: false, tags: normalized, mode: 'override', error: error instanceof Error ? error.message : '写入失败' };
    }
  }
  // 无 front matter：tags.length === 0 时不插 front matter，仅清空 override
  if (normalized.length === 0) {
    const overrides = getOverridesMap();
    delete overrides[absolutePath];
    saveOverridesMap(overrides);
    return { success: true, tags: [], mode: 'override' };
  }
  try {
    const newContent = `---\n${writeTagsToYaml('', normalized)}---\n${content}`;
    fs.writeFileSync(absolutePath, newContent, 'utf-8');
    return { success: true, tags: normalized, mode: 'frontmatter' };
  } catch (error) {
    const overrides = getOverridesMap();
    overrides[absolutePath] = normalized;
    saveOverridesMap(overrides);
    return { success: false, tags: normalized, mode: 'override', error: error instanceof Error ? error.message : '写入失败' };
  }
}

// --- 全量扫描 ---

function collectMdFiles(rootPath) {
  const result = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const name = entry.name;
      if (!name || name.startsWith('.') || name.startsWith('~')) continue;
      if (SKIP_DIR_NAMES.has(name)) continue;
      const fullPath = path.join(dir, name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile()) {
        const ext = path.extname(name).toLowerCase();
        if (ext === '.md' || ext === '.markdown' || ext === '.txt') {
          result.push({ path: fullPath, name });
        }
      }
    }
  }
  walk(rootPath);
  return result;
}

function buildTagIndex(rootPath) {
  if (!rootPath || typeof rootPath !== 'string') {
    return { success: false, index: {}, tags: [], scanned: 0, error: '未提供 rootPath' };
  }
  if (!fs.existsSync(rootPath)) {
    return { success: false, index: {}, tags: [], scanned: 0, error: 'rootPath 不存在' };
  }
  try {
    const files = collectMdFiles(rootPath);
    const overrides = getOverridesMap();
    const index = {};
    for (const file of files) {
      const content = readTagSource(file.path);
      const fm = content === null ? null : extractFrontMatter(content);
      let tags = fm ? normalizeTags(parseTagsFromYaml(fm.yaml)) : [];
      if (tags.length === 0 && Array.isArray(overrides[file.path])) {
        tags = normalizeTags(overrides[file.path]);
      }
      for (const tag of tags) {
        if (!index[tag]) index[tag] = [];
        if (!index[tag].includes(file.path)) index[tag].push(file.path);
      }
    }
    const tags = Object.keys(index)
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ tag, count: index[tag].length, paths: index[tag] }));
    return { success: true, index, tags, scanned: files.length };
  } catch (error) {
    return { success: false, index: {}, tags: [], scanned: 0, error: error instanceof Error ? error.message : '扫描失败' };
  }
}

function getAllTags(rootPath) { return buildTagIndex(rootPath); }

function getTagIndex(rootPath) {
  const res = buildTagIndex(rootPath);
  return { success: res.success, index: res.index, error: res.error };
}

module.exports = {
  getFileTags, setFileTags, getAllTags, getTagIndex,
  extractFrontMatter, parseTagsFromYaml, writeTagsToYaml, normalizeTags,
  collectMdFiles, buildTagIndex, TAG_OVERRIDES_KEY, SKIP_DIR_NAMES,
};