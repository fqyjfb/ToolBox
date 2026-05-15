export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: string;
  stack?: string;
}

export interface LoggerSettings {
  enabled: boolean;
  maxEntries: number;
  levels: {
    error: boolean;
    warn: boolean;
    info: boolean;
    debug: boolean;
  };
  showTimestamp: boolean;
  autoClean: boolean;
}

const DEFAULT_SETTINGS: LoggerSettings = {
  enabled: false,
  maxEntries: 500,
  levels: {
    error: true,
    warn: true,
    info: false,
    debug: false
  },
  showTimestamp: true,
  autoClean: true
};

class LoggerService {
  private logs: LogEntry[] = [];
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();
  private settings: LoggerSettings = { ...DEFAULT_SETTINGS };
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = (async () => {
      try {
        if (window.electron?.log) {
          this.settings = await window.electron.log.getSettings();
          this.logs = await window.electron.log.getLogs();
        }
      } catch {
        this.settings = { ...DEFAULT_SETTINGS };
        this.logs = [];
      }
      this.initialized = true;
    })();
    
    return this.initPromise;
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.logs]));
  }

  public async getSettings(): Promise<LoggerSettings> {
    await this.initialize();
    return { ...this.settings };
  }

  public async updateSettings(newSettings: Partial<LoggerSettings>): Promise<void> {
    await this.initialize();
    if (window.electron?.log) {
      this.settings = await window.electron.log.updateSettings(newSettings);
      if (!this.settings.enabled) {
        await this.clearLogs();
      }
    } else {
      this.settings = { ...this.settings, ...newSettings };
    }
    this.notifyListeners();
  }

  public addLogEntry(level: LogLevel, message: string, context?: string, stack?: string): void {
    // 使用 fire-and-forget 模式，不等待初始化和 IPC 调用完成
    this.initialize().catch(console.error);
    
    if (window.electron?.log) {
      window.electron.log.addLog(level, message, context, stack).catch(console.error);
      // 同时更新本地缓存，以便 UI 可以立即显示
      const entry: LogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
        level,
        message,
        context,
        stack
      };
      this.logs.push(entry);
      this.notifyListeners();
    }
  }

  public error(message: string, context?: string, error?: Error): void {
    const stack = error?.stack;
    this.addLogEntry('error', message, context, stack);
  }

  public warn(message: string, context?: string): void {
    this.addLogEntry('warn', message, context);
  }

  public info(message: string, context?: string): void {
    this.addLogEntry('info', message, context);
  }

  public debug(message: string, context?: string): void {
    this.addLogEntry('debug', message, context);
  }

  public async getLogs(): Promise<LogEntry[]> {
    await this.initialize();
    return [...this.logs];
  }

  public async getFilteredLogs(level?: LogLevel, context?: string): Promise<LogEntry[]> {
    await this.initialize();
    return this.logs.filter(log => {
      if (level && log.level !== level) return false;
      if (context && log.context !== context) return false;
      return true;
    });
  }

  public async clearLogs(): Promise<void> {
    await this.initialize();
    if (window.electron?.log) {
      await window.electron.log.clearLogs();
    }
    this.logs = [];
    this.notifyListeners();
  }

  public subscribe(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async exportLogs(): Promise<string> {
    await this.initialize();
    if (window.electron?.log) {
      return await window.electron.log.exportLogs();
    }
    return JSON.stringify(this.logs, null, 2);
  }

  public importLogs(_jsonString: string): boolean {
    // Note: Import functionality would need to be implemented on the main process side
    return false;
  }

  public async getStats(): Promise<{ total: number; byLevel: Record<LogLevel, number> }> {
    await this.initialize();
    if (window.electron?.log) {
      const stats = await window.electron.log.getStats();
      return {
        total: stats.total,
        byLevel: {
          error: stats.error,
          warn: stats.warn,
          info: stats.info,
          debug: stats.debug
        }
      };
    }
    const byLevel: Record<LogLevel, number> = {
      error: 0,
      warn: 0,
      info: 0,
      debug: 0
    };
    this.logs.forEach(log => {
      byLevel[log.level]++;
    });
    return { total: this.logs.length, byLevel };
  }

  public init(): void {
    this.initialize().catch(console.error);
  }
}

export const loggerService = new LoggerService();
loggerService.init();

export function logError(message: string, context?: string, error?: Error): void {
  loggerService.error(message, context, error);
}

export function logWarn(message: string, context?: string): void {
  loggerService.warn(message, context);
}

export function logInfo(message: string, context?: string): void {
  loggerService.info(message, context);
}

export function logDebug(message: string, context?: string): void {
  loggerService.debug(message, context);
}
