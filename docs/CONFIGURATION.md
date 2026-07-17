# 配置说明

## 📝 环境变量配置

### 创建 .env 文件

在项目根目录创建 `.env` 文件：

```env
# Supabase 配置
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# 加密密钥（必须配置）
VITE_ENCRYPTION_KEY=your-32-character-encryption-key
```

### 配置项说明

| 配置项 | 说明 | 是否必需 |
|--------|------|----------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL | 是（云端模式） |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | 是（云端模式） |
| `VITE_ENCRYPTION_KEY` | 数据加密密钥（32 字符） | 是 |

## 🔧 存储配置

### 存储模式

应用支持两种存储模式：

1. **本地模式**：数据存储在本地 IndexedDB
2. **云端模式**：数据存储在 Supabase，同时同步到本地

### 切换存储模式

在系统设置页面可以切换存储模式：
- 默认模式：云端模式
- 切换后自动同步数据

## ⚙️ 自动锁定配置

### 锁定时间设置

支持以下锁定时间选项：
- 5 分钟
- 10 分钟
- 15 分钟
- 30 分钟
- 1 小时

### 锁定功能说明

- 使用 Ctrl+L 快捷键锁定/解锁应用
- 自动锁定：当系统空闲时间达到设定值时自动锁定
- 锁定后需要输入密码才能解锁

## 📁 项目结构

```
ToolBox/
├── electron/           # Electron 主进程
│   ├── window/         # 窗口管理（主窗口、浮动窗口、锁定窗口、托盘）
│   ├── services/       # 后端服务（笔记服务、Python 进程服务）
│   ├── ipc/            # IPC 通信（文件管理、OCR）
│   ├── lib/            # 工具库（配置、图标数据、快捷键管理）
│   ├── logs/           # 日志服务
│   ├── main.cjs        # 主入口文件
│   └── preload.cjs     # 预加载脚本
├── public/             # 静态资源
├── src/                # 前端源码
│   ├── components/     # 通用组件
│   ├── pages/          # 页面组件
│   ├── services/       # 服务层
│   ├── store/          # 状态管理
│   ├── hooks/          # 自定义 Hooks
│   ├── types/          # TypeScript 类型定义
│   ├── utils/          # 工具函数
│   ├── config/         # 配置文件（路由、常量）
│   └── styles/         # 全局样式
├── scripts/            # 脚本工具
└── docs/               # 文档
```

### 配置文件

| 文件 | 说明 |
|------|------|
| `package.json` | 项目配置和依赖 |
| `vite.config.ts` | Vite 构建配置 |
| `tailwind.config.js` | Tailwind CSS 配置 |
| `tsconfig.json` | TypeScript 配置 |
| `eslint.config.mjs` | ESLint 配置 |

## 🛡️ 安全配置

### 加密设置

- 使用 AES-CBC 算法加密敏感数据
- 加密格式：`iv:encryptedData`（base64 编码）
- 密钥长度：32 字符（256 位）

### 密码安全

- 锁定密码使用 bcrypt 哈希存储
- 支持大小写字母、数字和特殊字符
- 建议使用 8 位以上密码

---

更多配置说明请参考项目源码中的配置文件。