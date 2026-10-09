import { offlineStorage } from './offlineStorage';
import { sqliteClient } from './sqliteClient';
import { USER_DATA_TABLES } from '../types/offline';
import { DISPLAY_LIMITS } from '../constants/timers';

// plugin_data 表结构不同于标准 KV 表，需要单独处理
const PLUGIN_DATA_KEY = 'plugin_data';

async function collectAllTableData(): Promise<Record<string, unknown[]>> {
  const users = await offlineStorage.getStoredUsers();
  const result: Record<string, unknown[]> = {};

  for (const table of USER_DATA_TABLES) {
    const allData: unknown[] = [];
    for (const userId of users) {
      try {
        const data = await offlineStorage.queryByUser(table, userId);
        allData.push(...data);
      } catch {
        // skip tables without user_id column or non-existent tables
      }
    }
    result[table] = allData;
  }

  // plugin_data 表结构不同，通过专用 IPC 全量导出
  try {
    result[PLUGIN_DATA_KEY] = await sqliteClient.exportAllPluginData();
  } catch {
    result[PLUGIN_DATA_KEY] = [];
  }

  return result;
}

export const databaseBackupService = {
  async exportToSQL(): Promise<string> {
    const allData = await collectAllTableData();
    const sqlLines: string[] = ['-- ToolBox Database Backup'];
    sqlLines.push(`-- Generated at: ${new Date().toISOString()}`);
    sqlLines.push('');

    for (const [table, data] of Object.entries(allData)) {
      if (data && data.length > 0) {
        sqlLines.push(`-- Table: ${table} (${data.length} rows)`);
        for (const row of data as Record<string, unknown>[]) {
          const columns = Object.keys(row);
          const values = Object.values(row).map(v => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
            return String(v);
          });
          sqlLines.push(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
        }
        sqlLines.push('');
      }
    }

    return sqlLines.join('\n');
  },

  downloadSQL(sql: string): void {
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toolbox_backup_${new Date().toISOString().slice(0, DISPLAY_LIMITS.DATE_SLICE_LENGTH)}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async exportData(): Promise<string> {
    const allData = await collectAllTableData();
    return JSON.stringify(allData, null, 2);
  },

  downloadJSON(data: string): void {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toolbox_backup_${new Date().toISOString().slice(0, DISPLAY_LIMITS.DATE_SLICE_LENGTH)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async importFromJSON(jsonData: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = JSON.parse(jsonData) as Record<string, unknown[]>;
      let totalImported = 0;

      // 先清空所有业务数据表，确保恢复后不残留旧数据
      for (const table of USER_DATA_TABLES) {
        try {
          await offlineStorage.clear(table);
        } catch {
          // ignore clear errors
        }
      }

      // 恢复标准 KV 结构表
      for (const table of USER_DATA_TABLES) {
        const records = data[table];
        if (!Array.isArray(records)) continue;
        for (const record of records) {
          try {
            await offlineStorage.put(table, record as { id: string });
            totalImported++;
          } catch {
            // 忽略单条记录的错误
          }
        }
      }

      // 恢复 plugin_data（结构不同，通过专用 IPC）
      const pluginRows = data[PLUGIN_DATA_KEY];
      if (Array.isArray(pluginRows) && pluginRows.length > 0) {
        try {
          await sqliteClient.importAllPluginData(pluginRows as Record<string, unknown>[]);
          totalImported += pluginRows.length;
        } catch {
          // plugin_data 恢复失败不影响其它表
        }
      }

      return { success: true, message: `成功恢复 ${totalImported} 条数据` };
    } catch {
      return { success: false, message: '备份文件格式错误' };
    }
  },

  async importFromSQL(sqlContent: string): Promise<{ success: boolean; message: string }> {
    try {
      // 先清空所有业务数据表
      for (const table of USER_DATA_TABLES) {
        try {
          await offlineStorage.clear(table);
        } catch {
          // ignore clear errors
        }
      }

      const lines = sqlContent.split('\n');
      let totalImported = 0;
      const validTables = new Set([...USER_DATA_TABLES, PLUGIN_DATA_KEY]);

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.toUpperCase().startsWith('INSERT INTO')) continue;

        // 解析: INSERT INTO table_name (col1, col2, ...) VALUES (val1, val2, ...);
        const match = trimmed.match(/^INSERT INTO\s+(\w+)\s*\(([^)]*)\)\s*VALUES\s*\((.*)\);?\s*$/i);
        if (!match) continue;

        const [, table, columnsStr, valuesStr] = match;
        if (!validTables.has(table)) continue;

        const columns = columnsStr.split(',').map(c => c.trim());
        const values = parseSQLValues(valuesStr);

        if (columns.length !== values.length) continue;

        const record: Record<string, unknown> = {};
        for (let i = 0; i < columns.length; i++) {
          record[columns[i]] = values[i];
        }

        try {
          if (table === PLUGIN_DATA_KEY) {
            // plugin_data 通过标准 put 写入（insertOrReplace 会处理结构差异）
            await sqliteClient.importAllPluginData([record]);
          } else {
            await offlineStorage.put(table, record as { id: string });
          }
          totalImported++;
        } catch {
          // 忽略单条记录的错误
        }
      }

      return { success: true, message: `成功恢复 ${totalImported} 条数据` };
    } catch {
      return { success: false, message: 'SQL文件格式错误' };
    }
  },
};

// 解析 SQL VALUES 子句中的值列表
function parseSQLValues(valuesStr: string): unknown[] {
  const values: unknown[] = [];
  let current = '';
  let inString = false;
  let i = 0;

  while (i < valuesStr.length) {
    const char = valuesStr[i];

    if (char === "'" && !inString) {
      inString = true;
      i++;
      continue;
    }

    if (char === "'" && inString) {
      // 检查是否是转义的单引号 ''
      if (valuesStr[i + 1] === "'") {
        current += "'";
        i += 2;
        continue;
      }
      inString = false;
      i++;
      continue;
    }

    if (char === ',' && !inString) {
      values.push(parseSQLValue(current.trim()));
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  if (current.trim()) {
    values.push(parseSQLValue(current.trim()));
  }

  return values;
}

function parseSQLValue(value: string): unknown {
  if (value.toUpperCase() === 'NULL') return null;
  if (value === '') return '';
  // 数字
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  // 去掉外层引号后的字符串
  return value;
}
