// 自动拆分自 src/vite-env.d.ts（ambient 全局声明，勿加 import/export）
// window.electron / window.translateAPI 全局注入声明

declare interface Window {
  translateAPI?: TranslateAPI;
  electron?: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    /** 边缘吸附停靠态：光标离开窗口转发（主进程延迟折叠） */
    edgeSnapCursorLeft: () => void;
    /** 边缘吸附停靠态：光标进入窗口转发（取消折叠，隐藏态即时展开） */
    edgeSnapCursorEnter: () => void;
    /** 边缘吸附停靠态：IME 组合态同步（输入中抑制自动折叠） */
    edgeSnapImeState: (composing: boolean) => void;
    /** 切换窗口模式：'compact' 小窗 / 'large' 恢复大窗 */
    setWindowMode: (mode: 'large' | 'compact') => void;
    restart: () => Promise<{ code: number; msg: string }>;
    openExternal: (url: string) => void;
    openInternal: (url: string) => void;
    openQuickLogin: (payload: QuickLoginPayload) => Promise<{ success: boolean }>;
    openFile: (path: string) => void;
    selectFile: () => Promise<string | null>;
    selectFolder: () => Promise<string | null>;
    getFileIcon: (path: string) => Promise<string | null>;
    fileExists: (path: string) => Promise<boolean>;
    scanDesktopApps: () => Promise<DesktopAppInfo[]>;
    getDroppedFiles: (filePaths: string[]) => Promise<string[]>;
    getFileOrFolderPath: (item: File) => Promise<string | undefined>;
    // P1: 快启动扩展
    launchAppWithOptions: (options: {
      path: string;
      args?: string;
      workingDir?: string;
      runAsAdmin?: boolean;
      windowMode?: 'normal' | 'minimized' | 'maximized';
    }) => Promise<{ success: boolean; error?: string }>;
    revealInFolder: (filePath: string) => Promise<boolean>;
    scanInstalledApps: () => Promise<DesktopAppInfo[]>;
    onScanInstalledAppsProgress: (callback: (data: { current: number; total: number; percent: number }) => void) => () => void;
    // P2: 全局快捷键
    registerQuickLaunchHotkey: (payload: { appId: string; accelerator: string; appPath: string }) => Promise<{ success: boolean; error?: string }>;
    unregisterQuickLaunchHotkey: (appId: string) => Promise<boolean>;
    getQuickLaunchHotkeys: () => Promise<Array<{ appId: string; accelerator: string }>>;
    // P2: 配置导入导出
    exportQuickLaunchConfig: (content: string) => Promise<{ success: boolean; filePath?: string; error?: string } | null>;
    importQuickLaunchConfig: () => Promise<{ apps: unknown[]; categories: Array<{ id: string; name: string; color: string }> } | { error: string } | null>;
    getAutostartStatus: () => Promise<boolean>;
    setAutostartStatus: (enable: boolean) => Promise<boolean>;
    getSettings: () => Promise<SettingItem[]>;
    updateSetting: (setting: { name: string; value: string | number | boolean | object }) => Promise<UpdateResult>;
    setThemeSnapshot: (colors: Record<string, string> | null) => Promise<{ code: number }>;
    setAIConfigSnapshot: (config: import('./types/ai').AIConfig) => Promise<{ success: boolean }>;
    clearCache: () => Promise<UpdateResult>;
    clearIconCache: (type: 'all' | 'general' | 'plugin' | 'app') => Promise<{ success: boolean; error?: string }>;
    resolveIcons: (urls: string[], type?: 'general' | 'plugin' | 'app') => Promise<Record<string, string | null>>;
    getIconCacheStats: () => Promise<{
      count: number;
      size: number;
      extractedCount: number;
      extractedSize: number;
      /** 磁盘缓存按图标类型的拆分，桌面端远程图标只落这一层 */
      byType: Record<'general' | 'plugin' | 'app', { count: number; size: number }>;
    }>;
    networkTest: (payload: { url: string; timeout?: number }) => Promise<{ ok: boolean; statusCode: number; latencyMs: number; error: string | null }>;
    getUserDataPath: () => Promise<string>;
    openUserDataFolder: () => Promise<{ success: boolean }>;
    getShortcuts: () => Promise<ShortcutItem[]>;
    updateShortcut: (shortcut: ShortcutItem & { flag?: boolean }) => Promise<UpdateResult>;
    resetShortcuts: () => Promise<UpdateResult>;
    getVersion: () => Promise<AppVersionInfo>;
    downloadUpdate: (url: string) => Promise<DownloadResult>;
    installUpdate: (filePath: string) => Promise<UpdateResult>;
    toggleFloatWindow: () => Promise<number>;
    getFloatConfig: () => Promise<FloatConfigItem[]>;
    updateFloatConfig: (config: FloatConfigItem[]) => Promise<UpdateResult>;
    resetFloatConfig: () => Promise<UpdateResult>;
    ocr: {
      recognize: (imageBase64: string) => Promise<OcrResult>;
      recognizeFile: (filePath: string) => Promise<OcrResult>;
      status: () => Promise<{ available: boolean; ready: boolean; message: string }>;
      start: () => Promise<{ success: boolean; message: string; error?: string }>;
      stop: () => Promise<{ success: boolean; message: string; error?: string }>;
      serviceInfo: () => Promise<{ available: boolean; ready: boolean; modelCacheDir: string }>;
      runtimeInfo: () => Promise<{ source: string; dir: string; available: boolean; ready: boolean }>;
    };
    screenshot: {
      startCapture: () => Promise<{ success: boolean; error?: string }>;
      translate: (dataUrl: string) => Promise<{ success: boolean; text?: string; error?: string }>;
      cancel: () => void;
      save: (data: { buffer: string; format: string; destinationPath?: string }) => Promise<{ success: boolean; path?: string; reason?: string }>;
      copyToClipboard: (dataUrl: string) => void;
      complete: () => void;
    };
    translate: {
      open: (payload?: Partial<TranslatePopupPayload>) => Promise<{ success: boolean; locked?: boolean }>;
      selection: () => Promise<{ success: boolean; text?: string; fallback?: boolean; hidden?: boolean; busy?: boolean }>;
      close: () => Promise<{ success: boolean }>;
      copy: (text: string) => Promise<{ success: boolean }>;
      history: TranslateHistoryAPI;
    };
    fileManager: {
      getSystemPaths: () => Promise<Array<{
        name: string;
        path: string;
        icon: string;
        isSystem: boolean;
      }>>;
      getPath: (pathType: string) => Promise<string | null>;
      listFiles: (dirPath: string) => Promise<Array<{
        name: string;
        path: string;
        isDirectory: boolean;
        size?: number;
        modifiedTime?: Date;
      }>>;
      getParentPath: (currentPath: string) => Promise<string | null>;
      openFile: (filePath: string) => Promise<boolean>;
      getFavorites: () => Promise<Array<{
        name: string;
        path: string;
        icon: string;
        isSystem: boolean;
      }>>;
      addFavorite: (path: string, name?: string) => Promise<boolean>;
      removeFavorite: (path: string) => Promise<boolean>;
      getTargetPaths: () => Promise<Array<{
        id: string;
        name: string;
        path: string;
        createdAt: Date;
      }>>;
      addTargetPath: (path: string, name?: string) => Promise<boolean>;
      removeTargetPath: (id: string) => Promise<boolean>;
      copyFiles: (sourcePaths: string[], destPath: string) => Promise<number>;
      deleteItem: (itemPath: string) => Promise<boolean>;
    };
    notes: {
      hasRootPath: () => Promise<boolean>;
      getRootPath: () => Promise<string | null>;
      setRootPath: (rootPath: string) => Promise<boolean>;
      /** 同步当前查看的固定目录（视图根）给主进程，仅用于文件操作越界放行；null 表示未配置固定目录 */
      setViewPath: (viewPath: string | null) => Promise<boolean>;
      /** 同步对话整理独立目录（对话根）给主进程，仅用于文件操作越界放行；null 表示未单独设置 */
      setChatRootPath: (chatPath: string | null) => Promise<boolean>;
      /** 同步所有固定目录给主进程，仅用于文件操作越界放行（跨目录标签/最近条目的读写） */
      setPinnedRoots: (paths: string[]) => Promise<boolean>;
      selectFolder: () => Promise<NotesSelectFolderResult>;
      validateFolder: (folderPath: string) => Promise<NotesValidateResult>;
      createFolder: (parentPath: string | null, name: string) => Promise<NotesCreateResult>;
      createFolderForce: (parentPath: string | null, name: string, mode: 'overwrite' | 'copy') => Promise<NotesCreateResult>;
      createNote: (parentPath: string | null, name: string, content?: string) => Promise<NotesCreateResult>;
      createNoteForce: (parentPath: string | null, name: string, mode: 'overwrite' | 'copy', content?: string) => Promise<NotesCreateResult>;
      /** 划词工具条「转笔记」：内容落为「对话整理」目录 md 笔记（未配置对话根时回落主根） */
      saveOrganizedNote: (payload: { content: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
      readFile: (filePath: string) => Promise<NotesReadResult>;
      readFileAsBuffer: (filePath: string) => Promise<{ success: boolean; base64?: string; mimeType?: string; error?: string }>;
      /** 视频内嵌播放前置探测：只取 size/mtime，不读文件内容 */
      statFile: (filePath: string) => Promise<{ success: boolean; size?: number; mtime?: number; isDirectory?: boolean; fileType?: 'md' | 'txt' | 'html' | 'json' | 'docx' | 'xlsx' | 'image' | 'pdf' | 'video' | null; error?: string }>;
      /** 导出 PDF：传已构建的 HTML（图片已内联），主进程打印并弹保存对话框落盘 */
      exportPdf: (payload: { html: string; defaultPath?: string }) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
      /** 导出独立 HTML（图片已内联为 data-uri，单文件可分发） */
      exportHtml: (payload: { html: string; defaultPath?: string }) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
      saveFile: (filePath: string, content: string) => Promise<NotesSaveResult>;
      renameItem: (oldPath: string, newName: string) => Promise<NotesRenameResult>;
      deleteItem: (itemPath: string) => Promise<NotesDeleteResult>;
      /** 移入系统回收站（可恢复）；与 deleteItem 的彻底删除区分 */
      trashItem: (itemPath: string) => Promise<NotesDeleteResult>;
      indexAll: (rootPath: string) => Promise<{ success: boolean; error?: string }>;
      openFileInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      moveItem: (itemPath: string, targetFolderPath: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
      copyItem: (sourcePath: string) => Promise<{ success: boolean; error?: string }>;
      /** 发送：desktop=复制到系统桌面；qq/wechat=写入系统剪贴板并唤起应用 */
      sendItem: (sourcePath: string, target: 'desktop' | 'qq' | 'wechat') => Promise<{ success: boolean; newPath?: string; error?: string }>;
      importDroppedFiles: (rootPath: string, filePaths: string[]) => Promise<{ success: boolean; imported?: string[]; errors?: string[]; error?: string }>;
      // T02 / 4.1 + 4.5：新增 6 个方法（异步树 + 草稿保护），现有 21 个不变
      scanFolderAsync: (rootPath: string) => Promise<{ success: boolean; fileCount: number; folderCount: number; tree: NotesFileTreeNode[]; error?: string }>;
      getFileTreeAsync: (rootPath: string) => Promise<NotesFileTreeNode[]>;
      writeDraft: (absolutePath: string, content: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      readDraft: (absolutePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      deleteDraft: (absolutePath: string) => Promise<{ success: boolean; error?: string }>;
      listDrafts: () => Promise<{ success: boolean; drafts?: Array<{ hash: string; filePath: string; absolutePath: string; size: number; mtime: number }>; error?: string }>;
      // T03 / Phase 2：全文搜索（主进程流式逐行扫描 + 加权打分 + mtime 缓存）
      searchNotes: (opts: {
        rootPath: string;
        query: string;
        fileTypes?: Array<'md' | 'txt' | 'html' | 'json' | 'docx' | 'xlsx' | 'image' | 'pdf' | 'video'>;
        maxResults?: number;
        caseSensitive?: boolean;
        maxFileBytes?: number;
      }) => Promise<{
        success: boolean;
        results: Array<{
          path: string;
          name: string;
          fileType: 'md' | 'txt' | 'html' | 'json' | 'docx' | 'xlsx' | 'image' | 'pdf' | 'video';
          score: number;
          matches: Array<{ field: 'title' | 'body'; line: number; snippet: string }>;
          mtime: number;
          size: number;
          titleHits?: number;
          bodyHits?: number;
        }>;
        scanned: number;
        truncated: boolean;
        elapsedMs: number;
        error?: string;
      }>;
      // T04 / Phase 2：收藏（U8 收藏，notes_settings.json 持久化）
      getFavorites: () => Promise<{ success: boolean; favorites: string[]; error?: string }>;
      setFavorites: (favorites: string[]) => Promise<{ success: boolean; favorites: string[]; error?: string }>;
      toggleFavorite: (absolutePath: string) => Promise<{ success: boolean; favorites: string[]; toggled: boolean; error?: string }>;

      // T06 / Phase 3：笔记模板（读取 userData/notes/templates/*.md 自定义模板）
      listTemplates: () => Promise<{ success: boolean; templates: Array<{ id: string; name: string; content: string }>; error?: string }>;
      // T07 / Phase 3：附件落盘（粘贴/拖入图片自动保存到 .attachments/yyyy-mm/<hash>.<ext>）
      saveAttachment: (notePath: string, fileName: string, data: Uint8Array) => Promise<{ success: boolean; relativePath?: string; reused?: boolean; error?: string }>;
      // T09 / Phase 4：文件监听（结构同 src/pages/tools/notes/types.ts 的 NotesFsChangeEvent）
      startWatching: (rootPath: string) => Promise<{ success: boolean; error?: string }>;
      stopWatching: () => Promise<{ success: boolean; error?: string }>;
      // type 只可能是 'change'（内容写入）或 'rename'（条目增删/改名）——Node fs.watch 语义
      onFsChanged: (callback: (event: { type: 'change' | 'rename'; path: string; rootPath: string; timestamp: number }) => void) => () => void;
    };
    ai: {
      chat: (payload: { url: string; apiKey?: string; body: Record<string, unknown>; timeoutMs?: number }) => Promise<{ success: boolean; content?: string; error?: string; status?: number }>;
    };
    /** 悬浮球 AI 面板回传的写入请求（当前仅「存为待办」） */
    floatAi?: {
      onSaveTodo: (callback: (payload: { requestId?: string; title: string; description?: string }) => void) => () => void;
      reportSaveTodo: (payload: {
        requestId: string;
        success: boolean;
        todo?: unknown;
        error?: string;
      }) => void;
    };
    /** 划词工具条「问AI」：带文本打开小橘面板（chat 模式，输入框预填） */
    floatPanel?: {
      openChat: (text: string) => Promise<{ ok: boolean; error?: string }>;
    };
    /** 悬浮球洞察气泡：每日快照（天气/黄历/打卡，预格式化文案，主进程合并写） */
    floatDailySnapshot?: (payload: {
      weather?: { summary: string; updatedAt: number };
      almanac?: { line: string; date: string };
      checkIn?: { checkedToday: boolean; streak: number; weekCount: number; date: string };
    }) => void;
    /** 悬浮球洞察气泡：轻量事件（打卡成功等即时反馈） */
    floatInsightEvent?: (payload: { type: string; streak?: number }) => void;
    log: {
      open: () => void;
      addLog: (level: 'error' | 'warn' | 'info' | 'debug', message: string, context?: string, stack?: string) => Promise<boolean>;
      getLogs: () => Promise<Array<{
        id: string;
        timestamp: number;
        level: 'error' | 'warn' | 'info' | 'debug';
        message: string;
        context?: string;
        stack?: string;
      }>>;
      getSettings: () => Promise<{
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
      }>;
      updateSettings: (newSettings: Partial<{
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
      }>) => Promise<{
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
      }>;
      clearLogs: () => Promise<boolean>;
      exportLogs: () => Promise<string>;
      importLogs: (jsonString: string) => Promise<boolean>;
      getStats: () => Promise<{ total: number; error: number; warn: number; info: number; debug: number }>;
      minimize: () => void;
      close: () => void;
      onNewEntry: (callback: (entry: { id: string; timestamp: number; level: 'error' | 'warn' | 'info' | 'debug'; message: string; context?: string; stack?: string }) => void) => () => void;
      onCleared: (callback: () => void) => () => void;
    };
    onDownloadProgress: (callback: (progress: number) => void) => () => void;
    onNavigate: (callback: (path: string) => void) => () => void;
    onSettingChanged: (callback: (setting: { name: string; value: string | number | boolean | object }) => void) => () => void;
    onOpenAddTodo: (callback: () => void) => void;
    onOpenAddMemo: (callback: () => void) => void;
    // 定时提醒：托盘/悬浮球触发新建（data 可选预填数据）；主进程 show-reminder 事件下发弹窗内容
    // data 使用宽松类型避免与 CreateReminderRequest 的字面量联合类型冲突；调用方按需断言
    onOpenAddReminder: (callback: (data?: unknown) => void) => void;
    onShowReminder: (callback: (reminder: { title: string; content: string; id?: string }) => void) => void;
    sqlite: {
      invoke: <T>(channel: string, payload?: unknown) => Promise<T>;
    };
    // 定时提醒：主进程 Windows 计划任务管理（schtasks 注册/删除）
    reminder: {
      schedule: (reminder: unknown) => Promise<void>;
      remove: (id: string) => Promise<void>;
      notify: (reminder: { title: string; content: string; id?: string; notify_method?: string }) => Promise<void>;
    };
    ipcRenderer: {
      invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>;
      on: <T extends unknown[]>(channel: string, listener: (event: unknown, ...args: T) => void) => void;
      off: <T extends unknown[]>(channel: string, listener: (event: unknown, ...args: T) => void) => void;
    };
    ipInfo: {
      query: (ip?: string) => Promise<{
        ip: string;
        version: string;
        city: string;
        region: string;
        country_name: string;
        country_code: string;
        timezone: string;
        currency: string;
        currency_name: string;
        postal: string;
        latitude: number;
        longitude: number;
        org: string;
        asn: string;
        languages: string;
        error?: boolean;
        reason?: string;
      }>;
    };
    systemInfo: {
      get: () => Promise<SystemInfo>;
    };
    plugin: {
      getAvailable: () => Promise<PluginInfo[]>;
      getInstalled: () => Promise<InstalledPlugin[]>;
      install: (pluginId: string, repo?: string, releaseUrl?: string) => Promise<{ success: boolean; reason?: string; message?: string }>;
      uninstall: (pluginId: string) => Promise<{ success: boolean; message?: string }>;
      toggleEnabled: (pluginId: string, enabled: boolean) => Promise<{ success: boolean }>;
      installFromFile: () => Promise<{ success: boolean; reason?: string; message?: string; canceled?: boolean }>;
      installFromPath: (filePath: string) => Promise<{ success: boolean; reason?: string; message?: string }>;
      installFromGithub: (id: string, repo: string) => Promise<{ success: boolean; reason?: string; message?: string }>;
      openWindow: (pluginId: string, userId?: string | null) => Promise<{ success: boolean; error?: string }>;
      openExtensionsDir: () => Promise<{ success: boolean; error?: string }>;
      onInstallProgress: (callback: (data: { pluginId: string; progress: { status: 'starting' | 'downloading' | 'extracting' | 'installing' | 'completed' | 'error'; message: string; progress: number; mirror?: string } }) => void) => () => void;
      storage: {
        get: <T>(pluginId: string, userId: string, key?: string) => Promise<T | null>;
        set: (pluginId: string, userId: string, key: string, value: unknown) => Promise<void>;
        delete: (pluginId: string, userId: string, key?: string) => Promise<void>;
      };
    };
    offlineTools: {
      getDir: () => Promise<string | null>;
      setDir: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
      list: (dirPath: string) => Promise<{ success: boolean; files: OfflineToolFile[]; error?: string }>;
      open: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    };
  };
}
