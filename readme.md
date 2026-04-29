# ToolBox

一个基于 Electron + React + TypeScript 构建的现代化桌面工具应用，集成多种实用工具和服务，为用户提供一站式的效率提升解决方案。

## ✨ 功能特性

### 🚀 快速启动
- 快速访问常用应用程序和快捷方式
- 支持应用分类管理和自定义排序
- 智能搜索功能，快速定位应用
- 支持拖拽调整应用顺序

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

### 🛠️ 工具箱

#### 实用工具
- **汇率换算** - 实时汇率查询和多币种换算
- **翻译工具** - 多语言互译服务
- **云剪贴板** - 跨设备剪贴板同步
- **快捷回复** - 预设回复模板管理
- **待办事项** - 任务管理和提醒功能
- **账号管理** - 密码和账号安全存储
- **国家区号查询** - 全球国家区号查询

#### 文本处理
- **大小写转换** - 文本大小写快速转换
- **CSV/JSON 互转** - 数据格式转换工具
- **Emoji 移除** - 批量移除文本中的表情符号
- **文本去重** - 移除重复文本内容
- **HTML 转文本** - 提取 HTML 中的纯文本
- **Markdown 工具** - Markdown 转文本/微信格式

#### 开发工具
- **Hash 生成** - MD5/SHA 等哈希值计算
- **Hex 编解码** - 十六进制编码解码
- **JSON 格式化** - 格式化和美化 JSON
- **URL 编解码** - URL 编码和解码
- **URL 解析** - 解析 URL 参数
- **正则测试** - 正则表达式在线测试
- **SQL 压缩** - SQL 语句压缩工具
- **Meta 标签生成** - HTML Meta 标签生成器
- **站点地图生成** - 生成网站 sitemap

#### 时间工具
- **时间戳转换** - Unix 时间戳转换工具

#### 网络工具
- **IP 信息查询** - 获取 IP 地址详细信息
- **二维码生成** - 生成自定义二维码

#### 生活服务
- **天气查询** - 获取实时天气信息

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
- 数据备份与恢复

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
| 二维码生成 | qrcode | 1.5.x |
| 图表生成 | html2canvas / jspdf | - |

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

## 🔐 安全特性

- 用户数据加密存储
- 安全的身份认证机制
- HTTPS 通信支持
- 敏感信息脱敏处理

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