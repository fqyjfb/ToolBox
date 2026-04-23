# ToolBox

一个基于 Electron + React + TypeScript 构建的现代化桌面工具应用，集成多种实用工具和服务。

## ✨ 功能特性

### 🚀 快速启动
- 快速访问常用应用程序和快捷方式
- 支持应用分类管理
- 智能搜索功能

### 📰 热点新闻
- 聚合各大平台热点资讯
- 实时更新新闻内容
- 支持多种新闻分类浏览

### 🔗 网址导航
- 便捷的网页导航服务
- 支持网址分类和收藏
- 快速搜索和访问

### 🛠️ 工具箱
- **汇率换算** - 实时汇率查询和换算
- **云剪贴板** - 跨设备剪贴板同步
- **快捷回复** - 预设回复模板管理
- **待办事项** - 任务管理和提醒
- **国家区号查询** - 全球国家区号查询
- **账号管理** - 密码和账号安全存储
- **大小写转换** - 文本大小写快速转换
- **CSV/JSON 互转** - 数据格式转换工具
- **Emoji 移除** - 批量移除文本中的表情符号
- **Hash 生成** - MD5/SHA 等哈希值计算
- **Hex 编解码** - 十六进制编码解码
- **HTML 转文本** - 提取 HTML 中的纯文本
- **IP 信息查询** - 获取 IP 地址详细信息
- **JSON 格式化** - 格式化和美化 JSON
- **Markdown 工具** - Markdown 转文本/微信格式
- **Meta 标签生成** - HTML Meta 标签生成器
- **二维码生成** - 生成自定义二维码
- **正则测试** - 正则表达式在线测试
- **站点地图生成** - 生成网站 sitemap
- **SQL 压缩** - SQL 语句压缩工具
- **文本去重** - 移除重复文本内容
- **时间戳转换** - Unix 时间戳转换工具
- **URL 编解码** - URL 编码和解码
- **URL 解析** - 解析 URL 参数

### 📊 数据分析（需登录）
- 数据可视化与分析
- 管理控制台功能
- 网址管理功能

### 🔧 系统设置
- 个性化主题配置
- 深色/浅色主题切换
- 用户偏好设置

## 🛠️ 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 19.2.5 |
| 语言 | TypeScript | 6.x |
| 构建工具 | Vite | 8.x |
| 桌面框架 | Electron | 41.x |
| 状态管理 | Zustand | 5.x |
| 路由 | React Router DOM | 7.x |
| UI 图标 | Lucide React | 1.x |
| 样式 | TailwindCSS | 3.x |
| 数据库 | Supabase | - |
| 拖拽排序 | @dnd-kit | 6.x |

## 🚀 快速开始

### 环境要求

- Node.js >= 18.x
- npm >= 9.x 或 pnpm >= 8.x
- Git

### 安装依赖

```bash
# 使用 pnpm 安装依赖（推荐）
pnpm install

# 或使用 npm
npm install
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

## 📁 项目结构

```
├── electron/                     # Electron 主进程代码
│   ├── main.js                  # 主进程入口
│   └── preload.js               # 预加载脚本（桥接主进程和渲染进程）
├── src/                         # React 应用源码
│   ├── assets/                  # 静态资源文件
│   ├── components/              # 公共组件
│   │   ├── home/                # 首页组件
│   │   │   ├── FavoritesBar.tsx     # 收藏栏组件
│   │   │   ├── HistoryCard.tsx      # 历史记录卡片
│   │   │   ├── NewsCard.tsx         # 新闻卡片
│   │   │   ├── QuickLaunchBar.tsx   # 快速启动栏
│   │   │   ├── SearchBar.tsx        # 搜索栏
│   │   │   └── ToolGrid.tsx         # 工具网格
│   │   ├── ConfirmDialog.tsx     # 确认对话框
│   │   ├── ContextMenu.tsx       # 右键上下文菜单
│   │   ├── CountryCodeSearch.tsx # 国家区号搜索
│   │   ├── Layout.tsx            # 布局组件
│   │   ├── LoadingSpinner.tsx    # 加载指示器
│   │   ├── Modal.tsx             # 模态框组件
│   │   ├── Pagination.tsx        # 分页组件
│   │   ├── PopupMenu.tsx         # 弹出菜单组件
│   │   ├── Sidebar.tsx           # 侧边栏导航组件
│   │   ├── Switch.tsx            # 开关组件
│   │   ├── SwitchFilter.tsx      # 开关过滤组件
│   │   ├── Toast.tsx             # 消息提示组件
│   │   └── TodoCheckbox.tsx      # 待办复选框
│   ├── config/                  # 配置文件
│   │   └── routes.tsx            # 路由配置
│   ├── contexts/                # React Context
│   │   ├── NavSearchContext.tsx  # 导航搜索上下文
│   │   └── TodoNotificationContext.tsx # 待办通知上下文
│   ├── data/                    # 静态数据
│   │   └── countryCodes.ts       # 国家区号数据
│   ├── pages/                   # 页面组件
│   │   ├── admin/                # 管理控制台
│   │   │   ├── index.tsx            # 控制台首页
│   │   │   └── websites.tsx         # 网址管理
│   │   ├── tools/                # 工具页面
│   │   │   ├── account/             # 账号管理
│   │   │   ├── case-converter/      # 大小写转换
│   │   │   ├── cloud-clipboard/     # 云剪贴板
│   │   │   ├── country-code/        # 国家区号
│   │   │   ├── csv-to-json/         # CSV/JSON 互转
│   │   │   ├── emoji-remover/       # Emoji 移除
│   │   │   ├── exchange/            # 汇率换算
│   │   │   ├── hash-generator/      # Hash 生成
│   │   │   ├── hex-decode/          # Hex 解码
│   │   │   ├── hex-encode/          # Hex 编码
│   │   │   ├── html-to-text/        # HTML 转文本
│   │   │   ├── ip-info/             # IP 信息
│   │   │   ├── json-formatter/      # JSON 格式化
│   │   │   ├── json-to-csv/         # JSON 转 CSV
│   │   │   ├── markdown-to-text/    # Markdown 转文本
│   │   │   ├── markdown-to-wechat/  # Markdown 转微信
│   │   │   ├── meta-tags-generator/ # Meta 标签生成
│   │   │   ├── qr-generator/        # 二维码生成
│   │   │   ├── quick-reply/         # 快捷回复
│   │   │   ├── regex-tester/        # 正则测试
│   │   │   ├── sitemap-generator/   # 站点地图
│   │   │   ├── sql-minifier/        # SQL 压缩
│   │   │   ├── text-deduplicator/   # 文本去重
│   │   │   ├── timestamp-converter/ # 时间戳转换
│   │   │   ├── todo/                # 待办事项
│   │   │   ├── url-encode/          # URL 编码
│   │   │   └── url-parser/          # URL 解析
│   │   ├── About.tsx              # 关于页面
│   │   ├── Home.tsx               # 首页
│   │   ├── HotNewsPage.tsx        # 热点新闻页面
│   │   ├── LoginPage.tsx          # 登录页面
│   │   ├── NavPage.tsx            # 网址导航页面
│   │   ├── QuickLaunch.tsx        # 快速启动页面
│   │   ├── Settings.tsx           # 设置页面
│   │   └── ToolsPage.tsx          # 工具中心页面
│   ├── services/                 # 服务层
│   │   ├── AuthService.ts         # 认证服务
│   │   ├── ClipboardService.ts    # 剪贴板服务
│   │   ├── PasswordService.ts     # 密码服务
│   │   ├── QuickReplyService.ts   # 快捷回复服务
│   │   ├── TodoService.ts         # 待办事项服务
│   │   ├── WebsiteService.ts      # 网址服务
│   │   ├── api.ts                 # API 封装
│   │   ├── browserService.ts      # 浏览器服务
│   │   ├── cacheService.ts        # 缓存服务
│   │   ├── hotNews.ts             # 热点新闻服务
│   │   └── supabase.ts            # Supabase 配置
│   ├── store/                    # Zustand 状态管理
│   │   ├── AuthStore.ts           # 认证状态管理
│   │   ├── sidebarStore.ts        # 侧边栏状态管理
│   │   ├── themeStore.ts          # 主题状态管理
│   │   └── toastStore.ts          # Toast 消息状态管理
│   ├── styles/                   # 样式文件
│   │   └── theme.css              # 主题样式
│   ├── types/                    # TypeScript 类型定义
│   │   ├── auth.ts                # 认证相关类型
│   │   ├── clipboard.ts           # 剪贴板类型
│   │   ├── hotNews.ts             # 热点新闻类型
│   │   ├── password.ts            # 密码类型
│   │   ├── quickReply.ts          # 快捷回复类型
│   │   ├── todo.ts                # 待办事项类型
│   │   ├── website.ts             # 网址类型
│   │   └── index.ts               # 公共类型导出
│   ├── utils/                    # 工具函数
│   │   ├── crypto.ts              # 加密工具
│   │   ├── homeTools.ts           # 首页工具
│   │   ├── index.ts               # 通用工具函数
│   │   └── quickLaunch.ts         # 快速启动工具
│   ├── App.tsx                   # 应用入口组件
│   ├── main.tsx                  # React 渲染入口
│   └── index.css                 # 全局样式
├── public/                      # 静态资源
│   ├── all-icons/                # 图标文件
│   ├── hot/                      # 热点新闻图标
│   ├── favicon.ico               # 应用图标
│   ├── favicon.png               # 应用图标
│   └── favicon.svg               # 应用图标
├── dist/                        # 前端构建产物
├── dist-electron/               # Electron 构建产物
├── docs/                        # 文档目录
├── .env                         # 环境变量
├── .gitignore                   # Git 忽略配置
├── package.json                 # 项目配置
├── tsconfig.json                # TypeScript 配置
├── vite.config.ts               # Vite 配置
├── tailwind.config.js           # TailwindCSS 配置
├── postcss.config.js            # PostCSS 配置
└── README.md                    # 项目说明文档
```

## 📖 可用命令

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm build` | 构建前端生产版本 |
| `pnpm lint` | ESLint 代码检查 |
| `pnpm lint --fix` | ESLint 自动修复 |
| `pnpm preview` | 预览构建结果 |
| `pnpm electron:dev` | 启动 Electron 开发模式 |
| `pnpm electron:build` | 构建 Electron 安装包 |

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
    "win": {
      "target": ["nsis"],
      "icon": "public/favicon.png"
    }
  }
}
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

## 📝 更新日志

### v1.0.0
- 初始版本发布
- 实现快速启动功能
- 实现热点新闻功能
- 实现网址导航功能
- 实现工具箱功能（25+ 工具）
- 实现管理控制台功能
- 实现系统设置功能
- 支持深色/浅色主题切换

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 📧 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。

---

**Built with ❤️ using Electron + React + TypeScript**