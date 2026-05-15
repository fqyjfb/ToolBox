
# ToolBox

一个基于 Electron + React + TypeScript 构建的现代化桌面工具应用，集成多种实用工具和服务。

## ✨ 功能特性

- **快速启动**：智能搜索、应用分类管理、浮动窗口悬浮球
- **热点新闻**：聚合各大平台热点资讯，实时更新
- **网址导航**：便捷的网页导航服务，支持收藏管理
- **记事本**：本地文件系统笔记管理，支持文件夹和笔记操作
- **浮动窗口**：桌面悬浮球，快捷访问常用功能和系统命令
- **工具箱**：33+ 实用工具（待办事项、快捷回复、云剪贴板、账号管理、天气、翻译、OCR等）
- **管理控制台**：数据可视化、用户管理、数据库备份（需登录）
- **系统设置**：主题配置、存储管理、快捷键、日志监控等

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

## 📖 可用命令

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm build` | 构建前端生产版本 |
| `pnpm lint` | ESLint 代码检查 |
| `pnpm electron:dev` | 启动 Electron 开发模式 |
| `pnpm electron:build` | 构建 Electron 安装包 |

## ⚙️ 配置说明

### Supabase 配置

在项目根目录创建 `.env` 文件：

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

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
└── readme.md        # 项目说明
```

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add some feature'`
4. 推送到分支：`git push origin feature/your-feature`
5. 创建 Pull Request

### 代码规范

- 使用 ESLint 进行代码检查
- 遵循 TypeScript 严格模式
- 使用 Prettier 格式化代码
- 保持代码简洁和可读性
- 遵循项目的设计系统规范

## 📝 更新日志

### v2.1.3
- 新增图标缓存功能：使用 Cache API 存储网站图标，减少重复网络请求
- 优化日志功能：修复级别过滤、添加缓冲队列、实现日志轮转和导入功能
- 完善服务层日志记录（PasswordService、AuthService）

### v2.1.2
- 引入 TanStack Query 进行数据获取和缓存管理
- 重构服务层，添加 AbortSignal 支持

### v2.1.1
- 修复日志窗口功能，完善日志记录系统

### v2.0.0
- 新增 OCR 文字识别、浮动窗口、记事本等功能

## 📄 许可证

MIT License

## 📧 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。

---

**Built with ❤️ using Electron + React + TypeScript**
