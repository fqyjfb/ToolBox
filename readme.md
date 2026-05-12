# ToolBox

一个基于 Electron + React + TypeScript 构建的现代化桌面工具应用，集成多种实用工具和服务，为用户提供一站式的效率提升解决方案。支持桌面端、Web 端和移动端多平台部署。

## ✨ 功能特性

### 🚀 快速启动
- 快速访问常用应用程序和快捷方式
- 支持应用分类管理和自定义排序
- 智能搜索功能，快速定位应用
- 支持拖拽调整应用顺序
- 浮动窗口悬浮球，一键快速启动

### 📰 热点新闻
- 聚合各大平台热点资讯（微博、头条、抖音、知乎、B站等）
- 实时更新新闻内容
- 支持多种新闻分类浏览
- 一键跳转原文查看详情

### 🔗 网址导航
- 便捷的网页导航服务
- 支持网址分类和收藏管理
- 快速搜索和一键访问
- 支持自定义网址添加

### 📝 记事本
- 本地文件系统笔记管理
- 支持文件夹和笔记的创建、重命名、删除
- 文件树展示和导航
- 笔记内容编辑和自动保存
- 最后打开文件记忆功能
- 右键上下文菜单操作

### 🎯 浮动窗口
- 桌面悬浮球，可拖动定位
- 快捷访问常用功能和工具
- 支持系统命令（清空回收站、打开我的电脑、关机、重启等）
- 自定义配置快捷项
- 支持导航、工具、应用、系统四种类型快捷操作

### 🛠️ 工具箱

#### 实用工具（35+ 工具）
- **待办事项** - 任务管理和提醒功能
- **记事本** - 本地文件系统笔记管理
- **快捷回复** - 预设回复模板管理
- **云剪贴板** - 跨设备剪贴板同步
- **账号管理** - 密码和账号安全存储
- **天气预报** - 获取实时天气信息
- **汇率换算** - 实时汇率查询和多币种换算
- **在线翻译** - 多语言互译服务
- **区号查询** - 全球国家区号查询
- **Markdown** - Markdown 转微信格式
- **IP地址查询** - 获取 IP 地址详细信息
- **Emoji清理器** - 批量移除文本中的表情符号
- **JSON格式化** - 格式化和美化 JSON
- **时间戳转换** - Unix 时间戳转换工具
- **大小写转换** - 文本大小写快速转换
- **哈希生成器** - MD5/SHA 等哈希值计算
- **文本去重** - 移除重复文本内容
- **CSV转JSON** - 数据格式转换工具
- **JSON转CSV** - 数据格式转换工具
- **URL解析器** - 解析 URL 参数
- **Sitemap生成器** - 生成网站 sitemap
- **二维码生成器** - 生成自定义二维码
- **正则测试器** - 正则表达式在线测试
- **URL编码解码** - URL 编码和解码
- **Meta标签生成** - HTML Meta 标签生成器
- **MD转纯文本** - Markdown 转文本
- **HTML转纯文本** - 提取 HTML 中的纯文本
- **SQL压缩器** - SQL 语句压缩工具
- **HEX编码** - 十六进制编码
- **HEX解码** - 十六进制解码
- **OCR文字识别** - 图片文字提取
- **文件管理器** - 本地文件浏览和管理

### 📊 管理控制台（需登录）
- 数据可视化与分析仪表盘
- 用户管理功能
- 网址管理功能
- 工具管理功能
- 数据库备份管理

### 🔧 系统设置
- 个性化主题配置
- 深色/浅色主题切换
- 用户偏好设置
- 存储管理（数据库文件夹查看、缓存清理）
- 数据备份与恢复
- 快捷键配置
- 浮动窗口配置
- OCR 服务配置
- 日志监控

## 🛠️ 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 19.2.x |
| 语言 | TypeScript | 6.x |
| 构建工具 | Vite | 8.x |
| 桌面框架 | Electron | 42.x |
| 状态管理 | Zustand | 5.x |
| 路由 | React Router DOM | 7.x |
| UI 图标 | Lucide React | 1.x |
| 样式 | TailwindCSS | 3.x |
| 数据库 | Supabase / SQLite | - |
| Markdown 编辑器 | Vditor | 3.x |
| 二维码生成 | qrcode | 1.5.x |
| 图表生成 | html2canvas / jspdf | - |
| Python 服务 | FastAPI | - |
| 拖拽排序 | @dnd-kit | - |
| 样式处理 | styled-components | 6.x |

## 🚀 快速开始

### 环境要求

- Node.js >= 18.x
- pnpm >= 8.x（推荐）或 npm >= 9.x
- Git
- Python >= 3.8 (OCR 功能需要)

### 安装依赖

```bash
# 使用 pnpm 安装依赖（推荐）
pnpm install

# 或使用 npm
npm install
```

### Python 服务依赖（OCR 功能）

```bash
cd python-service
pip install -r requirements.txt
```

### 开发模式

```bash
# 启动前端开发服务器（终端1）
pnpm dev

# 在另一个终端启动 Electron（终端2）
pnpm electron:dev
```

### 构建生产版本

```bash
# 构建前端代码
pnpm build

# 构建 Electron 安装包（Windows）
pnpm electron:build
```

### 代码检查

```bash
# ESLint 代码检查
pnpm lint

# 自动修复问题
pnpm lint --fix
```

## 📖 可用命令

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm build` | 构建前端生产版本（含图标生成） |
| `pnpm lint` | ESLint 代码检查 |
| `pnpm lint --fix` | ESLint 自动修复 |
| `pnpm preview` | 预览构建结果 |
| `pnpm electron:dev` | 启动 Electron 开发模式 |
| `pnpm electron:build` | 构建 Electron 安装包 |
| `pnpm generate-icons` | 生成图标数据 |
| `pnpm dev:electron` | 启动 Electron 模式开发服务器 |

## ⚙️ 配置说明

### Supabase 配置

在项目根目录创建 `.env` 文件：

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 构建配置

Electron Builder 配置在 `package.json` 的 `build` 字段中：

```json
{
  "build": {
    "appId": "com.toolbox.app",
    "productName": "ToolBox",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "electron/**/*",
      "dist/**/*",
      "public/**/*",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "python-service",
        "to": "python-service"
      }
    ],
    "win": {
      "target": ["nsis"],
      "icon": "public/favicon.png"
    }
  }
}
```

### OCR 服务配置

Python 服务默认运行在 `http://127.0.0.1:8766`，可通过环境变量 `HTTP_PORT` 配置端口。

## 🔐 安全特性

- 用户数据加密存储
- 安全的身份认证机制
- HTTPS 通信支持
- 敏感信息脱敏处理
- 本地 SQLite 数据库支持
- 单实例应用锁定

## 📁 项目结构

```
ToolBox/
├── electron/                 # Electron 主进程
│   ├── window/              # 窗口管理
│   │   ├── mainWindow.js    # 主窗口
│   │   ├── floatWindow.js   # 悬浮窗
│   │   └── tray.js          # 系统托盘
│   ├── services/            # 后端服务
│   │   ├── notesService.js  # 记事本服务
│   │   ├── pythonEnvService.js
│   │   └── pythonProcessService.js
│   ├── ipc/                 # IPC 通信
│   │   ├── fileManagerIpc.js
│   │   └── ocrIpc.js
│   ├── config.js            # 配置管理
│   ├── main.js              # 主进程入口
│   ├── preload.js           # 预加载脚本
│   ├── float.js             # 悬浮球逻辑
│   ├── float.html           # 悬浮球页面
│   ├── float.css            # 悬浮球样式
│   └── float-preload.js     # 悬浮球预加载
├── python-service/          # Python OCR 服务
│   ├── api/                 # FastAPI 路由
│   │   └── routers/ocr.py   # OCR 接口
│   ├── main.py              # Python 服务入口
│   ├── ocr_service.py       # OCR 服务实现
│   └── requirements.txt     # Python 依赖
├── public/                  # 静态资源
│   ├── all-icons/           # 应用图标
│   ├── hot/                 # 热点新闻图标
│   ├── imgs/                # 图片资源
│   ├── favicon.png          # 网站图标
│   └── icons.ico            # 应用图标
├── scripts/                 # 构建脚本
│   └── generate-icon-data.js
├── src/                     # 前端源码
│   ├── components/          # 通用组件
│   │   ├── forms/           # 表单组件
│   │   ├── home/            # 首页组件
│   │   ├── icons/           # 图标组件
│   │   ├── layout/          # 布局组件
│   │   ├── settings/        # 设置页面组件
│   │   ├── ui/              # UI 基础组件
│   │   └── WMarkdownEditor/ # Markdown 编辑器
│   ├── config/              # 配置文件
│   ├── constants/           # 常量定义
│   ├── contexts/            # React Context
│   ├── hooks/               # 自定义 Hooks
│   ├── pages/               # 页面组件
│   │   ├── admin/           # 管理后台页面
│   │   ├── desktop/         # 桌面端页面
│   │   ├── mobile/          # 移动端页面
│   │   ├── shared/          # 共享页面
│   │   ├── tools/           # 工具页面
│   │   └── web/             # Web 端页面
│   ├── services/            # 服务层
│   ├── store/               # Zustand 状态管理
│   ├── styles/              # 样式文件
│   ├── types/               # TypeScript 类型定义
│   └── utils/               # 工具函数
├── .github/                 # GitHub 配置
│   └── workflows/           # CI/CD 工作流
├── index.html               # HTML 入口
├── package.json             # 项目配置
├── tsconfig.json            # TypeScript 配置
├── tsconfig.app.json        # 应用 TS 配置
├── tsconfig.node.json       # Node TS 配置
├── vite.config.ts           # Vite 配置
├── tailwind.config.js       # Tailwind 配置
├── postcss.config.js        # PostCSS 配置
├── eslint.config.mjs        # ESLint 配置
└── readme.md                # 项目说明
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

### v2.0.0
- 新增 OCR 文字识别功能（基于 Python FastAPI 服务）
- 新增浮动窗口悬浮球功能
- 新增记事本功能，支持本地文件系统笔记管理
- 新增存储管理设置页面（数据库文件夹查看、缓存清理）
- 新增快捷键配置功能
- 新增浮动窗口配置编辑器
- 新增日志监控功能
- 添加 SQLite 本地数据库支持
- 新增文件管理器工具
- 修复悬浮窗导航类型名称自动更新问题
- 修复悬浮窗快捷启动导航路径问题
- 优化多平台支持（桌面端、Web 端、移动端）
- 更新 TypeScript 至 6.x 版本
- 更新 Electron 至 42.x 版本
- 更新 Vite 至 8.x 版本

### v1.2.0
- 优化天气预警功能展示
- 修复天气工具类型定义问题
- 改进代码质量和类型安全
- 更新依赖包版本

### v1.0.0
- 初始版本发布
- 实现快速启动功能
- 实现热点新闻功能
- 实现网址导航功能
- 实现工具箱功能（28+ 工具）
- 实现管理控制台功能
- 实现系统设置功能
- 支持深色/浅色主题切换

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 📧 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。

---

**Built with ❤️ using Electron + React + TypeScript**
