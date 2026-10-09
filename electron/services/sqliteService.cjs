const path = require('path');
const fs = require('fs');
let initSqlJs = null;

let SQL = null;
let db = null;
let dbPath = null;
let initPromise = null;
let currentUsername = null;

// 按用户导出/导入的业务数据表清单（与前端 USER_DATA_TABLES 保持一致）
const USER_DATA_TABLES = [
  'shops', 'social_accounts', 'emails', 'phones', 'companies',
  'credentials', 'general_accounts', 'website_accounts', 'website_account_categories',
  'todos', 'todo_categories', 'quick_replies', 'quick_reply_categories',
  'clipboard_items', 'clipboard_categories', 'memos', 'memo_categories',
  'reminders'
];

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
    flushPersist();
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
    if (!initSqlJs) initSqlJs = require('sql.js');
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

let persistTimer = null;
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persist();
  }, 2000);
}

function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persist();
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
  schedulePersist();
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
  schedulePersist();
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
  if (!SQL) throw new Error('SQL module not loaded');
  if (db) {
    flushPersist();
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

// 全量导出 plugin_data 表（备份用，结构不同于标准 KV 表）
function exportAllPluginData() {
  return queryAll('SELECT id, plugin_id, user_id, data_key, data_value, created_at, updated_at FROM plugin_data', []);
}

// 全量导入 plugin_data 表（恢复用，先清空再写入）
function importAllPluginData(rows) {
  if (!rows || rows.length === 0) return;
  const database = requireDb();
  database.run('DELETE FROM plugin_data');
  database.run('BEGIN');
  try {
    const stmt = database.prepare(
      'INSERT OR REPLACE INTO plugin_data (id, plugin_id, user_id, data_key, data_value, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
    );
    for (const row of rows) {
      stmt.run([
        row.id, row.plugin_id, row.user_id, row.data_key,
        row.data_value ?? null, row.created_at, row.updated_at
      ]);
    }
    stmt.free();
    database.run('COMMIT');
  } catch (e) {
    database.run('ROLLBACK');
    throw e;
  }
  schedulePersist();
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

// 已存储用户 = 所有业务表中出现过的 user_id 并集。
// 原实现只查 shops 表：从未用过店铺模块的用户列表恒为空，依赖用户清单的功能会静默失效
// （历史上计划任务对账就曾因拿不到命名用户而把其任务误判为孤儿删光）。
function getStoredUsers() {
  const users = new Set();
  for (const table of USER_DATA_TABLES) {
    try {
      const rows = queryAll(`SELECT DISTINCT user_id FROM ${table}`, []);
      for (const r of rows) {
        if (r.user_id) users.add(r.user_id);
      }
    } catch {
      // 表尚未创建时跳过，不影响其余表
    }
  }
  return Array.from(users);
}

// 启动期提醒对账专用：以「独立只读连接」遍历数据目录下全部 ToolBox*.db，
// 汇总 reminders 表记录（id 去重）。绝不使用/切换全局单例连接 db，
// 避免与渲染进程抢在登录前发出的空用户名 sqlite:init 互相抢连接。
// 单个库损坏或被写盘覆盖只跳过该库，不影响其余库与启动流程。
async function readAllReminders(userDataPath) {
  if (!SQL) {
    if (!initSqlJs) initSqlJs = require('sql.js');
    SQL = await initSqlJs();
  }

  const dir = loadSettingsSafe().dbPath || getDefaultDbDir(userDataPath);
  const byId = new Map();
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /^ToolBox(?:_.+)?\.db$/.test(f));
  } catch (err) {
    console.error('[SQLite] readAllReminders 读取数据目录失败:', err.message);
    return byId;
  }

  for (const file of files) {
    let reader = null;
    try {
      reader = new SQL.Database(fs.readFileSync(path.join(dir, file)));
      const stmt = reader.prepare('SELECT data FROM reminders');
      while (stmt.step()) {
        try {
          const reminder = JSON.parse(stmt.getAsObject().data);
          if (reminder && reminder.id && !byId.has(reminder.id)) byId.set(reminder.id, reminder);
        } catch {
          // 单行 data 损坏：跳过该行
        }
      }
      stmt.free();
    } catch (err) {
      console.error(`[SQLite] readAllReminders 跳过无法读取的库 ${file}:`, err.message);
    } finally {
      try { if (reader) reader.close(); } catch { /* 忽略关闭异常 */ }
    }
  }
  return byId;
}

// 提醒触发专用：计划任务命令行只带提醒 id，无从判断它归属哪个用户库，故需逐库定位。
// 全程使用独立连接，绝不切换全局单例连接 db —— 复用全局连接会把渲染进程后续的读写
// 永久留在别人的库上（表现为新建记录在登录账号列表里凭空消失）。
// updatedRecord 可选：传入时在归属库就地回写（写盘后立即关闭独立连接）。
// 返回 { reminder, updated }；未找到返回 null。
async function findReminderInOwningDb(userDataPath, reminderId, updatedRecord) {
  if (!SQL) {
    if (!initSqlJs) initSqlJs = require('sql.js');
    SQL = await initSqlJs();
  }

  const dir = loadSettingsSafe().dbPath || getDefaultDbDir(userDataPath);
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /^ToolBox(?:_.+)?\.db$/.test(f));
  } catch (err) {
    console.error('[SQLite] findReminderInOwningDb 读取数据目录失败:', err.message);
    return null;
  }

  for (const file of files) {
    let conn = null;
    try {
      conn = new SQL.Database(fs.readFileSync(path.join(dir, file)));
      const stmt = conn.prepare('SELECT data FROM reminders WHERE id = ?');
      stmt.bind([reminderId]);
      const row = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();
      if (!row) continue;

      const reminder = JSON.parse(row.data);
      let updated = null;
      if (updatedRecord) {
        updated = updatedRecord;
        const { recordId, userId } = extractUserAndId(updated);
        const write = conn.prepare('INSERT OR REPLACE INTO reminders (id, user_id, data) VALUES (?, ?, ?)');
        try {
          write.run([recordId, userId, JSON.stringify(updated)]);
        } finally {
          write.free();
        }
        fs.writeFileSync(path.join(dir, file), Buffer.from(conn.export()));
      }
      return { reminder, updated };
    } catch (err) {
      console.error(`[SQLite] findReminderInOwningDb 跳过无法读写的库 ${file}:`, err.message);
    } finally {
      try { if (conn) conn.close(); } catch { /* 忽略关闭异常 */ }
    }
  }
  return null;
}

function exportUserData(userId) {
  const exportData = {};
  for (const table of USER_DATA_TABLES) {
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

  const validTables = new Set(USER_DATA_TABLES);
  const storeNames = Object.keys(importData).filter(key => validTables.has(key));

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
    flushPersist();
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
  exportAllPluginData,
  importAllPluginData,
  getStorageStats,
  getStoredUsers,
  readAllReminders,
  findReminderInOwningDb,
  exportUserData,
  importUserData,
  flushPersist,
  close,
};