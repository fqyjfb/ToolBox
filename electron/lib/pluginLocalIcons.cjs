// 自动生成的插件本地图标清单（主进程用）- 请勿手动修改
// 由 scripts/generate-icon-data.cjs 扫描 public/plugins/icons 生成

const LOCAL_PLUGIN_ICON_DIRS = new Set([
  "agnes-ai-plugin",
  "calendar-diary-plugin",
  "clipboard-manager-plugin",
  "color-palette-plugin",
  "conversion-plugin",
  "favorite-plugin",
  "file-manager-plugin",
  "image-change-plugin",
  "one-email-plugin",
  "orc-plugin",
  "s3-disk-plugin",
  "screenshot-plugin"
]);

// iconUrl 尾部的 /icons/{目录名}/{文件名}
const ICON_DIR_IN_URL = /\/icons\/([^/]+)\/[^/]+$/;

// 该插件是否已有随包分发的本地图标
const hasLocalPluginIcon = (id, iconUrl) => {
  const key = (iconUrl ? ICON_DIR_IN_URL.exec(iconUrl)?.[1] : undefined) || id;
  return !!key && LOCAL_PLUGIN_ICON_DIRS.has(key);
};

module.exports = { hasLocalPluginIcon };
