const { dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fileTypeUtils = require('./fileTypeUtils.cjs');
const officePreview = require('./officePreview.cjs');

const SETTINGS_FILE_NAME = 'notes_settings.json';

let settings = {};

function getSettingsFilePath() {
  const userDataPath = require('electron').app.getPath('userData');
  return path.join(userDataPath, SETTINGS_FILE_NAME);
}

function loadSettings() {
  try {
    const filePath = getSettingsFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      settings = JSON.parse(content);
    }
  } catch {
    settings = {};
  }
}

function saveSettings() {
  try {
    const filePath = getSettingsFilePath();
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    console.error('[NotesService] 保存设置失败:', error);
  }
}

function getSetting(key) {
  if (Object.keys(settings).length === 0) {
    loadSettings();
  }
  return settings[key] ?? null;
}

function saveSetting(key, value) {
  settings[key] = value;
  saveSettings();
  return true;
}

function getRootPath() {
  return getSetting('notes_root_path');
}

function setRootPath(rootPath) {
  const result = saveSetting('notes_root_path', rootPath);
  console.log('[NotesService] setRootPath:', { rootPath, result });
  return result;
}

async function selectFolder() {
  const result = await dialog.showOpenDialog({
    title: '选择笔记存储文件夹',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: '选择此文件夹',
  });

  return {
    canceled: result.canceled,
    filePaths: result.filePaths,
  };
}

function validateFolder(folderPath) {
  try {
    if (!fs.existsSync(folderPath)) {
      return { valid: false, error: '文件夹不存在' };
    }

    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) {
      return { valid: false, error: '选择的路径不是文件夹' };
    }

    try {
      fs.accessSync(folderPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      return { valid: false, error: '没有文件夹的读写权限' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: '验证文件夹时发生错误' };
  }
}

function calculateFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

function scanFolder(rootPath) {
  try {
    let fileCount = 0;
    let folderCount = 0;

    const scanDir = (dirPath) => {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const item of items) {
        if (item.name.startsWith('.') || item.name.startsWith('~')) {
          continue;
        }

        const itemPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          folderCount++;
          scanDir(itemPath);
        } else if (item.isFile() && fileTypeUtils.getFileType(itemPath)) {
          fileCount++;
        }
      }
    };

    scanDir(rootPath);
    saveSetting('notes_last_scan_at', Date.now().toString());

    return { success: true, fileCount, folderCount };
  } catch (error) {
    return {
      success: false,
      fileCount: 0,
      folderCount: 0,
      error: error instanceof Error ? error.message : '扫描失败',
    };
  }
}

function getFileTree() {
  const rootPath = getRootPath();

  if (!rootPath || !fs.existsSync(rootPath)) {
    return [];
  }

  const buildTree = (dirPath) => {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    const nodes = [];

    for (const item of items) {
      if (item.name.startsWith('.') || item.name.startsWith('~')) {
        continue;
      }

      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        const node = {
          id: itemPath,
          name: item.name,
          type: 'folder',
          path: itemPath,
          children: buildTree(itemPath),
          expanded: false,
        };
        nodes.push(node);
      } else if (item.isFile()) {
        const fileType = fileTypeUtils.getFileType(itemPath);
        if (!fileType) continue;

        const node = {
          id: itemPath,
          name: item.name,
          type: 'file',
          path: itemPath,
          fileType,
        };
        nodes.push(node);
      }
    }

    nodes.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'folder' ? -1 : 1;
    });

    return nodes;
  };

  return buildTree(rootPath);
}

function createFolder(parentPath, folderName) {
  const rootPath = getRootPath();

  if (!rootPath) {
    return { success: false, error: '未设置根目录' };
  }

  try {
    const folderPath = parentPath
      ? path.join(parentPath, folderName)
      : path.join(rootPath, folderName);

    if (fs.existsSync(folderPath)) {
      return { success: false, error: '文件夹已存在', exists: true };
    }

    fs.mkdirSync(folderPath, { recursive: false });

    return { success: true, path: folderPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '创建失败',
    };
  }
}

function createFolderForce(parentPath, folderName, mode) {
  const rootPath = getRootPath();

  if (!rootPath) {
    return { success: false, error: '未设置根目录' };
  }

  try {
    const folderPath = parentPath
      ? path.join(parentPath, folderName)
      : path.join(rootPath, folderName);

    let finalPath = folderPath;

    if (mode === 'overwrite') {
      if (fs.existsSync(finalPath)) {
        fs.rmSync(finalPath, { recursive: true, force: true });
      }
      fs.mkdirSync(finalPath, { recursive: false });

      return { success: true, path: finalPath };
    } else {
      let counter = 1;
      while (fs.existsSync(finalPath)) {
        finalPath = parentPath
          ? path.join(parentPath, `${folderName} (${counter})`)
          : path.join(rootPath, `${folderName} (${counter})`);
        counter++;
      }
      fs.mkdirSync(finalPath, { recursive: false });

      return { success: true, path: finalPath };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '创建失败',
    };
  }
}

function createNote(parentPath, fileName, content = '') {
  const rootPath = getRootPath();

  if (!rootPath) {
    return { success: false, error: '未设置根目录' };
  }

  try {
    const finalName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    const filePath = parentPath
      ? path.join(parentPath, finalName)
      : path.join(rootPath, finalName);

    if (fs.existsSync(filePath)) {
      return { success: false, error: '文件已存在', exists: true };
    }

    fs.writeFileSync(filePath, content, 'utf-8');

    return { success: true, path: filePath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '创建失败',
    };
  }
}

function createNoteForce(parentPath, fileName, mode, content = '') {
  const rootPath = getRootPath();

  if (!rootPath) {
    return { success: false, error: '未设置根目录' };
  }

  try {
    let finalName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    let filePath = parentPath
      ? path.join(parentPath, finalName)
      : path.join(rootPath, finalName);

    if (mode === 'overwrite') {
      fs.writeFileSync(filePath, content, 'utf-8');
    } else {
      let counter = 1;
      const baseName = finalName.replace(/\.md$/, '');
      while (fs.existsSync(filePath)) {
        finalName = `${baseName} (${counter}).md`;
        filePath = parentPath
          ? path.join(parentPath, finalName)
          : path.join(rootPath, finalName);
        counter++;
      }

      fs.writeFileSync(filePath, content, 'utf-8');
    }

    return { success: true, path: filePath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '创建失败',
    };
  }
}

function readFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在' };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '读取失败',
    };
  }
}

function saveFile(filePath, content) {
  try {
    const fileType = fileTypeUtils.getFileType(filePath);
    if (fileType && !fileTypeUtils.isTextFile(filePath)) {
      return { success: false, error: '不支持直接编辑此文件类型' };
    }

    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '保存失败',
    };
  }
}

function renameItem(oldPath, newName) {
  try {
    const parentPath = path.dirname(oldPath);

    const isFile = fs.existsSync(oldPath) && fs.statSync(oldPath).isFile();
    const oldExt = path.extname(oldPath).toLowerCase();

    let finalName = newName;
    if (isFile && oldExt && !path.extname(newName)) {
      finalName = `${newName}${oldExt}`;
    }

    const newPath = path.join(parentPath, finalName);

    if (fs.existsSync(newPath)) {
      return { success: false, error: '目标名称已存在' };
    }

    fs.renameSync(oldPath, newPath);

    return { success: true, newPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '重命名失败',
    };
  }
}

function deleteItem(itemPath) {
  try {
    if (!fs.existsSync(itemPath)) {
      return { success: false, error: '文件或文件夹不存在' };
    }

    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      fs.rmSync(itemPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(itemPath);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除失败',
    };
  }
}

function hasRootPath() {
  const rootPath = getRootPath();
  const exists = rootPath !== null && fs.existsSync(rootPath);
  console.log('[NotesService] hasRootPath:', { rootPath, exists });
  return exists;
}

function indexAllNotes(rootPath) {
  try {
    console.log('[NotesService] 开始重建索引:', rootPath);

    const result = scanFolder(rootPath);

    if (result.success) {
      console.log(`[NotesService] 索引重建完成: ${result.fileCount} 个文件, ${result.folderCount} 个文件夹`);
    } else {
      console.log('[NotesService] 索引重建失败:', result.error);
    }

    return result;
  } catch (error) {
    console.error('[NotesService] 索引重建异常:', error);
    return { success: false, error: error instanceof Error ? error.message : '索引失败' };
  }
}

function openFileInFolder(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件或文件夹不存在' };
    }

    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '打开失败',
    };
  }
}

function readFileAsBuffer(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在' };
    }
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    return { success: true, base64, mimeType: fileTypeUtils.getMimeType(filePath) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '读取失败' };
  }
}

function convertOfficeToHtml(filePath) {
  return new Promise((resolve) => {
    const fileType = fileTypeUtils.getFileType(filePath);
    if (!fileType) {
      return resolve({ success: false, error: '不支持的文件类型' });
    }

    if (fileType === 'docx') {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.doc') {
        officePreview.docToHtml(filePath).then(resolve);
      } else {
        officePreview.docxToHtml(filePath).then(resolve);
      }
    } else if (fileType === 'xlsx') {
      officePreview.xlsxToHtml(filePath).then(resolve);
    } else {
      resolve({ success: false, error: '不是 Office 文件' });
    }
  });
}



function moveItem(itemPath, targetFolderPath) {
  try {
    if (!fs.existsSync(itemPath)) {
      return { success: false, error: '文件或文件夹不存在' };
    }
    if (!fs.existsSync(targetFolderPath)) {
      return { success: false, error: '目标文件夹不存在' };
    }
    if (!fs.statSync(targetFolderPath).isDirectory()) {
      return { success: false, error: '目标路径不是文件夹' };
    }

    const itemName = path.basename(itemPath);
    const newPath = path.join(targetFolderPath, itemName);

    if (fs.existsSync(newPath)) {
      return { success: false, error: '目标位置已存在同名文件' };
    }

    fs.renameSync(itemPath, newPath);
    return { success: true, newPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '移动失败',
    };
  }
}

module.exports = {
  getSetting,
  saveSetting,
  getRootPath,
  setRootPath,
  selectFolder,
  validateFolder,
  scanFolder,
  getFileTree,
  createFolder,
  createFolderForce,
  createNote,
  createNoteForce,
  readFile,
  saveFile,
  renameItem,
  deleteItem,
  hasRootPath,
  indexAllNotes,
  openFileInFolder,
  readFileAsBuffer,
  convertOfficeToHtml,
  moveItem,
};