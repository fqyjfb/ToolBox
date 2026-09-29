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
