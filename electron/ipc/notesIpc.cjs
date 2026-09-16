// notesIpc —— 记事本模块 IPC 集中注册，registerNotesIpc() 幂等。

const { ipcMain } = require('electron');
const notesService = require('../services/notesService.cjs');
const notesDraftService = require('../services/notesDraftService.cjs');
const notesSearchService = require('../services/notesSearchService.cjs');
const notesFavoritesService = require('../services/notesFavoritesService.cjs');
const notesTagService = require('../services/notesTagService.cjs');
const notesTemplateService = require('../services/notesTemplateService.cjs');
const notesAttachmentService = require('../services/notesAttachmentService.cjs');
const notesWatcherService = require('../services/notesWatcherService.cjs');

const CHANNELS = [
  'notes-scan-folder-async',
  'notes-get-file-tree-async',
  'notes-write-draft',
  'notes-read-draft',
  'notes-delete-draft',
  'notes-list-drafts',
  'notes-search-notes',
  'notes-get-favorites',
  'notes-set-favorites',
  'notes-toggle-favorite',
  'notes-get-file-tags',
  'notes-set-file-tags',
  'notes-get-all-tags',
  'notes-get-tag-index',
  'notes-list-templates',
  'notes-save-attachment',
  'notes-start-watching',
  'notes-stop-watching',
  'notes-stat',
];

let registered = false;

function registerNotesIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle('notes-scan-folder-async', async (_event, payload) => {
    const rootPath = payload && typeof payload === 'object' ? payload.rootPath : null;
    return notesService.scanFolderAsync(rootPath);
  });

  ipcMain.handle('notes-get-file-tree-async', async (_event, payload) => {
    const rootPath = payload && typeof payload === 'object' ? payload.rootPath : null;
    return notesService.getFileTreeAsync(rootPath);
  });

  ipcMain.handle('notes-write-draft', async (_event, payload) => {
    const { absolutePath, content } = payload || {};
    return notesDraftService.writeDraft(absolutePath, content);
  });

  ipcMain.handle('notes-read-draft', async (_event, payload) => {
    const { absolutePath } = payload || {};
    return notesDraftService.readDraft(absolutePath);
  });

  ipcMain.handle('notes-delete-draft', async (_event, payload) => {
    const { absolutePath } = payload || {};
    return notesDraftService.deleteDraft(absolutePath);
  });

  ipcMain.handle('notes-list-drafts', async () => {
    return notesDraftService.listDrafts();
  });

  ipcMain.handle('notes-search-notes', async (_event, payload) => {
    return notesSearchService.searchNotes(payload || {});
  });

  ipcMain.handle('notes-get-favorites', async () => {
    return notesFavoritesService.getFavorites();
  });

  ipcMain.handle('notes-set-favorites', async (_event, payload) => {
    const favorites = payload && Array.isArray(payload.favorites) ? payload.favorites : [];
    return notesFavoritesService.setFavorites(favorites);
  });

  ipcMain.handle('notes-toggle-favorite', async (_event, payload) => {
    const absolutePath = payload && typeof payload.absolutePath === 'string' ? payload.absolutePath : '';
    return notesFavoritesService.toggleFavorite(absolutePath);
  });

  ipcMain.handle('notes-get-file-tags', async (_event, payload) => {
    const absolutePath = payload && typeof payload.absolutePath === 'string' ? payload.absolutePath : '';
    return notesTagService.getFileTags(absolutePath);
  });

  ipcMain.handle('notes-set-file-tags', async (_event, payload) => {
    const absolutePath = payload && typeof payload.absolutePath === 'string' ? payload.absolutePath : '';
    const tags = payload && Array.isArray(payload.tags) ? payload.tags : [];
    return notesTagService.setFileTags(absolutePath, tags);
  });

  ipcMain.handle('notes-get-all-tags', async (_event, payload) => {
    const rootPath = payload && typeof payload.rootPath === 'string' ? payload.rootPath : '';
    return notesTagService.getAllTags(rootPath);
  });

  ipcMain.handle('notes-get-tag-index', async (_event, payload) => {
    const rootPath = payload && typeof payload.rootPath === 'string' ? payload.rootPath : '';
    return notesTagService.getTagIndex(rootPath);
  });

  ipcMain.handle('notes-list-templates', async () => {
    return notesTemplateService.listUserTemplates();
  });

  ipcMain.handle('notes-save-attachment', async (_event, payload) => {
    const notePath = payload && typeof payload.notePath === 'string' ? payload.notePath : '';
    const fileName = payload && typeof payload.fileName === 'string' ? payload.fileName : '';
    const data = payload ? payload.data : undefined;
    return notesAttachmentService.saveAttachment({ notePath, fileName, data });
  });

  ipcMain.handle('notes-start-watching', async (_event, payload) => {
    const rootPath = payload && typeof payload === 'object' ? payload.rootPath : null;
    return notesWatcherService.startWatching(rootPath);
  });

  ipcMain.handle('notes-stop-watching', async () => {
    return notesWatcherService.stopWatching();
  });

  // 只 stat、不读内容：渲染层据此在挂载 <video> 前判断体积。
  ipcMain.handle('notes-stat', async (_event, filePath) => {
    return notesService.statFile(filePath);
  });
}

function unregisterNotesIpc() {
  if (!registered) return;
  registered = false;
  for (const ch of CHANNELS) {
    try {
      ipcMain.removeHandler(ch);
    } catch {
      /* ignore — handler may have been removed elsewhere */
    }
  }
}

module.exports = {
  registerNotesIpc,
  unregisterNotesIpc,
  CHANNELS,
};