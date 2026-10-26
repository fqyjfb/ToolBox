const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// 悬浮窗功能图标的统一规格（与 src/utils/floatIconRenderer.tsx 保持一致）
const FLOAT_ICON_COLOR = '#00A2FF';
const FLOAT_ICON_SIZE = 24;

// 旧版自定义图标名 → lucide 图标名：仅用于迁移历史配置，新配置不再产生这些名称
const LEGACY_ICON_NAMES = {
  Date: 'CalendarDays',
  Delete: 'Trash2',
  Remind: 'BellRing',
  Download: 'Download',
  Tool: 'Wrench',
  Member: 'Users',
  Info: 'Info',
  Edit: 'Pencil',
  View: 'Eye',
  Todo: 'ListTodo',
  Upload: 'Upload',
  Coin: 'Coins',
  Image: 'Image',
  List: 'List',
  Chart: 'BarChart3',
  Star: 'Star',
  File: 'File',
  Task: 'CircleCheck',
  Report: 'FileBarChart2',
  Home: 'Home',
  User: 'User',
  Client: 'Contact',
  Location: 'MapPin',
  Architecture: 'Network',
  Check: 'Check',
  Zap: 'Zap',
  Flame: 'Flame',
  Scan: 'ScanLine',
  Print: 'Printer',
  Heart: 'Heart',
  Search: 'Search',
  Clock: 'Clock',
  Mail: 'Mail',
  Phone: 'Phone',
  Computer: 'Monitor',
};

// 从常量源码中提取「目标 → lucide 图标名」条目
const parseActionTargets = (source, blockName) => {
  const blockMatch = source.match(new RegExp(`${blockName}[\\s\\S]*?= \\[([\\s\\S]*?)\\];`));
  if (!blockMatch) {
    console.error(`无法找到 ${blockName}`);
    process.exit(1);
  }
  return [...blockMatch[1].matchAll(/\{ action: '([^']+)', label: '[^']*', icon: (\w+) \}/g)]
    .map(([, action, iconName]) => ({ action, iconName }));
};

// 工具定义按行书写，逐条提取 id 与 iconName
const parseToolTargets = (source) =>
  source.split('\n')
    .map(line => {
      const match = line.match(/id: '([^']+)'/);
      const icon = line.match(/iconName: '([^']+)'/);
      return match && icon ? { action: match[1], iconName: icon[1] } : null;
    })
    .filter(Boolean);

// 插件本地图标目录（public/plugins/icons/{图标目录名}/icon.*）
// 构建期扫描一次，运行期就能直接查表：省掉对每个插件的本地文件探测请求，
// 也避免图标缺失时对每个插件都白等一次网络往返
const LOCAL_ICON_ROOT = path.join(__dirname, '../public/plugins/icons');
const LOCAL_ICON_FILE = /^icon\.(png|jpe?g|svg|webp)$/i;

// 图标目录名（screenshot-plugin）与插件 id（plugin-screenshot）命名规则不一致，
// 两边唯一可靠的对应关系是 iconUrl 尾部的 /icons/{目录名}/{文件名}
const ICON_DIR_IN_URL_SOURCE = String.raw`/\/icons\/([^/]+)\/[^/]+$/`;

const writeLocalIconData = () => {
  // { 图标目录名: 相对路径 }；相对路径可同时适配桌面端 file:// 与 Web 端子路径部署
  const localIcons = {};

  const dirs = fs.existsSync(LOCAL_ICON_ROOT)
    ? fs.readdirSync(LOCAL_ICON_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];

  for (const dir of dirs) {
    const file = fs.readdirSync(path.join(LOCAL_ICON_ROOT, dir)).find((name) => LOCAL_ICON_FILE.test(name));
    if (file) localIcons[dir] = `plugins/icons/${dir}/${file}`;
  }

  const tsContent = `// 自动生成的插件本地图标清单 - 请勿手动修改
// 由 scripts/generate-icon-data.cjs 扫描 public/plugins/icons 生成

// 已有本地图标的插件：图标目录名 → 图标相对路径
const LOCAL_PLUGIN_ICONS: Record<string, string> = ${JSON.stringify(localIcons, null, 2)};

// iconUrl 尾部的 /icons/{目录名}/{文件名}
const ICON_DIR_IN_URL = ${ICON_DIR_IN_URL_SOURCE};

// 取插件的本地图标路径；没有本地图标时返回 undefined，由调用方回退到网络图标缓存。
// 插件 id 与图标目录名命名规则不一致（plugin-screenshot ↔ screenshot-plugin），
// 只能以 iconUrl 中的目录名为准；id 仅用于没有 iconUrl 的插件兜底。
const getLocalPluginIcon = (id?: string, iconUrl?: string): string | undefined => {
  const key = (iconUrl ? ICON_DIR_IN_URL.exec(iconUrl)?.[1] : undefined) ?? id;
  return key ? LOCAL_PLUGIN_ICONS[key] : undefined;
};

export { LOCAL_PLUGIN_ICONS, getLocalPluginIcon };
`;

  const tsPath = path.join(__dirname, '../src/generated/pluginLocalIcons.ts');
  fs.mkdirSync(path.dirname(tsPath), { recursive: true });
  fs.writeFileSync(tsPath, tsContent);
  console.log(`✓ 已生成 src/generated/pluginLocalIcons.ts（${Object.keys(localIcons).length} 个本地插件图标）`);

  // 主进程同样要判断「该插件有没有本地图标」：有就不必再联网预取远程图标，
  // 否则「插件图标缓存」会一直统计着一批永远不会被显示的图标
  const cjsContent = `// 自动生成的插件本地图标清单（主进程用）- 请勿手动修改
// 由 scripts/generate-icon-data.cjs 扫描 public/plugins/icons 生成

const LOCAL_PLUGIN_ICON_DIRS = new Set(${JSON.stringify(Object.keys(localIcons), null, 2)});

// iconUrl 尾部的 /icons/{目录名}/{文件名}
const ICON_DIR_IN_URL = ${ICON_DIR_IN_URL_SOURCE};

// 该插件是否已有随包分发的本地图标
const hasLocalPluginIcon = (id, iconUrl) => {
  const key = (iconUrl ? ICON_DIR_IN_URL.exec(iconUrl)?.[1] : undefined) || id;
  return !!key && LOCAL_PLUGIN_ICON_DIRS.has(key);
};

module.exports = { hasLocalPluginIcon };
`;

  const cjsPath = path.join(__dirname, '../electron/lib/pluginLocalIcons.cjs');
  fs.writeFileSync(cjsPath, cjsContent);
};

const buildDataUri = (lucide, iconName) => {
  const Icon = lucide[iconName] || lucide.Package;
  if (!lucide[iconName]) {
    console.warn(`图标 ${iconName} 不存在，已回退 Package`);
  }
  const svgMarkup = renderToStaticMarkup(
    React.createElement(Icon, {
      width: FLOAT_ICON_SIZE,
      height: FLOAT_ICON_SIZE,
      style: { color: FLOAT_ICON_COLOR }
    })
  );
  return `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`;
};

(async () => {
  const lucide = await import('lucide-react');
  const settingsSource = fs.readFileSync(
    path.join(__dirname, '../src/constants/settings.ts'), 'utf-8'
  );
  const toolsSource = fs.readFileSync(
    path.join(__dirname, '../src/constants/tools.ts'), 'utf-8'
  );

  // 键为 `${type}:${action}`，与 config.cjs 解析时使用的键一致
  const targetIcons = {};
  parseActionTargets(settingsSource, 'NAV_ACTIONS').forEach(({ action, iconName }) => {
    targetIcons[`nav:${action}`] = buildDataUri(lucide, iconName);
  });
  parseActionTargets(settingsSource, 'SYSTEM_ACTIONS').forEach(({ action, iconName }) => {
    targetIcons[`system:${action}`] = buildDataUri(lucide, iconName);
  });
  parseToolTargets(toolsSource).forEach(({ action, iconName }) => {
    targetIcons[`tool:${action}`] = buildDataUri(lucide, iconName);
  });

  const legacyIcons = {};
  Object.entries(LEGACY_ICON_NAMES).forEach(([legacyName, iconName]) => {
    legacyIcons[legacyName] = buildDataUri(lucide, iconName);
  });

  writeLocalIconData();

  const jsContent = `// 自动生成的悬浮窗图标数据 - 请勿手动修改
// 由 scripts/generate-icon-data.cjs 依据设置常量与工具定义生成

const TARGET_ICONS = ${JSON.stringify(targetIcons, null, 2)};

const LEGACY_ICONS = ${JSON.stringify(legacyIcons, null, 2)};

// 按类型与目标取功能原有图标
const getTargetIconData = (type, action) => TARGET_ICONS[\`\${type}:\${action}\`] || '';

// 取旧版自定义图标名对应的迁移图标
const getLegacyIconData = (name) => LEGACY_ICONS[name] || '';

module.exports = { getTargetIconData, getLegacyIconData };
`;

  fs.writeFileSync(path.join(__dirname, '../electron/lib/icon-data.cjs'), jsContent);
  console.log(`✓ 已生成 electron/lib/icon-data.cjs（${Object.keys(targetIcons).length} 个目标图标，${Object.keys(legacyIcons).length} 个兼容图标）`);
})();
