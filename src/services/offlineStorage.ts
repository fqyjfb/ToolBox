import { encrypt, decrypt } from '../utils/crypto';
import { ENCRYPTED_FIELDS } from '../types/offline';
import { logError, logInfo } from './loggerService';

const DB_NAME = 'ToolBoxOfflineDB';
const DB_VERSION = 2;

const STORES = [
  'shops', 'social_accounts', 'emails', 'phones', 'companies', 'credentials', 'general_accounts',
  'website_accounts', 'website_account_categories',
  'todos', 'todo_categories',
  'quick_replies', 'quick_reply_categories',
  'clipboard_items', 'clipboard_categories',
  'sync_metadata', 'pending_operations'
];

// 旧存储名称，用于清理
const OLD_STORES = ['passwords', 'password_categories'];

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  if (dbInitPromise) {
    return dbInitPromise;
  }
  
  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      const error = request.error;
      const errorObj = error instanceof Error ? error : new Error('IndexedDB initialization failed');
      logError('IndexedDB 初始化失败', 'offlineStorage', errorObj);
      reject(error);
    };
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      STORES.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('user_id', 'user_id', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
          if (storeName !== 'sync_metadata' && storeName !== 'pending_operations') {
            store.createIndex('updated_at', 'updated_at', { unique: false });
          }
        }
      });
      
      logInfo('IndexedDB 数据库结构已更新', 'offlineStorage');
    };
  });
  
  return dbInitPromise;
}

async function executeQuery<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const offlineStorage = {
  async init(): Promise<IDBDatabase> {
    const db = await getDB();
    // 清理旧的存储
    await this.cleanOldStores();
    return db;
  },

  async cleanOldStores(): Promise<void> {
    try {
      const db = await getDB();
      for (const storeName of OLD_STORES) {
        if (db.objectStoreNames.contains(storeName)) {
          // 在版本升级时无法直接删除对象存储，需要创建新版本
          logInfo(`发现旧存储 ${storeName}，将在下次数据库重建时清理`, 'offlineStorage');
        }
      }
    } catch (error) {
      logError('清理旧存储失败', 'offlineStorage', error as Error);
    }
  },

  async get<T>(storeName: string, id: string): Promise<T | null> {
    try {
      return await executeQuery<T>(storeName, 'readonly', store => store.get(id));
    } catch (error) {
      logError(`读取数据失败: ${storeName}/${id}`, 'offlineStorage', error as Error);
      return null;
    }
  },

  async queryByUser<T>(storeName: string, userId: string): Promise<T[]> {
    try {
      const results = await executeQuery<T[]>(storeName, 'readonly', store => {
        const index = store.index('user_id');
        return index.getAll(userId);
      });
      return results || [];
    } catch (error) {
      logError(`按用户查询失败: ${storeName}`, 'offlineStorage', error as Error);
      return [];
    }
  },

  async queryByTimeRange<T extends { user_id: string }>(
    storeName: string, 
    userId: string, 
    startTime: string, 
    endTime?: string
  ): Promise<T[]> {
    try {
      const results = await executeQuery<T[]>(storeName, 'readonly', store => {
        const index = store.index('updated_at');
        if (endTime) {
          return index.getAll(IDBKeyRange.bound(startTime, endTime));
        }
        return index.getAll(IDBKeyRange.lowerBound(startTime));
      });
      return (results || []).filter((item: T) => item.user_id === userId);
    } catch (error) {
      logError(`按时间范围查询失败: ${storeName}`, 'offlineStorage', error as Error);
      return [];
    }
  },

  async put<T extends { id: string }>(storeName: string, data: T): Promise<void> {
    try {
      await executeQuery(storeName, 'readwrite', store => store.put(data));
    } catch (error) {
      logError(`写入数据失败: ${storeName}`, 'offlineStorage', error as Error);
      throw error;
    }
  },

  async batchPut<T extends { id: string }>(storeName: string, data: T[]): Promise<void> {
    try {
      const db = await getDB();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        data.forEach(item => store.put(item));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      logError(`批量写入失败: ${storeName}`, 'offlineStorage', error as Error);
      throw error;
    }
  },

  async delete(storeName: string, id: string): Promise<void> {
    try {
      await executeQuery(storeName, 'readwrite', store => store.delete(id));
    } catch (error) {
      logError(`删除数据失败: ${storeName}/${id}`, 'offlineStorage', error as Error);
      throw error;
    }
  },

  async batchDelete(storeName: string, ids: string[]): Promise<void> {
    try {
      const db = await getDB();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        ids.forEach(id => store.delete(id));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      logError(`批量删除失败: ${storeName}`, 'offlineStorage', error as Error);
      throw error;
    }
  },

  async clear(storeName: string): Promise<void> {
    try {
      const db = await getDB();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logError(`清空存储失败: ${storeName}`, 'offlineStorage', error as Error);
      throw error;
    }
  },

  async clearByUser(userId: string): Promise<void> {
    try {
      const db = await getDB();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORES, 'readwrite');
        
        STORES.forEach(storeName => {
          const store = transaction.objectStore(storeName);
          const index = store.index('user_id');
          const request = index.getAllKeys(userId);
          request.onsuccess = () => {
            const keys = request.result || [];
            keys.forEach((key: IDBValidKey) => store.delete(key));
          };
        });
        
        transaction.oncomplete = () => {
          logInfo(`已清除用户 ${userId} 的本地数据`, 'offlineStorage');
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      logError('清除用户数据失败', 'offlineStorage', error as Error);
      throw error;
    }
  },

  async clearOldUserData(userId: string, daysThreshold: number): Promise<void> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);
    const thresholdTime = thresholdDate.toISOString();
    
    try {
      const db = await getDB();
      await new Promise<void>((resolve, reject) => {
        const userStores = STORES.filter(s => s !== 'sync_metadata' && s !== 'pending_operations');
        const transaction = db.transaction(userStores, 'readwrite');
        
        userStores.forEach(storeName => {
          const store = transaction.objectStore(storeName);
          if (store.indexNames.contains('created_at')) {
            const index = store.index('created_at');
            const request = index.getAll(IDBKeyRange.upperBound(thresholdTime));
            request.onsuccess = () => {
              const records = request.result || [];
              records.forEach((record: any) => {
                if (record.user_id === userId) {
                  store.delete(record.id);
                }
              });
            };
          }
        });
        
        transaction.oncomplete = () => {
          logInfo(`已清理用户 ${userId} ${daysThreshold} 天前的旧数据`, 'offlineStorage');
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      logError('清理旧数据失败', 'offlineStorage', error as Error);
      throw error;
    }
  },

  async getStoredUsers(): Promise<string[]> {
    try {
      const results = await executeQuery<string[]>('shops', 'readonly', store => {
        const index = store.index('user_id');
        return index.getAllKeys();
      });
      return [...new Set(results || [])];
    } catch (error) {
      logError('获取存储用户列表失败', 'offlineStorage', error as Error);
      return [];
    }
  },

  async getStorageSize(): Promise<{ used: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          quota: estimate.quota || 0
        };
      } catch {
        return { used: 0, quota: 0 };
      }
    }
    return { used: 0, quota: 0 };
  },

  async putEncrypted<T extends { id: string }>(
    storeName: string, 
    data: T, 
    fieldsToEncrypt?: string[]
  ): Promise<void> {
    const encryptedData = { ...data } as Record<string, unknown>;
    const fields = fieldsToEncrypt || ENCRYPTED_FIELDS[storeName] || [];
    
    for (const field of fields) {
      if (encryptedData[field] !== undefined && encryptedData[field] !== null) {
        encryptedData[field] = await encrypt(String(encryptedData[field]));
      }
    }
    
    await this.put(storeName, encryptedData as T);
  },

  async getDecrypted<T extends object>(
    storeName: string, 
    id: string, 
    fieldsToDecrypt?: string[]
  ): Promise<T | null> {
    const data = await this.get<T>(storeName, id);
    if (!data) return null;
    
    const decryptedData = { ...data } as Record<string, unknown>;
    const fields = fieldsToDecrypt || ENCRYPTED_FIELDS[storeName] || [];
    
    for (const field of fields) {
      if (decryptedData[field] !== undefined && decryptedData[field] !== null) {
        decryptedData[field] = await decrypt(String(decryptedData[field]));
      }
    }
    
    return decryptedData as T;
  },

  async getStorageStats(userId: string): Promise<{
    websites: number;
    shops: number;
    social: number;
    emails: number;
    phones: number;
    companies: number;
    credentials: number;
    generalAccounts: number;
    todo: number;
    quickReply: number;
    clipboard: number;
    total: number;
  }> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const userStores = STORES.filter(s => s !== 'sync_metadata' && s !== 'pending_operations');
        const stats: Record<string, number> = {
          websites: 0,
          shops: 0,
          social: 0,
          emails: 0,
          phones: 0,
          companies: 0,
          credentials: 0,
          generalAccounts: 0,
          todo: 0,
          quickReply: 0,
          clipboard: 0,
          total: 0,
        };
        let completed = 0;

        const updateStats = (storeName: string, count: number) => {
          switch (storeName) {
            case 'shops':
              stats.shops += count;
              break;
            case 'social_accounts':
              stats.social += count;
              break;
            case 'emails':
              stats.emails += count;
              break;
            case 'phones':
              stats.phones += count;
              break;
            case 'companies':
              stats.companies += count;
              break;
            case 'credentials':
              stats.credentials += count;
              break;
            case 'general_accounts':
              stats.generalAccounts += count;
              break;
            case 'website_accounts':
              stats.websites += count;
              break;
            case 'todos':
              stats.todo += count;
              break;
            case 'quick_replies':
              stats.quickReply += count;
              break;
            case 'clipboard_items':
              stats.clipboard += count;
              break;
          }
          
          completed++;
          if (completed === userStores.length) {
            stats.total = stats.websites + stats.shops + stats.social + stats.emails + 
                         stats.phones + stats.companies + stats.credentials + stats.generalAccounts +
                         stats.todo + stats.quickReply + stats.clipboard;
            resolve(stats as {
              websites: number;
              shops: number;
              social: number;
              emails: number;
              phones: number;
              companies: number;
              credentials: number;
              generalAccounts: number;
              todo: number;
              quickReply: number;
              clipboard: number;
              total: number;
            });
          }
        };

        const transaction = db.transaction(userStores, 'readonly');

        userStores.forEach(storeName => {
          const store = transaction.objectStore(storeName);
          const index = store.index('user_id');
          const request = index.getAll(userId);
          request.onsuccess = () => {
            const results = request.result || [];
            updateStats(storeName, results.length);
          };
          request.onerror = () => {
            updateStats(storeName, 0);
          };
        });

        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      logError('获取存储统计失败', 'offlineStorage', error as Error);
      return {
        websites: 0,
        shops: 0,
        social: 0,
        emails: 0,
        phones: 0,
        companies: 0,
        credentials: 0,
        generalAccounts: 0,
        todo: 0,
        quickReply: 0,
        clipboard: 0,
        total: 0,
      };
    }
  },

  async exportUserData(userId: string): Promise<string> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES, 'readonly');
        const exportData: Record<string, unknown[]> = {};
        let completed = 0;

        const userStores = STORES.filter(s => s !== 'sync_metadata' && s !== 'pending_operations');

        userStores.forEach(storeName => {
          const store = transaction.objectStore(storeName);
          const index = store.index('user_id');
          const request = index.getAll(userId);
          request.onsuccess = () => {
            exportData[storeName] = request.result || [];
            completed++;
            if (completed === userStores.length) {
              resolve(JSON.stringify(exportData, null, 2));
            }
          };
          request.onerror = () => {
            exportData[storeName] = [];
            completed++;
            if (completed === userStores.length) {
              resolve(JSON.stringify(exportData, null, 2));
            }
          };
        });

        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      logError('导出用户数据失败', 'offlineStorage', error as Error);
      throw error;
    }
  },

  async importUserData(userId: string, data: string): Promise<{ success: boolean; imported: number; failed: number }> {
    try {
      const importData = JSON.parse(data);
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES, 'readwrite');
        let imported = 0;
        let failed = 0;
        let completed = 0;

        const storeNames = Object.keys(importData).filter(key => STORES.includes(key));

        storeNames.forEach(storeName => {
          const store = transaction.objectStore(storeName);
          const items = importData[storeName] as unknown[];
          let processed = 0;

          if (items.length === 0) {
            completed++;
            if (completed === storeNames.length) {
              resolve({ success: true, imported, failed });
            }
            return;
          }

          items.forEach((item) => {
            const itemWithUserId = { ...(item as Record<string, unknown>), user_id: userId };
            const request = store.put(itemWithUserId);
            request.onsuccess = () => {
              imported++;
              processed++;
              checkComplete();
            };
            request.onerror = () => {
              failed++;
              processed++;
              checkComplete();
            };
          });

          const checkComplete = () => {
            if (processed === items.length) {
              completed++;
              if (completed === storeNames.length) {
                logInfo(`用户 ${userId} 数据导入完成: ${imported} 成功, ${failed} 失败`, 'offlineStorage');
                resolve({ success: failed === 0, imported, failed });
              }
            }
          };
        });

        if (storeNames.length === 0) {
          resolve({ success: true, imported: 0, failed: 0 });
        }

        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      logError('导入用户数据失败', 'offlineStorage', error as Error);
      throw error;
    }
  },

  async clearByUserWithProgress(
    userId: string, 
    onProgress?: (progress: number, message: string) => void
  ): Promise<void> {
    try {
      const db = await getDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORES, 'readwrite');
        let completed = 0;
        const totalStores = STORES.length;

        onProgress?.(0, '开始清除用户数据...');

        STORES.forEach(storeName => {
          const store = transaction.objectStore(storeName);
          const index = store.index('user_id');
          const request = index.getAllKeys(userId);
          
          request.onsuccess = () => {
            const keys = request.result || [];
            let deleted = 0;
            
            if (keys.length === 0) {
              completed++;
              onProgress?.(Math.round((completed / totalStores) * 100), `已清理 ${storeName}`);
              checkComplete();
              return;
            }

            keys.forEach((key: IDBValidKey) => {
              const deleteRequest = store.delete(key);
              deleteRequest.onsuccess = () => {
                deleted++;
                if (deleted === keys.length) {
                  completed++;
                  onProgress?.(Math.round((completed / totalStores) * 100), `已清理 ${storeName}`);
                  checkComplete();
                }
              };
              deleteRequest.onerror = () => {
                deleted++;
                if (deleted === keys.length) {
                  completed++;
                  onProgress?.(Math.round((completed / totalStores) * 100), `已清理 ${storeName}`);
                  checkComplete();
                }
              };
            });
          };

          request.onerror = () => {
            completed++;
            checkComplete();
          };
        });

        const checkComplete = () => {
          if (completed === totalStores) {
            onProgress?.(100, '清理完成');
            logInfo(`已清除用户 ${userId} 的本地数据`, 'offlineStorage');
            resolve();
          }
        };

        transaction.oncomplete = () => {
          if (completed !== totalStores) {
            onProgress?.(100, '清理完成');
          }
        };
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      logError('清除用户数据失败', 'offlineStorage', error as Error);
      throw error;
    }
  },
};
