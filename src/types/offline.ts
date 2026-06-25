export type SyncModuleKey = 
  | 'account'
  | 'todo'
  | 'quickReply'
  | 'clipboard';

export type StorageLocation = 'local' | 'cloud';

export interface SyncModule {
  key: SyncModuleKey;
  name: string;
  enabled: boolean;
  lastSyncTime?: string;
}

export interface SyncMetadata {
  id: string;
  lastSyncTime: string;
  syncEnabled: boolean;
  storageLocation: StorageLocation;
  syncModules: SyncModule[];
  syncOnStartupEnabled?: boolean;
}

export interface PendingOperation {
  id: string;
  tableName: string;
  operationType: 'create' | 'update' | 'delete';
  recordId: string;
  data: unknown;
  createdAt: string;
  module: SyncModuleKey;
}

export interface SyncRecord {
  id: string;
  updated_at: string;
  user_id: string;
  [key: string]: unknown;
}

export interface ConflictItem {
  id: string;
  local: SyncRecord;
  cloud: SyncRecord;
  tableName: string;
  recordId: string;
}

export interface TableSyncResult {
  cloudOnly: unknown[];
  localOnly: unknown[];
  conflicts: ConflictItem[];
  synced: number;
  conflictsHandled: number;
}

export interface SyncResult {
  [module: string]: TableSyncResult;
}

export interface TableDataCount {
  tableName: string;
  count: number;
}

export type SyncErrorType =
  | 'network'
  | 'auth'
  | 'permission'
  | 'data'
  | 'unknown';

export interface SyncErrorDetail {
  type: SyncErrorType;
  message: string;
  tableName?: string;
  recordId?: string;
  retryable: boolean;
}

export function classifySyncError(error: unknown): SyncErrorDetail {
  const message = (error as Error)?.message || '未知错误';

  if (message.includes('network') || message.includes('fetch') || message.includes('timeout') || message.includes('Connection')) {
    return { type: 'network', message, retryable: true };
  }

  if (message.includes('auth') || message.includes('token') || message.includes('login') || message.includes('Unauthorized')) {
    return { type: 'auth', message, retryable: false };
  }

  if (message.includes('permission') || message.includes('access') || message.includes('forbidden') || message.includes('Forbidden')) {
    return { type: 'permission', message, retryable: false };
  }

  if (message.includes('data') || message.includes('format') || message.includes('invalid') || message.includes('Invalid')) {
    return { type: 'data', message, retryable: false };
  }

  return { type: 'unknown', message, retryable: true };
}

export const MODULE_TABLE_MAP: Record<SyncModuleKey, string[]> = {
  account: ['shops', 'social_accounts', 'emails', 'phones', 'companies', 'credentials', 'general_accounts', 'website_accounts', 'website_account_categories'],
  todo: ['todos', 'todo_categories'],
  quickReply: ['quick_replies', 'quick_reply_categories'],
  clipboard: ['clipboard_items', 'clipboard_categories'],
};

export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  website_accounts: ['password'],
  social_accounts: ['password'],
  shops: ['password'],
  general_accounts: ['password'],
};
