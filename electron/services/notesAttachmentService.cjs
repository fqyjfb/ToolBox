// notesAttachmentService —— 附件落盘：<noteDir>/.attachments/<yyyy-mm>/<sha256前32位>.<ext>。
// 按内容 hash 去重（已存在直接复用），扩展名复用 fileTypeUtils，失败统一 {success:false, error} 不 throw。

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const fileTypeUtils = require('./fileTypeUtils.cjs');

const ATTACHMENTS_DIRNAME = '.attachments';
const HASH_LENGTH = 32;

function isSupportedImageExt(ext) {
  if (!ext) return false;
  const probe = `probe${ext.toLowerCase()}`;
  return fileTypeUtils.isImageFile(probe) || fileTypeUtils.getFileType(probe) === 'image';
}

async function saveAttachment(payload) {
  const { notePath, fileName, data } = payload || {};

  if (!notePath || typeof notePath !== 'string') {
    return { success: false, error: '无效笔记路径' };
  }
  if (!fileName || typeof fileName !== 'string') {
    return { success: false, error: '无效文件名' };
  }
  if (!data) {
    return { success: false, error: '缺少文件数据' };
  }

  const ext = path.extname(fileName).toLowerCase();
  if (!ext) {
    return { success: false, error: '文件缺少扩展名' };
  }
  if (!isSupportedImageExt(ext)) {
    return { success: false, error: `不支持的图片类型: ${ext}` };
  }

  try {
    const buf = Buffer.from(data);
    if (buf.length === 0) {
      return { success: false, error: '文件内容为空' };
    }

    const noteDir = path.dirname(notePath);
    const now = new Date();
    const monthDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, HASH_LENGTH);
    const baseName = `${hash}${ext}`;

    // relativePath 固定用 '/'（markdown 引用需正斜杠，Windows path.join 会给反斜杠）
    const relativePath = `${ATTACHMENTS_DIRNAME}/${monthDir}/${baseName}`;
    const absDir = path.join(noteDir, ATTACHMENTS_DIRNAME, monthDir);
    const absPath = path.join(absDir, baseName);

    // 去重：内容相同 → 目标已存在则直接复用，不重复写盘
    if (fs.existsSync(absPath)) {
      return { success: true, relativePath, reused: true };
    }

    await fsp.mkdir(absDir, { recursive: true });
    // 先写临时文件再 rename，避免中断留下半截图片
    const tmp = path.join(absDir, `${baseName}.tmp.${crypto.randomBytes(4).toString('hex')}`);
    try {
      await fsp.writeFile(tmp, buf);
      await fsp.rename(tmp, absPath);
    } catch (writeErr) {
      try { await fsp.unlink(tmp); } catch { /* ignore */ }
      throw writeErr;
    }

    return { success: true, relativePath, reused: false };
  } catch (error) {
    console.error('[NotesAttachmentService] saveAttachment failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '附件保存失败',
    };
  }
}

module.exports = {
  saveAttachment,
  ATTACHMENTS_DIRNAME,
  HASH_LENGTH,
  isSupportedImageExt,
};
