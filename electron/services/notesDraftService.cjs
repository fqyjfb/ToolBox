// notesDraftService —— 未保存内容原子写落盘：<userData>/notes/drafts/<hash>.md.tmp。
// 另外落一份 <hash>.path 映射（sha1 不可逆，用于启动时反查源文件）。

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

const DRAFTS_DIRNAME = 'drafts';
const TMP_SUFFIX = '.md.tmp';
const PATH_SUFFIX = '.path';

function getDraftsDir() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'notes', DRAFTS_DIRNAME);
}

// 绝对路径 → 16 字符 sha1，作为草稿文件名（同一文件覆盖同一文件）。
function hashPath(absolutePath) {
  return crypto.createHash('sha1').update(absolutePath).digest('hex').slice(0, 16);
}

function getDraftFilePath(absolutePath) {
  return path.join(getDraftsDir(), `${hashPath(absolutePath)}${TMP_SUFFIX}`);
}

function getDraftPathFilePath(absolutePath) {
  return path.join(getDraftsDir(), `${hashPath(absolutePath)}${PATH_SUFFIX}`);
}

async function ensureDraftsDir() {
  const dir = getDraftsDir();
  await fsp.mkdir(dir, { recursive: true });
}

// 原子写草稿：先写 staging 再 rename，目标已存在直接覆盖。
async function writeDraft(absolutePath, content) {
  if (!absolutePath || typeof absolutePath !== 'string') {
    return { success: false, error: '无效的文件路径' };
  }
  if (typeof content !== 'string') {
    return { success: false, error: '草稿内容必须为字符串' };
  }
  try {
    await ensureDraftsDir();
    const target = getDraftFilePath(absolutePath);
    const random = crypto.randomBytes(4).toString('hex');
    const staging = path.join(getDraftsDir(), `${hashPath(absolutePath)}.tmp.${random}`);
    await fsp.writeFile(staging, content, 'utf-8');
    await fsp.rename(staging, target);
    // 路径映射 best-effort：映射失败只 warn，正文已安全落盘。
    try {
      const mapTarget = getDraftPathFilePath(absolutePath);
      const mapStaging = path.join(getDraftsDir(), `${hashPath(absolutePath)}.tmp.${random}`);
      await fsp.writeFile(mapStaging, absolutePath, 'utf-8');
      await fsp.rename(mapStaging, mapTarget);
    } catch (mapError) {
      console.warn('[notesDraftService] writeDraft path map failed:', mapError);
    }
    return { success: true, filePath: target };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '草稿写入失败',
    };
  }
}

// 读取草稿；不存在时返回 success=false / error='NOT_FOUND'。
async function readDraft(absolutePath) {
  if (!absolutePath || typeof absolutePath !== 'string') {
    return { success: false, error: '无效的文件路径' };
  }
  try {
    const target = getDraftFilePath(absolutePath);
    if (!fs.existsSync(target)) {
      return { success: false, error: 'NOT_FOUND' };
    }
    const content = await fsp.readFile(target, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '草稿读取失败',
    };
  }
}

// 删除草稿，含残留 staging 文件。
async function deleteDraft(absolutePath) {
  if (!absolutePath || typeof absolutePath !== 'string') {
    return { success: false, error: '无效的文件路径' };
  }
  try {
    const dir = getDraftsDir();
    const hash = hashPath(absolutePath);
    let entries;
    try {
      entries = await fsp.readdir(dir);
    } catch {
      entries = [];
    }
    const toRemove = entries.filter(
      (name) =>
        name.startsWith(`${hash}.tmp.`) ||
        name === `${hash}${TMP_SUFFIX}` ||
        name === `${hash}${PATH_SUFFIX}`
    );
    for (const name of toRemove) {
      try {
        await fsp.unlink(path.join(dir, name));
      } catch {
        /* ignore — best-effort cleanup */
      }
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '草稿删除失败',
    };
  }
}

// 读 <hash>.path 映射；缺失或损坏返回 ''。
async function readPathMap(dir, hash) {
  try {
    const raw = await fsp.readFile(path.join(dir, `${hash}${PATH_SUFFIX}`), 'utf-8');
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : '';
  } catch {
    return '';
  }
}

// 列出所有草稿；absolutePath 由 <hash>.path 映射还原，缺失时为 ''（调用方跳过）。
async function listDrafts() {
  try {
    const dir = getDraftsDir();
    if (!fs.existsSync(dir)) {
      return { success: true, drafts: [] };
    }
    const entries = await fsp.readdir(dir);
    const drafts = [];
    for (const name of entries) {
      if (!name.endsWith(TMP_SUFFIX)) continue;
      const full = path.join(dir, name);
      let stat;
      try {
        stat = await fsp.stat(full);
      } catch {
        continue;
      }
      const hash = name.slice(0, -TMP_SUFFIX.length);
      drafts.push({
        hash,
        filePath: full,
        absolutePath: await readPathMap(dir, hash),
        size: stat.size,
        mtime: stat.mtimeMs,
      });
    }
    drafts.sort((a, b) => b.mtime - a.mtime);
    return { success: true, drafts };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '草稿列表读取失败',
    };
  }
}

module.exports = {
  writeDraft,
  readDraft,
  deleteDraft,
  listDrafts,
  getDraftFilePath,
  hashPath,
};