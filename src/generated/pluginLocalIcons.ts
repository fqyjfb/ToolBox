// 自动生成的插件本地图标清单 - 请勿手动修改
// 由 scripts/generate-icon-data.cjs 扫描 public/plugins/icons 生成

// 已有本地图标的插件：图标目录名 → 图标相对路径
const LOCAL_PLUGIN_ICONS: Record<string, string> = {
  "agnes-ai-plugin": "plugins/icons/agnes-ai-plugin/icon.png",
  "calendar-diary-plugin": "plugins/icons/calendar-diary-plugin/icon.png",
  "clipboard-manager-plugin": "plugins/icons/clipboard-manager-plugin/icon.png",
  "color-palette-plugin": "plugins/icons/color-palette-plugin/icon.png",
  "conversion-plugin": "plugins/icons/conversion-plugin/icon.png",
  "favorite-plugin": "plugins/icons/favorite-plugin/icon.png",
  "file-manager-plugin": "plugins/icons/file-manager-plugin/icon.png",
  "image-change-plugin": "plugins/icons/image-change-plugin/icon.png",
  "one-email-plugin": "plugins/icons/one-email-plugin/icon.png",
  "orc-plugin": "plugins/icons/orc-plugin/icon.png",
  "s3-disk-plugin": "plugins/icons/s3-disk-plugin/icon.png",
  "screenshot-plugin": "plugins/icons/screenshot-plugin/icon.png"
};

// iconUrl 尾部的 /icons/{目录名}/{文件名}
const ICON_DIR_IN_URL = /\/icons\/([^/]+)\/[^/]+$/;

// 取插件的本地图标路径；没有本地图标时返回 undefined，由调用方回退到网络图标缓存。
// 插件 id 与图标目录名命名规则不一致（plugin-screenshot ↔ screenshot-plugin），
// 只能以 iconUrl 中的目录名为准；id 仅用于没有 iconUrl 的插件兜底。
const getLocalPluginIcon = (id?: string, iconUrl?: string): string | undefined => {
  const key = (iconUrl ? ICON_DIR_IN_URL.exec(iconUrl)?.[1] : undefined) ?? id;
  return key ? LOCAL_PLUGIN_ICONS[key] : undefined;
};

export { LOCAL_PLUGIN_ICONS, getLocalPluginIcon };
