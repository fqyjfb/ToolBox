# 贡献指南

欢迎贡献代码！请遵循以下步骤和规范。

## 📋 贡献流程

1. **Fork 本仓库**
2. **创建特性分支**：
   ```bash
   git checkout -b feature/your-feature
   # 或
   git checkout -b fix/your-bug-fix
   ```
3. **提交更改**：
   ```bash
   git commit -m 'feat: Add some feature'
   # 或
   git commit -m 'fix: Fix some bug'
   ```
4. **推送到分支**：
   ```bash
   git push origin feature/your-feature
   ```
5. **创建 Pull Request**

## 📝 代码规范

### 代码检查
- 使用 ESLint 进行代码检查
- 遵循 TypeScript 严格模式
- 使用 Prettier 格式化代码

### 命名规范
- **类名**：大驼峰（PascalCase）
- **方法名**：小驼峰（camelCase）
- **变量名**：小写下划线（snake_case）
- **常量**：全大写下划线（UPPER_CASE）

### 设计规范
- 遵循项目的设计系统规范
- 使用 CSS 变量而非硬编码值
- 组件样式使用 Tailwind CSS

### 代码质量
- 方法 ≤ 30 行
- 类 ≤ 500 行
- 圈复杂度 < 10

## 🔧 开发环境

### 环境要求
- Node.js >= 18.x
- pnpm >= 8.x（推荐）
- Git
- Python >= 3.8（OCR 功能需要）

### 安装依赖
```bash
pnpm install
```

### 开发模式
```bash
pnpm dev          # 启动前端开发服务器
pnpm electron:dev # 启动 Electron
```

## 🧪 测试

### 运行测试
```bash
pnpm test
```

### 测试规范
- 新增功能需要添加单元测试
- 修复 Bug 需要添加回归测试
- 测试覆盖率应 ≥ 80%

## 📦 构建

### 构建生产版本
```bash
pnpm build
pnpm electron:build
```

### 构建要求
- 确保构建无错误
- 确保构建无警告（除已知警告外）

## 📄 文档

### 文档规范
- 更新 README.md（如果涉及功能变更）
- 更新 CHANGELOG.md（每次版本发布）
- 新增功能需要添加使用说明

## 💬 沟通

### Issue 规范
- 使用清晰的标题描述问题
- 提供复现步骤
- 附上截图或日志（如果适用）

### Pull Request 规范
- 标题清晰描述变更内容
- 描述变更的原因和影响
- 关联相关的 Issue

---

感谢你的贡献！🎉
