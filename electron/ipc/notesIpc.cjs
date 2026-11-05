// notesIpc —— 记事本模块 IPC 集中注册，registerNotesIpc() 幂等。
// 合并了旧版（草稿/搜索/收藏/模板/监听/导出）和新版（基础文件操作），行为完全一致。

const { registerNotesIpc } = (() => {
  const notesService = require('../services/notesService.cjs');
  const { ipcMain } = require('electron');
  // 草稿 / 搜索 / 收藏 / 模板 / 监听 / 导出服务
  const notesDraftService = require('../services/notesDraftService.cjs');
  const notesSearchService = require('../services/notesSearchService.cjs');
  const notesFavoritesService = require('../services/notesFavoritesService.cjs');
  const notesTemplateService = require('../services/notesTemplateService.cjs');
  const notesAttachmentService = require('../services/notesAttachmentService.cjs');
  const notesWatcherService = require('../services/notesWatcherService.cjs');
  const notesExportService = require('../services/notesExportService.cjs');

  return {
    registerNotesIpc() {
      // ── 基础文件操作 ──
      ipcMain.handle('notes-has-root-path', () => notesService.hasRootPath());
      ipcMain.handle('notes-get-root-path', () => notesService.getRootPath());
      ipcMain.handle('notes-set-root-path', (event, rootPath) => notesService.setRootPath(rootPath));
      ipcMain.handle('notes-set-view-path', (event, viewPath) => notesService.setViewPath(viewPath));
      ipcMain.handle('notes-set-chat-path', (event, chatPath) => notesService.setChatRootPath(chatPath));
      ipcMain.handle('notes-select-folder', async () => notesService.selectFolder());
      ipcMain.handle('notes-validate-folder', (event, folderPath) => notesService.validateFolder(folderPath));
      ipcMain.handle('notes-scan-folder', (event, rootPath) => notesService.scanFolder(rootPath));
      ipcMain.handle('notes-get-file-tree', () => notesService.getFileTree());
      ipcMain.handle('notes-create-folder', (event, parentPath, name) => notesService.createFolder(parentPath, name));
      ipcMain.handle('notes-create-folder-force', (event, parentPath, name, mode) => notesService.createFolderForce(parentPath, name, mode));
      ipcMain.handle('notes-create-note', (event, parentPath, name, content) => notesService.createNote(parentPath, name, content));
      ipcMain.handle('notes-create-note-force', (event, parentPath, name, mode, content) => notesService.createNoteForce(parentPath, name, mode, content));
      ipcMain.handle('notes-read-file', (event, filePath) => notesService.readFile(filePath));
      ipcMain.handle('notes-save-file', (event, filePath, content) => notesService.saveFile(filePath, content));
      ipcMain.handle('notes-rename-item', (event, oldPath, newName) => notesService.renameItem(oldPath, newName));
      ipcMain.handle('notes-delete-item', (event, itemPath) => notesService.deleteItem(itemPath));
      ipcMain.handle('notes-trash-item', async (event, itemPath) => notesService.trashItem(itemPath));
      ipcMain.handle('notes-index-all', (event, rootPath) => notesService.indexAllNotes(rootPath));
      ipcMain.handle('notes-open-file-in-folder', (event, filePath) => notesService.openFileInFolder(filePath));
      ipcMain.handle('notes-read-file-as-buffer', (event, filePath) => notesService.readFileAsBuffer(filePath));
      ipcMain.handle('notes-move-item', (event, itemPath, targetFolderPath) => notesService.moveItem(itemPath, targetFolderPath));
      ipcMain.handle('notes-copy-item', (event, sourcePath) => notesService.copyItem(sourcePath));
      ipcMain.handle('notes-send-item', (event, sourcePath, target) => notesService.sendItem(sourcePath, target));
      ipcMain.handle('notes-import-dropped-files', (event, rootPath, filePaths) => notesService.importDroppedFiles(rootPath, filePaths));

      // ── 异步扫描 / 文件树 ──
      ipcMain.handle('notes-scan-folder-async', async (_event, payload) => {
        const rootPath = payload && typeof payload === 'object' ? payload.rootPath : null;
        return notesService.scanFolderAsync(rootPath);
      });
      ipcMain.handle('notes-get-file-tree-async', async (_event, payload) => {
        const rootPath = payload && typeof payload === 'object' ? payload.rootPath : null;
        return notesService.getFileTreeAsync(rootPath);
      });

      // ── 草稿管理 ──
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

      // ── 搜索 ──
      ipcMain.handle('notes-search-notes', async (_event, payload) => {
        return notesSearchService.searchNotes(payload || {});
      });

      // ── 收藏 ──
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

      // ── 模板 ──
      ipcMain.handle('notes-list-templates', async () => {
        return notesTemplateService.listUserTemplates();
      });

      // ── 附件 ──
      ipcMain.handle('notes-save-attachment', async (_event, payload) => {
        const notePath = payload && typeof payload.notePath === 'string' ? payload.notePath : '';
        const fileName = payload && typeof payload.fileName === 'string' ? payload.fileName : '';
        const data = payload ? payload.data : undefined;
        return notesAttachmentService.saveAttachment({ notePath, fileName, data });
      });

      // ── 文件监听 ──
      ipcMain.handle('notes-start-watching', async (_event, payload) => {
        const rootPath = payload && typeof payload === 'object' ? payload.rootPath : null;
        return notesWatcherService.startWatching(rootPath);
      });
      ipcMain.handle('notes-stop-watching', async () => {
        return notesWatcherService.stopWatching();
      });

      // ── 视频判断 ──
      ipcMain.handle('notes-stat', async (_event, filePath) => {
        return notesService.statFile(filePath);
      });

      // ── 导出 ──
      ipcMain.handle('notes-export-pdf', async (_event, payload) => {
        return notesExportService.exportPdf(payload || {});
      });
      ipcMain.handle('notes-export-html', async (_event, payload) => {
        return notesExportService.exportHtml(payload || {});
      });
    },
  };
})();

module.exports = { registerNotesIpc };
