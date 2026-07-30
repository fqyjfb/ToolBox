const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let SQL = null;
let db = null;
let dbPath = null;
let initPromise = null;
let currentUsername = null;

function getDefaultDbDir(userDataPath) {
  return path.join(userDataPath, 'ToolBox');
}

function getDbFileName(username) {
  if (!username) return 'ToolBox.db';
  const sanitized = username.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
  return `ToolBox_${sanitized}.db`;
}

async function init(userDataPath, username) {
  const normalizedUsername = username || null;

  // 用户名变化时，先关闭现有数据库连接再重新打开
  if (db && currentUsername !== normalizedUsername) {
    persist();
    db.close();
    db = null;
    dbPath = null;
    initPromise = null;
  }

  if (db && currentUsername === normalizedUsername) return Promise.resolve();
  
  if (initPromise) {
    try {
      await initPromise;
      return;
    } catch {
      initPromise = null;
    }
  }

  currentUsername = normalizedUsername;

  initPromise = (async () => {
    SQL = await initSqlJs();

    const defaultDir = getDefaultDbDir(userDataPath);
    const userSettings = loadSettingsSafe();
    const dir = userSettings.dbPath || defaultDir;

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    dbPath = path.join(dir, getDbFileName(currentUsername));

    if (!userSettings.dbPath) {
      userSettings.dbPath = dir;
      saveSettingsSafe(userSettings);
    }

    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    const schemaPath = path.join(__dirname, '../schema/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      db.run(schema);
    }

    persist();
  })();

  try {
    await initPromise;
  } catch (e) {
    initPromise = null;
    throw e;
  }
}

function persist() {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (e) {
    console.error('[SQLite] Failed to persist database:', e.message);
  }
}

function loadSettingsSafe() {
  try {
    const { loadSettings } = require('../lib/config.cjs');
    return loadSettings();
  } catch {
    return {};
  }
}

function saveSettingsSafe(settings) {
  try {
    const { saveSettings } = require('../lib/config.cjs');
    saveSettings(settings);
  } catch (e) {
    console.error('[SQLite] Failed to save settings:', e.message);
  }
}

function requireDb() {
  if (!db) throw new Error('SQLite database not initialized. Call init() first.');
  return db;
}

function parseRow(row) {
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

function queryAll(sql, params) {
  const database = requireDb();
  const stmt = database.prepare(sql);
  if (params && params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function queryScalar(sql, params) {
  const database = requireDb();
  const stmt = database.prepare(sql);
  if (params && params.length) stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    const keys = Object.keys(row);
    result = keys.length > 0 ? row[keys[0]] : null;
  }
  stmt.free();
  return result;
}

function run(sql, params) {
  const database = requireDb();
  database.run(sql, params);
  persist();
}

function extractUserAndId(data) {
  const recordId = data.id || data.record_id || '';
  let userId = data.userId || data.user_id || '';
  if (!userId && data.data && typeof data.data === 'object') {
    userId = data.data.userId || data.data.user_id || '';
  }
  if (!userId) {
    userId = data.id || '';
  }
  return { recordId, userId };
}

function insertOrReplace(table, dataObj) {
  const { recordId, userId } = extractUserAndId(dataObj);
  const jsonStr = JSON.stringify(dataObj);

  const sql = `INSERT OR REPLACE INTO ${table} (id, user_id, data) VALUES (?, ?, ?)`;
  run(sql, [recordId, userId, jsonStr]);
}

function batchInsertOrReplace(table, list) {
  if (!list || list.length === 0) return;
  const database = requireDb();

  database.run('BEGIN');
  try {
    const stmt = database.prepare(
      `INSERT OR REPLACE INTO ${table} (id, user_id, data) VALUES (?, ?, ?)`
    );
    for (const item of list) {
      const { recordId, userId } = extractUserAndId(item);
      const jsonStr = JSON.stringify(item);
      stmt.run([recordId, userId, jsonStr]);
    }
    stmt.free();
    database.run('COMMIT');
  } catch (e) {
    database.run('ROLLBACK');
    throw e;
  }
  persist();
}

function get(table, id) {
  const row = queryOne(`SELECT data FROM ${table} WHERE id = ?`, [id]);
  return parseRow(row);
}

function queryByUser(table, userId) {
  const rows = queryAll(`SELECT data FROM ${table} WHERE user_id = ?`, [userId]);
  return rows.map(r => parseRow(r)).filter(Boolean);
}

function queryByTimeRange(table, userId, startTime, endTime) {
  let sql = `SELECT data FROM ${table} WHERE user_id = ? AND updated_at >= ?`;
  const params = [userId, startTime];
  if (endTime) {
    sql += ' AND updated_at <= ?';
    params.push(endTime);
  }
  const rows = queryAll(sql, params);
  return rows.map(r => parseRow(r)).filter(Boolean);
}

function insert(table, dataObj) {
  insertOrReplace(table, dataObj);
}

function batchInsert(table, list) {
  batchInsertOrReplace(table, list);
}

function remove(table, id) {
  run(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

function batchDelete(table, ids) {
  if (!ids || ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  run(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ids);
}

function clearTable(table) {
  run(`DELETE FROM ${table}`, []);
}

function clearByUser(table, userId) {
  run(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
}

async function changePath(newPath) {
  if (db) {
    persist();
    db.close();
    db = null;
  }
  initPromise = null;
  if (!fs.existsSync(newPath)) fs.mkdirSync(newPath, { recursive: true });
  dbPath = path.join(newPath, getDbFileName(currentUsername));
  db = new SQL.Database();

  const schemaPath = path.join(__dirname, '../schema/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.run(schema);
  }
  persist();

  const settings = loadSettingsSafe();
  settings.dbPath = newPath;
  saveSettingsSafe(settings);
}

function getPath() {
  const settings = loadSettingsSafe();
  return settings.dbPath || null;
}

function getFilePath() {
  return dbPath;
}

function getDatabaseSize() {
  if (!dbPath || !fs.existsSync(dbPath)) return 0;
  try {
    const stats = fs.statSync(dbPath);
    return stats.size;
  } catch {
    return 0;
  }
}

function getPluginData(pluginId, userId, key) {
  if (key) {
    const row = queryOne(
      'SELECT data_value as data FROM plugin_data WHERE plugin_id=? AND user_id=? AND data_key=?',
      [pluginId, userId, key]
    );
    if (row && row.data) {
      try { return JSON.parse(row.data); } catch { return row.data; }
    }
    return null;
  }
  const rows = queryAll(
    'SELECT data_value as data FROM plugin_data WHERE plugin_id=? AND user_id=?',
    [pluginId, userId]
  );
  return rows.map(r => {
    try { return JSON.parse(r.data); } catch { return r.data; }
  });
}

function setPluginData(pluginId, userId, key, value) {
  const isObj = typeof value === 'object';
  const dataValue = isObj ? JSON.stringify(value) : String(value);
  const existing = queryOne(
    'SELECT id FROM plugin_data WHERE plugin_id=? AND user_id=? AND data_key=?',
    [pluginId, userId, key]
  );

  if (existing) {
    run(
      "UPDATE plugin_data SET data_value=?, updated_at=datetime('now', 'localtime') WHERE id=?",
      [dataValue, existing.id]
    );
  } else {
    const crypto = require('crypto');
    const id = crypto.randomUUID();
    run(
      'INSERT INTO plugin_data (id, plugin_id, user_id, data_key, data_value) VALUES (?,?,?,?,?)',
      [id, pluginId, userId, key, dataValue]
    );
  }
}

function deletePluginData(pluginId, userId, key) {
  if (key) {
    run(
      'DELETE FROM plugin_data WHERE plugin_id=? AND user_id=? AND data_key=?',
      [pluginId, userId, key]
    );
  } else {
    run(
      'DELETE FROM plugin_data WHERE plugin_id=? AND user_id=?',
      [pluginId, userId]
    );
  }
}

function getStorageStats(userId) {
  const tables = ['shops', 'social_accounts', 'emails', 'phones', 'companies',
    'credentials', 'general_accounts', 'website_accounts', 'todos',
    'quick_replies', 'clipboard_items'];
  const stats = {};
  const keyMap = {
    shops: 'shops', social_accounts: 'social', emails: 'emails',
    phones: 'phones', companies: 'companies', credentials: 'credentials',
    general_accounts: 'generalAccounts', website_accounts: 'websites',
    todos: 'todo', quick_replies: 'quickReply', clipboard_items: 'clipboard'
  };

  for (const table of tables) {
    try {
      const count = queryScalar(`SELECT COUNT(*) FROM ${table} WHERE user_id = ?`, [userId]);
      const key = keyMap[table] || table;
      stats[key] = count || 0;
    } catch {
      stats[keyMap[table] || table] = 0;
    }
  }

  stats.total = Object.values(stats).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
  return stats;
}

function getStoredUsers() {
  try {
    const results = queryAll('SELECT DISTINCT user_id FROM shops', []);
    return results.map(r => r.user_id).filter(Boolean);
  } catch {
    return [];
  }
}

function exportUserData(userId) {
  const tables = ['shops', 'social_accounts', 'emails', 'phones', 'companies',
    'credentials', 'general_accounts', 'website_accounts', 'website_account_categories',
    'todos', 'todo_categories', 'quick_replies', 'quick_reply_categories',
    'clipboard_items', 'clipboard_categories', 'memos', 'memo_categories'];

  const exportData = {};
  for (const table of tables) {
    try {
      exportData[table] = queryByUser(table, userId);
    } catch {
      exportData[table] = [];
    }
  }
  return JSON.stringify(exportData, null, 2);
}

function importUserData(userId, jsonStr) {
  const importData = JSON.parse(jsonStr);
  let imported = 0;
  let failed = 0;

  const storeNames = Object.keys(importData).filter(key => {
    const tables = ['shops', 'social_accounts', 'emails', 'phones', 'companies',
      'credentials', 'general_accounts', 'website_accounts', 'website_account_categories',
      'todos', 'todo_categories', 'quick_replies', 'quick_reply_categories',
      'clipboard_items', 'clipboard_categories', 'memos', 'memo_categories'];
    return tables.includes(key);
  });

  for (const storeName of storeNames) {
    const items = importData[storeName];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      try {
        const itemWithUserId = { ...item, userId: item.userId || userId };
        insertOrReplace(storeName, itemWithUserId);
        imported++;
      } catch {
        failed++;
      }
    }
  }

  return { success: failed === 0, imported, failed };
}

function close() {
  if (db) {
    persist();
    db.close();
    db = null;
  }
  initPromise = null;
  dbPath = null;
  currentUsername = null;
}

module.exports = {
  init,
  get,
  queryByUser,
  queryByTimeRange,
  insert,
  batchInsert,
  remove,
  batchDelete,
  clearTable,
  clearByUser,
  changePath,
  getPath,
  getFilePath,
  getDatabaseSize,
  getPluginData,
  setPluginData,
  deletePluginData,
  getStorageStats,
  getStoredUsers,
  exportUserData,
  importUserData,
  close,
};