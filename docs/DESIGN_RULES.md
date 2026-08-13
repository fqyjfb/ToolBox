# 功能拓展设计规范

本文档规定了向 ToolBox 项目添加新功能或新工具时必须遵循的设计规则和开发流程。

---

## 📋 目录

- [总体原则](#-总体原则)
- [新功能分类](#-新功能分类)
- [工具注册流程](#-工具注册流程)
- [组件开发规范](#-组件开发规范)
- [状态管理规范](#-状态管理规范)
- [服务层开发规范](#-服务层开发规范)
- [类型定义规范](#-类型定义规范)
- [路由配置规范](#-路由配置规范)
- [Electron IPC 集成规范](#-electron-ipc-集成规范)
- [样式规范](#-样式规范)
- [代码质量要求](#-代码质量要求)
- [安全规范](#-安全规范)
- [测试要求](#-测试要求)
- [完整开发流程示例](#-完整开发流程示例)

---

## 🎯 总体原则

### 设计哲学

- **渐进式复杂度**：新功能应从最小可行方案开始，避免过度设计
- **一致性优先**：新组件/功能必须与现有代码风格和架构保持一致
- **可维护性**：代码应易于理解和修改，遵循 KISS 原则
- **可测试性**：新功能应支持单元测试，避免过度耦合

### 新增功能评估清单

在开始开发前，确认以下问题：

- [ ] 该功能是否已有类似实现（避免重复开发）？
- [ ] 是否需要数据存储（本地/云端）？
- [ ] 是否需要 Electron 主进程支持？
- [ ] 是否需要权限控制（普通用户/管理员）？
- [ ] 是否适用于多端（桌面/Web/移动端）？

---

## 🗂️ 新功能分类

根据功能特性，新功能分为以下几类：

| 分类 | 描述 | 典型位置 | 示例 |
|------|------|----------|------|
| **工具页** | 独立功能页面，通过工具中心访问 | `src/pages/tools/` | JSON 格式化、待办事项 |
| **桌面组件** | 桌面端专属功能（快启动、浮动窗口） | `src/pages/desktop/` | 快启动、桌面主页 |
| **管理功能** | 管理员后台功能 | `src/pages/admin/` | 用户管理、数据统计 |
| **共享页面** | 跨端通用页面（设置、登录） | `src/pages/shared/` | 系统设置、用户登录 |
| **通用组件** | 可复用的 UI 组件 | `src/components/` | 表单、弹窗、表格 |

---

## 🛠️ 工具注册流程

### 步骤 1：定义工具元数据

在 `src/constants/tools.ts` 中添加新工具信息：

```typescript
export interface ToolInfo {
  id: string;           // 唯一标识，小写 kebab-case
  name: string;         // 显示名称
  path: string;         // 路由路径，格式 /tools/{id}
  color: string;        // 主题色，HEX 格式
  iconName: string;     // 图标名称，对应 iconMap 中的键
  category?: string;    // 分类（可选，如 '效率工具'、'开发工具'）
}
```

**命名规则**：
- `id`：全小写，使用连字符分隔（如 `json-formatter`）
- `name`：中文显示名称，简洁明了
- `path`：与 `id` 一致，格式 `/tools/{id}`
- `color`：从项目色彩系统选择，避免使用渐变或霓虹色
- `iconName`：使用 Lucide React 图标集，确保图标已注册

**添加位置**：在 `ALL_TOOLS` 数组的对应分类区域末尾添加。

### 步骤 2：注册图标映射

在 `src/utils/iconMap.ts` 中确保图标已映射：

```typescript
import { CheckSquare, FileJson } from 'lucide-react';

export const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  CheckSquare,
  FileJson,
  // ... 确保新工具的 iconName 在此映射中存在
};
```

### 步骤 3：创建工具页面

在 `src/pages/tools/` 下创建目录和页面组件：

```
src/pages/tools/
└── new-tool/
    ├── index.tsx           # 页面主入口（必须）
    ├── NewToolForm.tsx     # 表单组件（可选）
    ├── NewToolModal.tsx    # 弹窗组件（可选）
    ├── useNewToolOperations.ts  # 业务逻辑 Hook（推荐）
    └── types.ts            # 页面专用类型（可选）
```

### 步骤 4：注册路由

在 `src/config/routes.tsx` 中配置路由：

```typescript
// 1. 顶部导入组件
const NewToolPage = React.lazy(() => import('../pages/tools/new-tool'));

// 2. 添加到对应的路由集合
// 需要登录的工具：添加到 protectedRoutes
// 无需登录的工具：添加到 publicRoutes
// 仅桌面端的工具：添加到 desktopRoutes
{
  path: '/tools/new-tool',
  element: <NewToolPage />,
  requiresAuth: true,  // 根据需求设置
}
```

### 步骤 5：验证注册

- 在工具中心页面应能看到新工具
- 点击新工具图标应能正确导航到对应页面
- 检查控制台无警告或错误

---

## 🧩 组件开发规范

### 页面组件结构

每个工具页面应遵循以下结构：

```typescript
import React, { useState } from 'react';
import { useToastStore } from '@/store/toastStore';

interface NewToolPageProps {
  // 页面级 props（如有）
}

const NewToolPage: React.FC<NewToolPageProps> = () => {
  // 1. 状态管理
  const addToast = useToastStore((state) => state.addToast);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DataType | null>(null);

  // 2. 事件处理
  const handleAction = async () => {
    try {
      setLoading(true);
      // 业务逻辑
      addToast({ message: '操作成功', type: 'success' });
    } catch (error) {
      addToast({ message: '操作失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 3. 渲染
  return (
    <div className="h-full flex flex-col p-4">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">工具标题</h1>
      </header>
      <main className="flex-1">
        {/* 页面主体内容 */}
      </main>
    </div>
  );
};

export default NewToolPage;
```

### 组件命名规范

| 类型 | 命名模式 | 示例 |
|------|----------|------|
| 页面入口 | `index.tsx` | `src/pages/tools/todo/index.tsx` |
| 表单组件 | `{功能}Form.tsx` | `TodoForm.tsx` |
| 弹窗组件 | `{功能}Modal.tsx` | `TodoModal.tsx` |
| 列表组件 | `{功能}List.tsx` | `TodoList.tsx` |
| 业务 Hook | `use{功能}Operations.ts` | `useTodoOperations.ts` |
| 工具函数 | `{功能}Helper.ts` | `jsonFormatterHelper.ts` |

### 组件复杂度限制

- **单个组件文件**：≤ 300 行
- **单个函数**：≤ 30 行
- **Props 数量**：≤ 8 个，超过时考虑拆分为子组件
- **状态变量**：≤ 10 个，超过时考虑状态管理优化

### 通用组件使用规范

优先使用项目已有的通用组件（位于 `src/components/ui/`）：

```typescript
// 导入路径统一使用 @/ 别名
import Modal from '@/components/ui/Modal';
import Toast from '@/components/ui/Toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import Tooltip from '@/components/ui/Tooltip';
import ToggleSwitch from '@/components/settings/ToggleSwitch';
import ContextMenu from '@/components/ui/ContextMenu';
```

**不重复造轮子**：在创建新组件前，先检查 `src/components/` 是否已有类似组件。

---

## 🗃️ 状态管理规范

### Store 分类

| Store | 用途 | 持久化 |
|-------|------|--------|
| `authStore` | 用户认证状态 | 是（persist 中间件） |
| `themeStore` | 主题切换 | 是 |
| `sidebarStore` | 侧边栏/导航状态 | 是 |
| `toastStore` | 通知消息 | 否 |
| `syncStore` | 数据同步状态 | 否 |
| `storageStore` | 存储模式状态 | 是 |
| `pluginStore` | 插件商店状态 | 是（installedPlugins） |

### 创建新 Store

当新功能需要跨组件共享状态时，创建独立 Store：

```typescript
// src/store/newFeatureStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NewFeatureState {
  data: string[];
  loading: boolean;
  error: string | null;
  // Actions
  fetchData: () => Promise<void>;
  addItem: (item: string) => void;
  clearData: () => void;
}

export const useNewFeatureStore = create<NewFeatureState>()(
  persist(
    (set, get) => ({
      data: [],
      loading: false,
      error: null,
      fetchData: async () => {
        set({ loading: true, error: null });
        try {
          const result = await /* API 调用 */;
          set({ data: result, loading: false });
        } catch (err) {
          set({ error: err.message, loading: false });
        }
      },
      addItem: (item) => set({ data: [...get().data, item] }),
      clearData: () => set({ data: [] }),
    }),
    {
      name: 'new-feature-storage',  // localStorage key
    }
  )
);
```

### Store 使用规范

```typescript
import { useShallow } from 'zustand/shallow';

// ✅ 推荐：单字段直接选择器订阅
const addToast = useToastStore((state) => state.addToast);
const isDark = useThemeStore((s) => s.isDark);

// ✅ 推荐：多字段使用 useShallow 避免不必要的重渲染
const { isDark, toggleTheme } = useThemeStore(
  useShallow((s) => ({ isDark: s.isDark, toggleTheme: s.toggleTheme }))
);

// ❌ 避免：全量订阅整个 store
const { isDark, toggleTheme } = useThemeStore();
const allState = useToastStore();
```

### 何时不使用 Store

以下情况直接使用组件内部状态（useState）：
- 状态仅在当前组件内使用
- 状态生命周期与组件一致
- 无需跨组件共享或持久化

---

## 🔌 服务层开发规范

### 服务层架构

```
src/services/
├── entities/baseEntityService.ts # 实体基类（含搜索）
├── dataAccessLayer.ts          # 数据访问层（本地/云端切换）
├── supabase.ts                 # Supabase 客户端初始化
├── localStorageService.ts      # 本地存储工具
└── {Feature}Service.ts         # 具体业务服务
```

### 继承 BaseEntityService

当新功能需要 CRUD 操作时，继承 `BaseEntityService`（位于 `src/services/entities/baseEntityService.ts`）：

```typescript
// src/services/NewFeatureService.ts
import { BaseEntityService } from './entities/baseEntityService';
import { NewFeature } from '@/types/newFeature';

export class NewFeatureService extends BaseEntityService<NewFeature> {
  constructor() {
    super('new_features', 'NewFeatureService', ['title', 'description']);
  }

  // 可覆盖基类方法或添加特定业务逻辑
  async createFeature(userId: string, data: CreateFeatureData) {
    return this.create(userId, data);
  }
}
```

### 数据访问层使用

通过 `getDataAccessLayer` 获取统一的数据访问接口：

```typescript
import { getDataAccessLayer } from './dataAccessLayer';

const userId = useAuthStore((state) => state.user?.id);
const dal = getDataAccessLayer(userId);

// 通用 CRUD
const items = await dal.list<NewFeature>('new_features');
const item = await dal.get<NewFeature>('new_features', id);
await dal.create('new_features', data);
await dal.update('new_features', id, updates);
await dal.delete('new_features', id);
```

### ServiceResponse 格式

所有服务方法返回统一格式：

```typescript
interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## 📝 类型定义规范

### 类型文件组织

```
src/types/
├── common.ts           # 公共基础类型（BaseEntity, ServiceResponse）
├── auth.ts             # 认证相关类型
├── settings.ts         # 设置相关类型
├── {feature}.ts        # 功能专用类型
```

### 实体类型定义

所有需要持久化的实体必须继承 `BaseEntity`：

```typescript
// src/types/newFeature.ts
import { BaseEntity } from './common';

export interface NewFeature extends BaseEntity {
  title: string;
  description: string;
  status: 'active' | 'inactive';
}

export interface CreateNewFeatureData {
  title: string;
  description: string;
  status?: 'active' | 'inactive';
}

export interface UpdateNewFeatureData {
  title?: string;
  description?: string;
  status?: 'active' | 'inactive';
}
```

### TypeScript 严格模式

```typescript
// ✅ 使用明确的返回类型
const fetchData = async (): Promise<DataItem[]> => { /* ... */ };

// ✅ 使用 non-null assertion 仅当确定值非空
const userId = useAuthStore((state) => state.user!.id);

// ❌ 避免使用 any
const data: any = await fetch();  // 禁止
```

---

## 🛣️ 路由配置规范

### 路由文件位置

所有路由配置集中在 `src/config/routes.tsx`。

### 路由分类

| 路由集合 | 访问条件 | 用途 |
|----------|----------|------|
| `publicRoutes` | 无需登录 | 公开工具、登录页 |
| `protectedRoutes` | 需要登录 | 需要身份认证的工具 |
| `desktopRoutes` | 桌面端 + 登录 | 桌面端专属工具 |
| `adminRoutes` | 管理员 | 后台管理功能 |

### 路由配置格式

```typescript
interface RouteConfig {
  path: string;
  element: React.ReactNode;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
}
```

### 路由配置示例

```typescript
const NewToolPage = React.lazy(() => import('@/pages/tools/new-tool'));

// 需要登录的私有工具
const protectedRoutes: RouteConfig[] = [
  // ... 现有路由
  {
    path: '/tools/new-tool',
    element: <NewToolPage />,
    requiresAuth: true,
  },
];

// 公开工具
const publicRoutes: RouteConfig[] = [
  // ... 现有路由
  {
    path: '/tools/public-tool',
    element: <PublicToolPage />,
  },
];
```

### 懒加载

所有路由组件必须使用 `React.lazy` 进行懒加载：

```typescript
// ✅ 正确
const ToolPage = React.lazy(() => import('@/pages/tools/tool'));

// ❌ 错误
import ToolPage from '@/pages/tools/tool';
```

---

## 🖥️ Electron IPC 集成规范

### 何时需要 IPC

- 需要文件系统操作（读写、选择文件）
- 需要调用系统 API（剪贴板、通知）
- 需要与 Python 服务通信（OCR 等）
- 需要窗口控制（最小化、最大化、关闭）

### Preload 接口定义

在 `electron/preload.cjs` 中暴露 API：

```javascript
contextBridge.exposeInMainWorld('newFeature', {
  // 方法调用
  doAction: (data) => ipcRenderer.invoke('newFeature:action', data),
  
  // 事件监听
  onProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('newFeature:progress', subscription);
    return () => ipcRenderer.removeListener('newFeature:progress', subscription);
  },
});
```

### 主进程处理

在 `electron/ipc/` 下创建对应处理逻辑（统一使用 `.cjs` 扩展名，文件名以 `Ipc` 结尾）：

```javascript
// electron/ipc/newFeatureIpc.cjs
const { ipcMain } = require('electron');

let registered = false;
function registerNewFeatureIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle('newFeature:action', async (event, data) => {
    // 处理业务逻辑
    return result;
  });
}

module.exports = { registerNewFeatureIpc };
```

### TypeScript 类型声明

在 `src/vite-env.d.ts` 中声明窗口类型：

```typescript
interface ElectronAPI {
  newFeature: {
    doAction: (data: ActionData) => Promise<ActionResult>;
    onProgress: (callback: (data: ProgressData) => void) => () => void;
  };
}

interface Window {
  electron: ElectronAPI;
}
```

### IPC 命名规范

- 通道名使用 `camelCase`，格式 `{模块}:{操作}`
- 模块名与操作名均为 camelCase
- 示例：`fileManager:listFiles`、`log:addLog`、`sqlite:init`

---

## 🎨 样式规范

### 设计令牌使用

所有样式值必须使用设计令牌（CSS 变量），禁止硬编码：

```css
/* ✅ 使用设计令牌 */
.new-feature {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  padding: var(--space-4);
  border-radius: var(--radius-md);
}

/* ❌ 硬编码 */
.new-feature {
  background: #ffffff;
  padding: 16px;
}
```

### 字体尺寸

| 变量 | 大小 | 用途 |
|------|------|------|
| `--text-xs` | 12px | 辅助文字、标签 |
| `--text-sm` | 14px | 正文 |
| `--text-base` | 16px | 正文（默认） |
| `--text-lg` | 20px | 小标题 |
| `--text-xl` | 24px | 标题 |
| `--text-2xl` | 32px | 大标题 |

### 间距系统

| 变量 | 大小 | 用途 |
|------|------|------|
| `--space-1` | 4px | 微间距 |
| `--space-2` | 8px | 小间距 |
| `--space-3` | 12px | 中等间距 |
| `--space-4` | 16px | 标准间距 |
| `--space-5` | 24px | 大间距 |
| `--space-6` | 32px | 超大间距 |
| `--space-7` | 48px | 区块间距 |
| `--space-8` | 64px | 页面间距 |

### Tailwind 类名使用

项目已在 `tailwind.config.js` 中将 CSS 变量映射为 Tailwind 颜色类，优先使用主题类名而非硬编码颜色：

```typescript
// ✅ 页面容器
<div className="h-full flex flex-col p-4">

// ✅ 卡片（边框或阴影二选一，圆角 ≤ 8px）
<div className="border border-border rounded-md p-4">

// ✅ 主按钮（使用项目主题色，禁止硬编码 blue/gray）
<button className="px-4 py-2 bg-primary text-button-text rounded-md hover:bg-primary-hover">

// ✅ 次按钮（描边/幽灵式）
<button className="px-4 py-2 border border-border rounded-md hover:bg-bg-secondary">

// ✅ 主题适配（使用主题类名自动支持深色模式）
<div className="bg-bg-primary text-text-primary">
```

### 暗色模式适配

新功能必须支持暗色模式切换。项目通过 `theme.css` 中 `:root` 与 `.dark` 两套 CSS 变量自动切换，优先使用主题类名（已在 `tailwind.config.js` 映射），无需手写 `dark:` 前缀：

```typescript
// ✅ 推荐：使用主题类名（自动适配深色模式）
<div className="bg-bg-primary text-text-primary">

// ✅ 备选：直接使用 CSS 变量
<div className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">

// ❌ 避免：硬编码颜色 + dark: 前缀
<div className="bg-white dark:bg-gray-900">
```

---

## ✅ 代码质量要求

### 静态检查

提交代码前必须通过以下检查：

```bash
# ESLint 检查
pnpm lint

# TypeScript 类型检查
npx tsc --noEmit
```

### 代码整洁要求

- [ ] 无未使用的 import 语句
- [ ] 无注释掉的代码
- [ ] 无重复代码块（≥ 5 行）
- [ ] 无 console.log 调试语句（除非有明确的 TODO 标记）
- [ ] 无魔法数字（使用常量或设计令牌替代）

### 复杂度限制

| 指标 | 限制 | 工具 |
|------|------|------|
| 方法行数 | ≤ 30 行 | 手动检查 |
| 类/组件行数 | ≤ 500 行 | 手动检查 |
| 圈复杂度 | < 10 | ESLint |
| Props 数量 | ≤ 8 个 | 手动检查 |

### 命名规范

| 元素 | 规范 | 示例 |
|------|------|------|
| 组件/类名 | PascalCase | `TodoList` |
| 函数/方法名 | camelCase | `handleClick` |
| 变量名 | camelCase | `userList` |
| 常量 | UPPER_SNAKE_CASE | `MAX_ITEMS` |
| 组件文件名 | PascalCase | `TodoFormModal.tsx`、`Modal.tsx` |
| 服务/Hook/工具文件名 | camelCase | `baseService.ts`、`useDndSensors.ts`、`iconMap.ts` |
| 页面入口文件名 | 固定 `index.tsx` | `src/pages/tools/todo/index.tsx` |
| 路由 ID | kebab-case | `new-tool` |

---

## 🛡️ 安全规范

### 数据加密

涉及敏感数据的功能必须使用项目加密工具：

```typescript
import { encrypt, decrypt } from '@/utils/crypto';

// encrypt/decrypt 均为异步函数，返回 Promise<string>
const encryptedData = await encrypt(sensitiveData);
const decryptedData = await decrypt(encryptedData);
```

### 输入验证

所有用户输入必须验证（项目当前采用手动验证，如需引入 schema 校验可考虑 zod）：

```typescript
// ✅ 手动验证（项目当前方式）
const validateInput = (data: unknown): data is CreateItemData => {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.title === 'string' && obj.title.trim().length > 0 && obj.title.length <= 100;
};

// ❌ 直接使用未验证的输入
const data = await save(userInput);  // 不安全
```

### IPC 安全

- 所有 IPC 通道必须进行输入验证
- 不要信任渲染进程传来的任何数据
- 敏感操作需要权限检查

```javascript
// electron/ipc/newFeatureIpc.cjs
ipcMain.handle('newFeature:action', async (event, data) => {
  // 验证输入
  if (!isValidInput(data)) {
    throw new Error('Invalid input');
  }

  // 权限检查
  if (!hasPermission(event)) {
    throw new Error('Permission denied');
  }

  // 执行业务逻辑
  return result;
});
```

---

## 🧪 测试要求

> **当前状态**：项目暂未配置测试框架（v2.3.9 已移除 Vitest/Testing Library 依赖），以下为引入测试时建议遵循的规范。

### 测试分类

| 测试类型 | 覆盖范围 | 推荐工具 |
|----------|----------|------|
| 单元测试 | 工具函数、Hook | Vitest |
| 组件测试 | 组件渲染、交互 | Vitest + Testing Library |
| 集成测试 | API 调用、状态管理 | Vitest |
| E2E 测试 | 完整用户流程 | Playwright（可选） |

### 测试文件命名

```
src/
├── utils/
│   └── helper.test.ts
├── hooks/
│   └── useData.test.ts
└── components/
    └── Modal.test.tsx
```

### 测试覆盖率要求（引入测试后）

- 工具函数：≥ 80%
- 业务 Hook：≥ 70%
- 组件：≥ 60%（关键交互路径）

---

## 📖 完整开发流程示例

### 场景：添加"计数器"工具

#### 第 1 步：规划

- 功能描述：简单的数字计数器，支持加、减、重置
- 数据存储：需要（使用 localStorage）
- Electron 依赖：不需要
- 权限要求：需要登录

#### 第 2 步：定义类型

```typescript
// src/types/counter.ts
export interface CounterData {
  id: string;
  name: string;
  value: number;
}
```

#### 第 3 步：创建工具元数据

```typescript
// src/constants/tools.ts
{
  id: 'counter',
  name: '计数器',
  path: '/tools/counter',
  color: '#10b981',
  iconName: 'Counter',
}
```

#### 第 4 步：注册图标

```typescript
// src/utils/iconMap.ts
import { Counter } from 'lucide-react';

export const iconMap = {
  // ... 现有图标
  Counter,
};
```

#### 第 5 步：创建页面组件

```typescript
// src/pages/tools/counter/index.tsx
import React, { useState } from 'react';
import { useToastStore } from '@/store/toastStore';

const CounterPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount((c) => c + 1);
    addToast({ message: '计数 +1', type: 'success' });
  };

  const decrement = () => {
    setCount((c) => c - 1);
    addToast({ message: '计数 -1', type: 'info' });
  };

  const reset = () => {
    setCount(0);
    addToast({ message: '已重置', type: 'warning' });
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <h1 className="text-xl font-semibold mb-4">计数器</h1>
      <div className="text-4xl font-bold mb-8">{count}</div>
      <div className="flex gap-4">
        <button onClick={decrement} className="px-4 py-2 border border-border rounded-md hover:bg-bg-secondary">
          -1
        </button>
        <button onClick={reset} className="px-4 py-2 border border-border rounded-md hover:bg-bg-secondary">
          重置
        </button>
        <button onClick={increment} className="px-4 py-2 bg-primary text-button-text rounded-md hover:bg-primary-hover">
          +1
        </button>
      </div>
    </div>
  );
};

export default CounterPage;
```

#### 第 6 步：注册路由

```typescript
// src/config/routes.tsx
const CounterPage = React.lazy(() => import('@/pages/tools/counter'));

const protectedRoutes: RouteConfig[] = [
  // ... 现有路由
  {
    path: '/tools/counter',
    element: <CounterPage />,
    requiresAuth: true,
  },
];
```

#### 第 7 步：验证

- 运行 `pnpm dev` 启动开发服务器
- 在工具中心查找"计数器"
- 测试所有功能是否正常
- 检查暗色模式是否正常
- 检查移动端适配

#### 第 8 步：代码审查

- [ ] 通过 ESLint 检查
- [ ] 通过 TypeScript 类型检查
- [ ] 无未使用的 import
- [ ] 遵循命名规范
- [ ] 遵循代码复杂度限制
- [ ] 支持暗色模式
- [ ] 遵循设计令牌

---

## 📚 参考文档

| 文档 | 说明 |
|------|------|
| [配置说明](CONFIGURATION.md) | 环境变量和项目配置 |
| [贡献指南](CONTRIBUTING.md) | 代码贡献流程和规范 |
| [更新日志](CHANGELOG.md) | 版本变更记录 |

---

*本文档随项目发展持续更新，如有疑问请参考项目源码或联系维护者。*