// notesFavoritesService —— 收藏持久化：复用 notesService 的 settings（notes_settings.json），值为绝对路径 string[]。

const notesService = require('./notesService.cjs');

const FAVORITES_KEY = 'notes_favorites';

// 规整为 string[]：过滤空串与重复，保持顺序
function normalize(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function getFavorites() {
  try {
    const raw = notesService.getSetting(FAVORITES_KEY);
    return { success: true, favorites: normalize(raw) };
  } catch (error) {
    return {
      success: false,
      favorites: [],
      error: error instanceof Error ? error.message : '读取收藏失败',
    };
  }
}

function setFavorites(favorites) {
  try {
    const normalized = normalize(favorites);
    const ok = notesService.saveSetting(FAVORITES_KEY, normalized);
    if (!ok) {
      return { success: false, favorites: [], error: '保存收藏失败' };
    }
    return { success: true, favorites: normalized };
  } catch (error) {
    return {
      success: false,
      favorites: [],
      error: error instanceof Error ? error.message : '保存收藏失败',
    };
  }
}

// 切换收藏：存在则移除，不存在则置顶插入；返回最新列表便于渲染层一次性 setState。
function toggleFavorite(absolutePath) {
  if (!absolutePath || typeof absolutePath !== 'string') {
    return { success: false, favorites: [], toggled: false, error: '无效的文件路径' };
  }
  try {
    const current = normalize(notesService.getSetting(FAVORITES_KEY));
    const idx = current.indexOf(absolutePath);
    let next;
    let toggled;
    if (idx >= 0) {
      next = current.slice();
      next.splice(idx, 1);
      toggled = false;
    } else {
      // 新收藏置顶（最新常用优先，符合 U8 设计预期）
      next = [absolutePath, ...current];
      toggled = true;
    }
    const ok = notesService.saveSetting(FAVORITES_KEY, next);
    if (!ok) {
      return { success: false, favorites: current, toggled: false, error: '保存收藏失败' };
    }
    return { success: true, favorites: next, toggled };
  } catch (error) {
    return {
      success: false,
      favorites: [],
      toggled: false,
      error: error instanceof Error ? error.message : '切换收藏失败',
    };
  }
}

module.exports = {
  getFavorites,
  setFavorites,
  toggleFavorite,
  FAVORITES_KEY,
  normalize,
};
