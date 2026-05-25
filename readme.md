# ToolBox

一个基于 Electron + React + TypeScript 构建的现代化桌面工具应用，集成多种实用工具和服务。

---

## 📋 目录

- [功能特性](#-功能特性)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [可用命令](#-可用命令)
- [项目结构](#-项目结构)
- [文档](#-文档)
- [许可证](#-许可证)
- [联系方式](#-联系方式)

---

## ✨ 功能特性

- **快速启动**：智能搜索、应用分类管理、浮动窗口悬浮球
- **热点新闻**：聚合各大平台热点资讯，实时更新
- **网址导航**：便捷的网页导航服务，支持收藏管理
- **记事本**：本地文件系统笔记管理，支持文件夹和笔记操作
- **浮动窗口**：桌面悬浮球，快捷访问常用功能和系统命令
- **工具箱**：33+ 实用工具（待办事项、快捷回复、云剪贴板、账号管理、天气、翻译、OCR等）
- **密码锁定**：支持通过 Ctrl+L 快捷键锁定/解锁应用
- **管理控制台**：数据可视化、用户管理、数据库备份（需登录）
- **系统设置**：主题配置、存储管理、快捷键、日志监控等
- **面包屑导航**：顶部导航栏显示当前位置路径，支持点击返回上级页面

---

## 🛠️ 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 19.2.x |
| 语言 | TypeScript | 6.x |
| 构建工具 | Vite | 8.x |
| 桌面框架 | Electron | 42.x |
| 状态管理 | Zustand | 5.x |
| 数据获取 | TanStack Query | 5.x |
| 样式 | TailwindCSS | 3.x |
| 数据库 | Supabase | - |

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18.x
- pnpm >= 8.x（推荐）或 npm >= 9.x
- Git
- Python >= 3.8（OCR 功能需要）

### 安装依赖

```bash
pnpm install
```

### Python 服务依赖（OCR）

```bash
cd python-service
pip install -r requirements.txt
```

### 开发模式

```bash
pnpm dev          # 启动前端开发服务器
pnpm electron:dev # 启动 Electron
```

### 构建生产版本

```bash
pnpm build
pnpm electron:build
```

---

## 📖 可用命令

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm build` | 构建前端生产版本 |
| `pnpm lint` | ESLint 代码检查 |
| `pnpm electron:dev` | 启动 Electron 开发模式 |
| `pnpm electron:build` | 构建 Electron 安装包 |

---

## 📁 项目结构

```
ToolBox/
├── electron/         # Electron 主进程
│   ├── window/      # 窗口管理
│   ├── services/    # 后端服务
│   ├── ipc/         # IPC 通信
│   └── preload.js   # 预加载脚本
├── python-service/  # Python OCR 服务
├── public/          # 静态资源
├── src/             # 前端源码
│   ├── components/  # 通用组件
│   ├── pages/       # 页面组件
│   ├── services/    # 服务层
│   └── store/       # 状态管理
├── docs/            # 文档目录
└── readme.md        # 项目说明
```

---

## 📚 文档

| 文档 | 说明 |
|------|------|
| [更新日志](docs/CHANGELOG.md) | 版本更新记录 |
| [贡献指南](docs/CONTRIBUTING.md) | 代码贡献规范 |
| [配置说明](docs/CONFIGURATION.md) | 环境配置指南 |

---

## 📄 许可证

MIT License

---

## 📧 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。

---

**Built with ❤️ using Electron + React + TypeScript**
