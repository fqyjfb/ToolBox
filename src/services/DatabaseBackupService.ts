import { offlineStorage } from './offlineStorage';
import { DISPLAY_LIMITS } from '../constants/timers';

const BACKUP_TABLES = [
  'shops', 'social_accounts', 'emails', 'phones', 'companies',
  'credentials', 'general_accounts', 'website_accounts', 'website_account_categories',
  'todos', 'todo_categories', 'quick_replies', 'quick_reply_categories',
  'clipboard_items', 'clipboard_categories', 'memos', 'memo_categories'
];

async function collectAllTableData(): Promise<Record<string, unknown[]>> {
  const users = await offlineStorage.getStoredUsers();
  const result: Record<string, unknown[]> = {};

  for (const table of BACKUP_TABLES) {
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

      for (const [table, records] of Object.entries(data)) {
        if (Array.isArray(records)) {
          for (const record of records) {
            try {
              await offlineStorage.put(table, record as { id: string });
              totalImported++;
            } catch {
              // 忽略单条记录的错误
            }
          }
        }
      }

      return { success: true, message: `成功恢复 ${totalImported} 条数据` };
    } catch {
      return { success: false, message: '备份文件格式错误' };
    }
  }
};
