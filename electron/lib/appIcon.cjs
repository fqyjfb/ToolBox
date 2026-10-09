// 应用图标统一解析入口：所有 BrowserWindow 的 icon 都从这里取，避免各处各写一份路径探测。
//
// 打包后必须取 app.asar 之外的真实文件：窗口 icon 由 Chromium 的图片解码器按文件路径读取，
// 指向 asar 内部时读不到，窗口会静默退回 Electron 默认图标 ——
// 这正是「打包安装后任务栏/子窗口显示 Electron 默认图标」的原因。
// 因此 package.json 的 build.asarUnpack 配了 public/favicon.ico，解包后落在
//   <安装目录>/resources/app.asar.unpacked/public/favicon.ico
//
// 图标由 scripts/generate-app-icon.cjs 从 favicon.png 生成（16~256 七档）。

const fs = require('fs');
const path = require('path');

let resolved = false;
let iconPath = null;
let iconImage = null;

function candidates() {
  // electron/lib 下，向上两级即项目根
  const devRoot = path.join(__dirname, '../..');
  const { app } = require('electron');

  if (!app.isPackaged) {
    return [
      path.join(devRoot, 'public', 'favicon.ico'),
      path.join(devRoot, 'public', 'favicon.png')
    ];
  }

  const res = process.resourcesPath;
  return [
    // asarUnpack 解包出的真实文件，native 层可读（优先）
    path.join(res, 'app.asar.unpacked', 'public', 'favicon.ico'),
    path.join(res, 'app.asar.unpacked', 'public', 'favicon.png'),
    // 未走 asar（或 extraResources）时的位置
    path.join(res, 'public', 'favicon.ico'),
    path.join(res, 'public', 'favicon.png'),
    // asar 内兜底：native 层未必读得到，至少 JS 侧能拿到
    path.join(res, 'app', 'public', 'favicon.ico'),
    path.join(res, 'app', 'public', 'favicon.png')
  ];
}

// 返回图标文件绝对路径；找不到返回 null（窗口会退回 Electron 默认图标）
function getAppIconPath() {
  if (resolved) return iconPath;
  resolved = true;
  for (const p of candidates()) {
    if (fs.existsSync(p)) {
      iconPath = p;
      break;
    }
  }
  return iconPath;
}

// 返回 nativeImage；加载失败返回 null，由调用方决定是否设置 icon
function getAppIcon() {
  if (iconImage) return iconImage;
  const p = getAppIconPath();
  if (!p) return null;

  const { nativeImage } = require('electron');
  const image = nativeImage.createFromPath(p);
  if (image.isEmpty()) return null;
  iconImage = image;
  return image;
}

module.exports = { getAppIconPath, getAppIcon };
