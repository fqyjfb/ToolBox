const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const sqliteService = require('../services/sqliteService.cjs');

let registered = false;

function register() {
  if (registered) return;
  registered = true;
  ipcMain.handle('sqlite:init', async (_e, username) => {
    const { app } = require('electron');
    const userDataPath = app.getPath('userData');
    await sqliteService.init(userDataPath, username);
    return true;
  });

  ipcMain.handle('sqlite:get', (_e, { table, id }) =>
    sqliteService.get(table, id));

  ipcMain.handle('sqlite:queryByUser', (_e, { table, userId }) =>
    sqliteService.queryByUser(table, userId));

  ipcMain.handle('sqlite:queryByTimeRange', (_e, { table, userId, startTime, endTime }) =>
    sqliteService.queryByTimeRange(table, userId, startTime, endTime));

  ipcMain.handle('sqlite:put', (_e, { table, data }) =>
    sqliteService.insert(table, data));

  ipcMain.handle('sqlite:batchPut', (_e, { table, list }) =>
    sqliteService.batchInsert(table, list));

  ipcMain.handle('sqlite:delete', (_e, { table, id }) =>
    sqliteService.remove(table, id));

  ipcMain.handle('sqlite:batchDelete', (_e, { table, ids }) =>
    sqliteService.batchDelete(table, ids));

  ipcMain.handle('sqlite:clear', (_e, { table }) =>
    sqliteService.clearTable(table));

  ipcMain.handle('sqlite:clearByUser', (_e, { table, userId }) =>
    sqliteService.clearByUser(table, userId));

  ipcMain.handle('sqlite:getPath', () =>
    sqliteService.getPath());

  ipcMain.handle('sqlite:getFilePath', () =>
    sqliteService.getFilePath());

  ipcMain.handle('sqlite:getDatabaseSize', () =>
    sqliteService.getDatabaseSize());

  ipcMain.handle('sqlite:setPath', async (_e, newPath) => {
    if (!fs.existsSync(newPath)) fs.mkdirSync(newPath, { recursive: true });
    try {
      const testFile = path.join(newPath, '.write_test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch {
      throw new Error('路径无写入权限');
    }
    await sqliteService.changePath(newPath);
    return true;
  });

  ipcMain.handle('sqlite:selectPath', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '选择数据存储路径'
    });
    return !result.canceled && result.filePaths.length > 0 ? result.filePaths[0] : null;
  });

  ipcMain.handle('sqlite:getStorageStats', (_e, userId) =>
    sqliteService.getStorageStats(userId));

  ipcMain.handle('sqlite:getStoredUsers', () =>
    sqliteService.getStoredUsers());

  ipcMain.handle('sqlite:exportUserData', (_e, userId) =>
    sqliteService.exportUserData(userId));

  ipcMain.handle('sqlite:importUserData', (_e, { userId, data }) =>
    sqliteService.importUserData(userId, data));

  ipcMain.handle('sqlite:plugin:get', (_e, { pluginId, userId, key }) =>
    sqliteService.getPluginData(pluginId, userId, key));

  ipcMain.handle('sqlite:plugin:set', (_e, { pluginId, userId, key, value }) =>
    sqliteService.setPluginData(pluginId, userId, key, value));

  ipcMain.handle('sqlite:plugin:delete', (_e, { pluginId, userId, key }) =>
    sqliteService.deletePluginData(pluginId, userId, key));

  ipcMain.handle('sqlite:openDatabaseFolder', () => {
    const filePath = sqliteService.getFilePath();
    if (!filePath) return false;
    const folder = path.dirname(filePath);
    shell.openPath(folder);
    return true;
  });
}

module.exports = { registerSqliteIpc: register };