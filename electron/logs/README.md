# electron/logs — 日志源码目录

此目录存放日志相关的**源文件**。运行时产生的日志文件不存储于此。

## 文件说明

| 文件 | 职责 |
|---|---|
| `logger.cjs` | 日志核心：初始化、写入（electron-log）、内存 entries、导出/导入、统计 |
| `window.cjs` | 日志监控窗口：创建独立窗口、注册 IPC 处理、桥接 renderer ↔ logger |

## 运行时日志路径

运行时日志由 `electron-log` 写入用户数据目录，**不在本仓库**：

- **Windows**: `%APPDATA%\ToolBox\logs\app.log`
- **settings**: `%APPDATA%\ToolBox\logs\settings.json`

`logger.cjs` 通过 `app.getPath('userData')` 定位，随平台自动切换。

## 架构说明

```
renderer  ──IPC──▶  main window (window.cjs)  ──内部调用──▶  logger.cjs
                                                        │
                                                        ▼
                                              %APPDATA%\ToolBox\logs\app.log  ← 持久化日志
```

- `logger.cjs` 持有内存中的 entries（最多 500 条），并通过 IPC 推送给 renderer
- `window.cjs` 监听 IPC 事件并转发到 logger，同时管理日志监控窗口的生命周期
