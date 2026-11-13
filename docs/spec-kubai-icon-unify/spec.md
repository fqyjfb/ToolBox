# Spec：Kubai 图标统一（网站导航改名 / 管控台 / 悬浮窗设置 + 悬浮球）

Status: 待批准（已补充「悬浮球同步」）
Project: `j:\ShopTools\workspace\react-electron\Toolbox-hub\ToolBox`

## 1. 目标

1. 工具中心「导航」卡片更名为「网站导航」，并换成对应语义的 kubai 图标。
2. 管理控制台首页 4 张卡片由 lucide 图标换成 kubai 动态图标。
3. 悬浮窗设置页中，工具类型配置项统一使用工具中心的 kubai 图标，**并让实际悬浮球菜单同步显示同一图标**；明暗主题下均清晰。

约束：不产生运行错误、不残留死代码、不引入重复实现。

## 2. 需求 1：导航 → 网站导航

| 文件                          | 位置                   | 修改                                                                                                             |
| --------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/constants/tools.ts`    | L18                  | `name: '导航'` → `'网站导航'`                                                                                        |
| `src/utils/homeTools.ts`    | L35                  | 默认首页工具 `name: '导航'` → `'网站导航'`                                                                                 |
| `src/utils/homeTools.ts`    | `normalizeHomeTools` | 名称归一：`name: id === 'navigation' ? '网站导航' : (typeof tool.name === 'string' && tool.name ? tool.name : tool.id)` |
| `src/utils/kubaiIconMap.ts` | L12                  | `'navigation': '定位'` → `'书签'`                                                                                  |

说明：

* 侧边栏固定项与工具中心卡片均从 `ALL_TOOLS` 取 name，改常量即同步；路由 `/nav`、id、颜色不变。
* 老用户 localStorage 中已持久化的「导航」靠 `normalizeHomeTools` 归一为「网站导航」，避免首页与工具中心不一致。
* 图标选 `书签`：语义即网址导航/收藏，且不被其他工具占用（`地球` 已被在线翻译、IP 查询、Sitemap 三项使用，不复用）。

## 3. 需求 2：管理控制台卡片

文件：`src/pages/admin/index.tsx`

* 删除 `lucide-react` 的 `Globe, Users, Wrench, Database` 引入；引入 `KubaiIcon`。
* 替换 `.icon-wrapper` 内图标（尺寸 26，与工具中心一致）：

| 卡片   | 背景变量（theme.css）        | kubai 名 | color     |
| ---- | ---------------------- | ------- | --------- |
| 网址管理 | `--color-admin-button` | `地球`    | `#dda36c` |
| 用户管理 | `--color-admin-2`      | `用户`    | `#67aaf7` |
| 工具管理 | `--color-admin-3`      | `包裹`    | `#bc8acf` |
| 数据管理 | `--color-admin-6`      | `图表`    | `#e91e63` |

```tsx
<div className="icon-wrapper">
  <KubaiIcon name="地球" color="#dda36c" size={26} />
</div>
```

主题适配：卡片底色来自主题变量（明暗两套值一致）；kubai 自带色阶、不依赖 `currentColor`，`theme.css` 的 `.admin-card svg { color:#fff }` 对其无副作用，保留不动；`.icon-wrapper` 36×36 容纳 26px 图标，无需改 CSS。

## 4. 需求 3：悬浮窗设置 + 悬浮球图标统一

### 4.1 原理

悬浮球在 Electron 主进程用纯 HTML + `<img src>` 渲染（`electron/window/float/float.cjs` L38-63），只接受 data URI。因此统一方案分两层：

1. **设置页预览**：直接用 `KubaiIcon` 渲染（可悬停形变）。
2. **悬浮球菜单**：把 kubai 图标在渲染进程内序列化成静态 SVG data URI 写入 `config.icon`，主进程原样走 `<img>` 分支，无需改主进程与构建脚本。

### 4.2 引擎小幅扩展（`src/assets/kubai-icons/engine.js`）

`mountIcon` 增加可选第 4 个参数 `color`，让初始渲染就带上实例色，免去挂载后再重绘：

```js
function mountIcon(icon, i, host, color) {
  ...
  const inst = {
    icon, i, E, tints, clips,
    whites: [...], pures: [...], shadow: ...,
    s: {}, raf: 0, painted: '', hover: 0,
    color            // 新增：实例级颜色，targetOf 已优先读取
  };
  ...
}
```

`targetOf` 现有 `inst.color` 分支已支持，无需改动。

### 4.3 新增静态导出工具（`src/utils/kubaiIconData.ts`）

```ts
import { mountIcon, BY_NAME, SVG_NS } from '../assets/kubai-icons';

/**
 * 把 kubai 图标渲染成静态 SVG data URI。
 * 供悬浮球（主进程 <img>）使用，保证与设置页预览、工具中心卡片同一图标。
 */
export const kubaiIconToDataUrl = (name: string, color?: string): string => {
  const icon = BY_NAME[name] || Object.values(BY_NAME)[0];
  if (!icon) return '';
  const host = document.createElement('div');
  mountIcon(icon, 0, host, color);
  const svg = host.querySelector('svg');
  if (!svg) return '';
  // 内联序列化不会补 xmlns，data URI 作为独立图片必须有
  svg.setAttribute('xmlns', SVG_NS);
  return `data:image/svg+xml,${encodeURIComponent(svg.outerHTML)}`;
};
```

自带 `filter`、`linearGradient`、`mask` 均在 SVG 内部，作为独立图片可正常渲染；每个图标一个 `<img>` 文档，id 不会互相冲突。

### 4.4 统一取图标入口（`src/utils/floatIconRenderer.tsx`）

把 `type === 'tool'` 分支改为 kubai 静态 data URI，其余类型保持 lucide：

```ts
import { kubaiIconToDataUrl } from './kubaiIconData';
import { TOOL_KUBAI_MAP, FALLBACK_ICON } from './kubaiIconMap';

if (type === 'tool') {
  const tool = ALL_TOOLS.find(item => item.id === action) || ALL_TOOLS[0];
  return kubaiIconToDataUrl(TOOL_KUBAI_MAP[tool.id] || FALLBACK_ICON, tool.color);
}
```

`getTargetIcon('tool', ...)` 是 `handleTypeChange` 与 `handleToolSelect` 的唯一图标来源，改这一处即可覆盖：

* 新选工具：立即得到 kubai data URI，保存后悬浮球同步；
* 类型切到「工具」：默认图标也是 kubai。

### 4.5 老配置迁移（`src/pages/shared/Settings.tsx`）

`loadFloatConfig` 中把已有的工具类型配置补齐/刷新为 kubai 图标，并在确有变化时静默回写一次，使悬浮球立即同步：

```ts
const config = await window.electron.getFloatConfig();
const synced = config.map(syncToolFloatIcon);
setFloatConfig(synced);
if (synced.some((item, i) => item.icon !== config[i].icon)) {
  void window.electron.updateFloatConfig(synced);
}
```

`syncToolFloatIcon` 放在 `src/utils/kubaiIconData.ts`：

```ts
export const syncToolFloatIcon = (config: FloatConfigItem): FloatConfigItem => {
  if (config.type !== 'tool') return config;
  const tool = ALL_TOOLS.find(item => item.id === config.action);
  const icon = kubaiIconToDataUrl(
    TOOL_KUBAI_MAP[config.action] || FALLBACK_ICON,
    config.color || tool?.color,
  );
  return icon && icon !== config.icon ? { ...config, icon } : config;
};
```

生成结果确定（同图标同色同输出），未变化时不写盘；仅 Web 端无 `window.electron` 时跳过。

### 4.6 设置页渲染统一（避免重复）

新增 `src/components/ui/FloatConfigIcon.tsx`：

```tsx
const FloatConfigIcon = ({ config, size = 20, className }) =>
  config.type === 'tool'
    ? <KubaiIcon name={TOOL_KUBAI_MAP[config.action] || FALLBACK_ICON} color={config.color} size={size} className={className} />
    : <FloatIconView icon={config.icon} path={config.path} isPlugin={config.type === 'plugin'} name={config.name} size={size} className={className} />;
```

替换 3 处：

* `FloatWindowTab.tsx` 径向预览圆按钮；
* `FloatConfigEditor.tsx` 顶部标题圆；
* `FloatConfigEditor.tsx` 底部「图标」预览框。

同时删除两文件中不再使用的 `FloatIconView` 直接引入；`FloatConfigEditor` 删除已无用的 `iconMap` 引入（`handleToolSelect` 改走 `getTargetIcon`）。

主题适配：

* 设置页工具项圆按钮底色由 `var(--color-primary)` 改为 `config.color`（与工具中心卡片一致），明暗主题都稳定；
* 悬浮球菜单项底色本身是 `--float-menu-bg`（亮 `#FFFFFF` / 暗 `#262A33`），kubai 浅色主体 + 彩色带在两种底色下均可读，CSS 无需改。

## 5. 明确非目标

* 不改 `electron/lib/config.cjs`、`electron/lib/icon-data.cjs`、`scripts/generate-icon-data.cjs`。
* nav / system / ai 类型悬浮项保持 lucide 图标（设置页与悬浮球原本就一致，本次不动）。
* 不新增 kubai 图标条目，不改色彩规范与展示页。

## 6. 验证

1. `npx tsc --noEmit` 零错误；无未使用 import。
2. `pnpm dev` 后逐页核对：
   * `/#/tools`：出现「网站导航」，kubai 书签图标可悬停形变；其余卡片不回归。
   * `/#/`：首页同名同图标；旧 localStorage 中 `navigation` 名称被归一。
   * `/admin`：4 张卡片 kubai 图标、颜色协调、悬停有形变。
3. 悬浮窗设置：
   * 现有 7 个导航项不变；
   * 切到「工具」并选工具后，径向预览/标题圆/图标框均为 kubai；
   * 浏览器控制台执行 `await import('/src/utils/kubaiIconData.ts')` 生成 data URI 并塞进 `img.src`，确认 `img.onload` 触发（验证静态 SVG 可独立渲染）；
   * 保存后重启/打开悬浮球，菜单对应项显示同一 kubai 图标；切换明暗主题图标清晰。
4. 控制台无 JS 报错；工具网格、首页、侧边栏无回归。
