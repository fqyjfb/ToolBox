# Tasks：Kubai 图标统一（含悬浮球同步）

## T1 导航 → 网站导航
- [x] `src/constants/tools.ts` L18：name 改为 `网站导航`
- [x] `src/utils/homeTools.ts` L35：默认项 name 改为 `网站导航`
- [x] `src/utils/homeTools.ts` `normalizeHomeTools`：`navigation` 名称归一为 `网站导航`
- [x] `src/utils/kubaiIconMap.ts`：`navigation` 映射改为 `书签`

## T2 管理控制台卡片
- [x] `src/pages/admin/index.tsx`：移除 `Globe/Users/Wrench/Database` 引入
- [x] 引入 `KubaiIcon`，4 张卡片替换为 `地球/用户/包裹/图表`，size 26，颜色对应卡片底色

## T3 悬浮窗设置 + 悬浮球统一
- [x] `src/assets/kubai-icons/engine.js`：`mountIcon(icon, i, host, color)` 增加可选 color
- [x] 新建 `src/utils/kubaiIconData.ts`：`kubaiIconToDataUrl`、`syncToolFloatIcon`
- [x] `src/utils/floatIconRenderer.tsx`：`type === 'tool'` 分支改走 kubai data URI
- [x] `src/pages/shared/Settings.tsx` `loadFloatConfig`：迁移并静默回写变化项
- [x] 新建 `src/components/ui/FloatConfigIcon.tsx`
- [x] `src/components/settings/FloatWindowTab.tsx`：径向按钮改用 `FloatConfigIcon`，工具项底色跟随 `config.color`
- [x] `src/components/settings/FloatConfigEditor.tsx`：顶部圆与图标框改用 `FloatConfigIcon`；删除无用 `FloatIconView`、`iconMap` 引入
- [x] 顺带简化 `KubaiIcon`：挂载时直接传入颜色，去掉挂载后重绘逻辑

## T4 验证
- [x] `npx tsc --noEmit` 零错误
- [x] `npx vite build` 生产构建通过（Settings chunk 正常产出）
- [x] 浏览器验证工具中心：存在「网站导航」卡片，图标为含 linearGradient 的 kubai SVG，控制台无报错
- [x] jsdom 校验静态导出：书签/地球/用户/包裹/图表 5 个图标序列化后 XML 解析零错误，含渐变与遮罩，data URI 4–7KB
- [ ] 管控台 `/admin` 视觉验证：被重定向到 `#/login`，无管理员凭证，无法进入（代码经 tsc + 构建校验）
- [ ] 悬浮窗设置视觉验证：`/settings` 仅注册在 desktopRoutes，浏览器为 web 布局无法进入，需在 Electron 中人工确认
- [x] Web 页面控制台无 JS 报错
