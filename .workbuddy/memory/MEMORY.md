# ToolBox 项目长期记忆

## 包管理器

- **包管理器：pnpm**（不是 npm）
- 证据：根目录存在 `pnpm-lock.yaml`（228K）与 `pnpm-workspace.yaml`（103B）
- 命令：`pnpm install`、`pnpm build`、`pnpm run dev`，不要写 `npm`
- 安装时若提示 lockfile 不匹配：`pnpm install --no-frozen-lockfile` 或确认依赖后再 `pnpm install`

## 项目结构关键

- 主进程入口：`electron/main.cjs`
- 渲染入口：`src/main.tsx`
- 构建：`vite.config.ts`（manualChunks 把 lucide-react 整包打入 vendor-ui——tree-shake 失效根因）
- 数据库：sql.js（WASM），文件由 `electron/services/sqliteService.cjs` 管理
- 邮件：`electron/services/email{Service,IdleService,OAuthService}.cjs`
- Python 子进程：`electron/services/pythonProcessService.cjs`
- 复制脚本：`scripts/copy-vditor-assets.cjs`（无过滤拷贝 Vditor 全部资产）
- 文档：`doc/`（已生成审查报告）

## 当前主要约束（用户偏好）

- 不动加密（`src/utils/crypto.ts`）
- 不动 UI 布局样式
- 不动数据契约（supabase 表结构、IPC 通道、SQLite schema）
- 不引入新依赖（除必要）
- 不复杂化代码（优先"删除/收敛/复用"）

## 关键文件行号速查（v3 报告核对版）

- `electron/main.cjs:1-7` — process.on 全局异常兜底（新增）
- `electron/main.cjs:129-147` — before-quit 含 stopAll + disposePool
- `electron/services/emailIdleService.cjs:60-63, 92-94` — runLoop catch + .catch 续接
- `electron/services/emailService.cjs:115-130 / 132-146` — pool + reapTimer + disposePool
- `electron/services/sqliteService.cjs:86-112 / 274` — persist 三层 + NPE 守卫
- `electron/services/pythonProcessService.cjs:309-336` — sigkillTimer + clearTimeout
- `electron/preload.cjs:10-16` — screenshotApi 已删除
- `electron/preload.cjs:282-287` — 裸暴露 ipcRenderer（暂不修）
- `electron/window/lockWindow.cjs:1, 28-35, 72` — **app 必须在模块顶层解构**（line 1 含 app），否则 createLockWindow 内部 line 72 `app.isPackaged` 会 ReferenceError 导致启动失败
- `electron/window/mainWindow.cjs:164-165` — memoryCleanupTimer + unref
- `src/components/home/WeatherCard.tsx:85-89` — 5s 重试已删
- `src/services/syncManager.ts:498-510` — handleConflicts 含 error 分支
- `src/services/MemoService.ts:164-197` — searchMemos + countActiveMemos 辅助

## lockWindow.cjs 启动崩溃教训（v2.8.9 发现）

- **根因**：在 v3 优化中把 `app.on('before-quit')` 从 `createLockWindow` 内移到模块顶层，并把 `const { app } = require('electron')` 改名为 `appForQuit`（避免命名混淆），但**遗漏了 `createLockWindow` 函数体内 line 72 仍有 `if (app.isPackaged)` 引用**
- **触发**：用户曾设置过锁屏密码 → `checkLockOnStartup()` → `createLockWindow()` → line 72 抛 `ReferenceError: app is not defined`
- **隐蔽性**：v2.8.9 同时新增了 `process.on('uncaughtException')` 全局兜底，该错误被捕获仅 console.log，主进程不退出也不创建主窗 → 表现"进程在但窗口不出现"
- **修复**：将 `app` 重新加入 line 1 的解构：`const { BrowserWindow, ipcMain, dialog, screen, app } = require('electron')`，删除模块顶层重复 require
- **教训**：重构时若局部变量被引用，要确保新作用域能提供该变量；全局兜底也可能掩盖启动期错误，导致定位困难
