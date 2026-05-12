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

const LOG_STORAGE_KEY = 'toolbox_logs';
const SETTINGS_STORAGE_KEY = 'toolbox_logger_settings';

class LoggerService {
  private logs: LogEntry[] = [];
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();
  private settings: LoggerSettings = this.loadSettings();

  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private loadSettings(): LoggerSettings {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // Silent failure - use default settings
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Silent failure - settings will not persist
    }
  }

  private persistLogs(): void {
    if (!this.settings.enabled) return;
    try {
      const logsToSave = this.logs.slice(-this.settings.maxEntries);
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logsToSave));
    } catch {
      // Silent failure - logs will not persist
    }
  }

  private loadLogs(): void {
    try {
      const saved = localStorage.getItem(LOG_STORAGE_KEY);
      if (saved) {
        this.logs = JSON.parse(saved);
      }
    } catch {
      this.logs = [];
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.settings.enabled) return false;
    return this.settings.levels[level] === true;
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.logs]));
  }

  public getSettings(): LoggerSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<LoggerSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    if (!this.settings.enabled) {
      this.clearLogs();
    }
    this.notifyListeners();
  }

  public addLogEntry(level: LogLevel, message: string, context?: string, stack?: string): void {
    if (!this.shouldLog(level)) {
      if (level === 'error' && this.settings.enabled) {
        console.error(`[${context || 'App'}]`, message, stack);
      }
      return;
    }

    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      message,
      context,
      stack
    };

    this.logs.push(entry);

    if (this.logs.length > this.settings.maxEntries) {
      this.logs = this.logs.slice(-this.settings.maxEntries);
    }

    if (this.settings.autoClean && this.logs.length > this.settings.maxEntries * 0.8) {
      this.persistLogs();
    }

    this.notifyListeners();
    this.persistLogs();

    if (level === 'error') {
      console.error(`[${context || 'App'}]`, message, stack);
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

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public getFilteredLogs(level?: LogLevel, context?: string): LogEntry[] {
    return this.logs.filter(log => {
      if (level && log.level !== level) return false;
      if (context && log.context !== context) return false;
      return true;
    });
  }

  public clearLogs(): void {
    this.logs = [];
    localStorage.removeItem(LOG_STORAGE_KEY);
    this.notifyListeners();
  }

  public subscribe(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  public importLogs(jsonString: string): boolean {
    try {
      const imported = JSON.parse(jsonString);
      if (Array.isArray(imported)) {
        this.logs = imported;
        this.persistLogs();
        this.notifyListeners();
        return true;
      }
    } catch {
      // Silent failure - import failed
    }
    return false;
  }

  public getStats(): { total: number; byLevel: Record<LogLevel, number> } {
    const byLevel: Record<LogLevel, number> = {
      error: 0,
      warn: 0,
      info: 0,
      debug: 0
    };

    this.logs.forEach(log => {
      byLevel[log.level]++;
    });

    return {
      total: this.logs.length,
      byLevel
    };
  }

  public init(): void {
    this.loadLogs();
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
