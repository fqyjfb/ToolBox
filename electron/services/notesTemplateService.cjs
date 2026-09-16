// notesTemplateService —— 读取 <userData>/notes/templates/*.md 并通过 notes-list-templates 返回。
// 目录不存在按正常处理（返回空数组），也不自动创建；统一 { success, templates, error? } 不 throw。

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { app } = require('electron');

const TEMPLATES_DIRNAME = 'templates';
const TEMPLATE_EXT = '.md';
// 单文件上限 512KB：防止误拖入大文件导致 IPC 阻塞
const MAX_TEMPLATE_BYTES = 512 * 1024;

function getTemplatesDir() {
  return path.join(app.getPath('userData'), 'notes', TEMPLATES_DIRNAME);
}

// id/name 均为文件名去掉 .md（如 `日报.md` → `日报`）
async function listUserTemplates() {
  try {
    const dir = getTemplatesDir();
    if (!fs.existsSync(dir)) {
      return { success: true, templates: [] };
    }

    const entries = await fsp.readdir(dir);
    const templates = [];

    for (const entryName of entries) {
      if (!entryName.toLowerCase().endsWith(TEMPLATE_EXT)) continue;

      const full = path.join(dir, entryName);
      let stat;
      try {
        stat = await fsp.stat(full);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      if (stat.size > MAX_TEMPLATE_BYTES) continue;

      let content;
      try {
        content = await fsp.readFile(full, 'utf-8');
      } catch {
        continue;
      }

      const id = entryName.slice(0, entryName.length - TEMPLATE_EXT.length);
      if (!id) continue;
      templates.push({ id, name: id, content });
    }

    templates.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    return { success: true, templates };
  } catch (error) {
    console.error('[NotesTemplateService] 用户模板读取失败:', error);
    return {
      success: false,
      templates: [],
      error: error instanceof Error ? error.message : '模板读取失败',
    };
  }
}

module.exports = {
  listUserTemplates,
  getTemplatesDir,
};
