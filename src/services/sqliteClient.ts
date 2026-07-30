const getElectron = () => {
  const win = window as Window & {
    electron?: {
      ipcRenderer: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      };
    };
  };
  return win.electron;
};

const isElectron = () => {
  return !!getElectron();
};

async function invoke(channel: string, ...args: unknown[]) {
  const electron = getElectron();
  if (!electron) {
    throw new Error('SQLite is only available in Electron environment');
  }
  return electron.ipcRenderer.invoke(channel, ...args);
}

export class SQLiteClient {
  private initState: 'idle' | 'initializing' | 'ready' = 'idle';
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (!isElectron()) return;
    if (this.initState === 'ready') return;
    if (this.initState === 'initializing' && this.initPromise) {
      return this.initPromise;
    }

    this.initState = 'initializing';
    this.initPromise = (async () => {
      try {
        await invoke('sqlite:init');
        this.initState = 'ready';
      } catch (e) {
        this.initState = 'idle';
        this.initPromise = null;
        throw e;
      }
    })();

    try {
      await this.initPromise;
    } catch {
      // initPromise 已在内部重置
    }
  }

  private async ensureReady(): Promise<void> {
    if (!isElectron()) return;
    if (this.initState === 'ready') return;
    await this.init();
  }

  get<T>(table: string, id: string): Promise<T | null> {
    if (!isElectron()) return Promise.resolve(null);
    return this.ensureReady().then(() => invoke('sqlite:get', { table, id }) as Promise<T | null>);
  }

  queryByUser<T>(table: string, userId: string): Promise<T[]> {
    if (!isElectron()) return Promise.resolve([]);
    return this.ensureReady().then(() => invoke('sqlite:queryByUser', { table, userId }) as Promise<T[]>);
  }

  queryByTimeRange<T>(table: string, userId: string, startTime: string, endTime?: string): Promise<T[]> {
    if (!isElectron()) return Promise.resolve([]);
    return this.ensureReady().then(() => invoke('sqlite:queryByTimeRange', { table, userId, startTime, endTime: endTime || null }) as Promise<T[]>);
  }

  put<T extends Record<string, unknown>>(table: string, data: T): Promise<void> {
    if (!isElectron()) return Promise.resolve();
    return this.ensureReady().then(() => invoke('sqlite:put', { table, data }).then(() => {}));
  }

  batchPut<T>(table: string, list: T[]): Promise<void> {
    if (!isElectron()) return Promise.resolve();
    return this.ensureReady().then(() => invoke('sqlite:batchPut', { table, list }).then(() => {}));
  }

  delete(table: string, id: string): Promise<void> {
    if (!isElectron()) return Promise.resolve();
    return this.ensureReady().then(() => invoke('sqlite:delete', { table, id }).then(() => {}));
  }

  batchDelete(table: string, ids: string[]): Promise<void> {
    if (!isElectron()) return Promise.resolve();
    return this.ensureReady().then(() => invoke('sqlite:batchDelete', { table, ids }).then(() => {}));
  }

  clear(table: string): Promise<void> {
    if (!isElectron()) return Promise.resolve();
    return this.ensureReady().then(() => invoke('sqlite:clear', { table }).then(() => {}));
  }

  clearByUser(table: string, userId: string): Promise<void> {
    if (!isElectron()) return Promise.resolve();
    return this.ensureReady().then(() => invoke('sqlite:clearByUser', { table, userId }).then(() => {}));
  }

  getPath(): Promise<string | null> {
    if (!isElectron()) return Promise.resolve(null);
    return this.ensureReady().then(() => invoke('sqlite:getPath') as Promise<string | null>);
  }

  getFilePath(): Promise<string | null> {
    if (!isElectron()) return Promise.resolve(null);
    return this.ensureReady().then(() => invoke('sqlite:getFilePath') as Promise<string | null>);
  }

  getDatabaseSize(): Promise<number> {
    if (!isElectron()) return Promise.resolve(0);
    return this.ensureReady().then(() => invoke('sqlite:getDatabaseSize') as Promise<number>);
  }

  setPath(newPath: string): Promise<void> {
    if (!isElectron()) return Promise.resolve();
    return this.ensureReady().then(() => invoke('sqlite:setPath', newPath).then(() => {}));
  }

  selectPath(): Promise<string | null> {
    if (!isElectron()) return Promise.resolve(null);
    return this.ensureReady().then(() => invoke('sqlite:selectPath') as Promise<string | null>);
  }

  getStorageStats(userId: string): Promise<Record<string, number>> {
    if (!isElectron()) return Promise.resolve({});
    return this.ensureReady().then(() => invoke('sqlite:getStorageStats', userId) as Promise<Record<string, number>>);
  }

  getStoredUsers(): Promise<string[]> {
    if (!isElectron()) return Promise.resolve([]);
    return this.ensureReady().then(() => invoke('sqlite:getStoredUsers') as Promise<string[]>);
  }

  exportUserData(userId: string): Promise<string> {
    if (!isElectron()) return Promise.resolve('{}');
    return this.ensureReady().then(() => invoke('sqlite:exportUserData', userId) as Promise<string>);
  }

  importUserData(userId: string, data: string): Promise<{ success: boolean; imported: number; failed: number }> {
    if (!isElectron()) return Promise.resolve({ success: false, imported: 0, failed: 0 });
    return this.ensureReady().then(() => invoke('sqlite:importUserData', { userId, data }) as Promise<{ success: boolean; imported: number; failed: number }>);
  }

  getPluginData<T>(pluginId: string, userId: string, key?: string): Promise<T | T[] | null> {
    if (!isElectron()) return Promise.resolve(null);
    return this.ensureReady().then(() => invoke('sqlite:plugin:get', { pluginId, userId, key: key || null }) as Promise<T | T[] | null>);
  }

  setPluginData(pluginId: string, userId: string, key: string, value: unknown): Promise<void> {
    if (!isElectron()) return Promise.resolve();
    return this.ensureReady().then(() => invoke('sqlite:plugin:set', { pluginId, userId, key, value }).then(() => {}));
  }

  deletePluginData(pluginId: string, userId: string, key?: string): Promise<void> {
    if (!isElectron()) return Promise.resolve();
    return this.ensureReady().then(() => invoke('sqlite:plugin:delete', { pluginId, userId, key: key || null }).then(() => {}));
  }

  openDatabaseFolder(): Promise<boolean> {
    if (!isElectron()) return Promise.resolve(false);
    return this.ensureReady().then(() => invoke('sqlite:openDatabaseFolder') as Promise<boolean>);
  }

  isAvailable(): boolean {
    return isElectron();
  }
}

export const sqliteClient = new SQLiteClient();