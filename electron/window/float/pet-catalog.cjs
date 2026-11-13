/* 悬浮球形象与换装清单（唯一数据源）
   主进程 require 后用于构建右键菜单、校验与持久化迁移；
   悬浮窗通过 <script> 加载，读取同一份几何与装扮片段。
   新增装扮只需在 items 中追加一条，无需改 CSS 与菜单代码。
   约定：片段内颜色一律用 CSS 类（见 float-pet.css 的绘制令牌区），禁止行内 color/fill 样式。 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.PetCatalog = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 形象外框：与 .float-ball / 命中判定 / viewBox 共用，改这里即全局生效
  var GEOMETRY = { width: 66, height: 90, hitPadding: 4, viewBox: '0 0 66 90' };

  // 槽位按 z 从小到大绘制；allowEmpty 为 false 的槽位必须有装扮
  var SLOTS = [
    { id: 'tail', label: '尾部', z: 1, allowEmpty: false },
    { id: 'body', label: '躯干', z: 2, allowEmpty: true },
    { id: 'neck', label: '颈部', z: 3, allowEmpty: true },
    { id: 'head', label: '头部', z: 4, allowEmpty: true }
  ];

  var DEFAULTS = { tail: 'tape', body: '', neck: '', head: '' };

  var ITEMS = [
    {
      id: 'tape',
      slot: 'tail',
      label: '卷尺尾',
      phrase: '量一量，今天想做点什么？',
      swatch: '#FFF3E3',
      svg: [
        '<g class="pet-tail" data-anim="sway" data-amp="sm" data-origin="bottom">',
        '<path class="pet-stroke-shade" d="M55.6,56 C59.2,56.2 60.4,52 60.6,48 C60.7,43 60.8,40 60.8,37.6" fill="none" stroke-width="6.4" stroke-linecap="round"/>',
        '<path class="pet-stroke-cream" d="M55.6,56 C59.2,56.2 60.4,52 60.6,48 C60.7,43 60.8,40 60.8,37.6" fill="none" stroke-width="4.2" stroke-linecap="round"/>',
        '<g class="pet-stroke-ink" stroke-width=".9" stroke-linecap="round" opacity=".3">',
        '<path d="M58.8,52.2 L62.4,51.8"/>',
        '<path d="M58.8,48 L62.5,47.6"/>',
        '<path d="M58.9,43.6 L62.5,43.2"/>',
        '<path d="M58.8,40.1 L62.3,39.7"/>',
        '</g>',
        '<g class="tape-tip">',
        '<rect class="pet-fill-ink" x="58.7" y="33.2" width="4.4" height="4.6" rx="1.3"/>',
        '<path class="pet-stroke-cream" d="M59.8,33.9 L59.8,37" fill="none" stroke-width="1" stroke-linecap="round"/>',
        '</g>',
        '</g>'
      ].join('')
    },
    {
      id: 'plush',
      slot: 'tail',
      label: '毛绒尾',
      phrase: '尾巴软软的，摸一下嘛～',
      swatch: '#F2913F',
      svg: [
        '<g class="pet-tail" data-anim="sway" data-amp="md" data-origin="bottom">',
        '<path class="pet-fill-shade" d="M49,71 C58,73.4 64.4,68.4 64.2,62 C64,57 59.6,56.4 57,60.4 C54.6,64 52.6,68 49,71Z"/>',
        '<path class="pet-fill-base" d="M52,68.4 C57,69.4 60.4,65.8 59.8,62 C59.4,59.4 57,59.6 56,62.4 C55,65.4 54,67 52,68.4Z"/>',
        '<circle class="pet-fill-cream" cx="59.6" cy="62.4" r="2" opacity=".85"/>',
        '</g>'
      ].join('')
    },
    {
      id: 'beret',
      slot: 'head',
      label: '匠帽',
      phrase: '戴上它，今天也稳稳当当。',
      swatch: '#C9551C',
      svg: [
        '<g class="pet-head-item" data-anim="sway" data-amp="sm" data-speed="slow" data-origin="bottom">',
        '<path class="pet-fill-base" d="M10.6,25.6 C9.4,17.4 18.4,11.4 33,11.4 C47.6,11.4 56.6,17.4 55.4,25.6 C55,27.6 52.6,28.2 49.8,28.2 L16.2,28.2 C13.4,28.2 11,27.6 10.6,25.6Z"/>',
        '<path class="pet-fill-light" d="M17,19.4 C21,15.4 27,13.4 33,13.4 C39,13.4 45,15.4 49,19.4 C43.6,16.8 38.4,15.8 33,15.8 C27.6,15.8 22.4,16.8 17,19.4Z" opacity=".7"/>',
        '<path class="pet-fill-shade" d="M11.6,25.8 C14.6,28 24,29.2 33,29.2 C42,29.2 51.4,28 54.4,25.8 C54.2,27.8 52,28.6 49.4,28.6 L16.6,28.6 C14,28.6 11.8,27.8 11.6,25.8Z"/>',
        '<circle class="pet-fill-cream" cx="45.6" cy="13.8" r="2.4"/>',
        '</g>'
      ].join('')
    },
    {
      id: 'ears',
      slot: 'head',
      label: '猫耳',
      phrase: '喵～摸摸耳朵会呼噜哦！',
      swatch: '#FF9AA8',
      svg: [
        '<g class="pet-head-item" data-anim="sway" data-amp="sm" data-origin="bottom">',
        '<path class="pet-fill-base" d="M14.6,26 C13.4,17.4 18.6,9.4 21.6,9.2 C25,9 27.6,16.4 27,23.6Z"/>',
        '<path class="pet-fill-cheek" d="M18.2,22 C17.2,16.4 19.2,12 21.4,11.8 C23.6,11.6 25,15.2 24.6,19.4Z" opacity=".8"/>',
        '<path class="pet-fill-base" d="M51.4,26 C52.6,17.4 47.4,9.4 44.4,9.2 C41,9 38.4,16.4 39,23.6Z"/>',
        '<path class="pet-fill-cheek" d="M47.8,22 C48.8,16.4 46.8,12 44.6,11.8 C42.4,11.6 41,15.2 41.4,19.4Z" opacity=".8"/>',
        '</g>'
      ].join('')
    },
    {
      id: 'scarf',
      slot: 'neck',
      label: '围巾',
      phrase: '围巾是莓果味的，暖暖的～',
      swatch: '#C2456B',
      svg: [
        '<g class="pet-neck-item" data-anim="sway" data-amp="sm" data-speed="slow" data-origin="top">',
        '<path class="pet-fill-accent" d="M12,61.4 C15,59.2 21,58.4 33,58.4 C45,58.4 51,59.2 54,61.4 C55.2,63.4 54.4,65.8 52,66.4 C46,67.8 20,67.8 14,66.4 C11.6,65.8 10.8,63.4 12,61.4Z"/>',
        '<path class="pet-stroke-cream" d="M15.4,62.6 L50.2,63.4" fill="none" stroke-width="1" stroke-linecap="round" opacity=".45"/>',
        '<path class="pet-fill-accent2" d="M46,66 C50.4,68 51.4,71.6 49.4,73.8 C47.4,72 45.4,69.4 44.8,66.6Z"/>',
        '<path class="pet-fill-accent2" d="M42,66.2 C45,69 45.4,71.8 43.6,73.8 C41.8,72 40.8,69.6 40.6,66.6Z"/>',
        '</g>'
      ].join('')
    },
    {
      id: 'lanyard',
      slot: 'neck',
      label: '工牌',
      phrase: '工牌在手，随时上岗。',
      swatch: '#2B1B12',
      svg: [
        '<g class="pet-neck-item" data-anim="bob" data-amp="sm" data-speed="slow" data-origin="top">',
        '<path class="pet-stroke-accent" d="M24,57.4 C25.6,61.4 27.6,63.4 30,64.4" fill="none" stroke-width="1.6" stroke-linecap="round"/>',
        '<path class="pet-stroke-accent" d="M42,57.4 C40.4,61.4 38.4,63.4 36,64.4" fill="none" stroke-width="1.6" stroke-linecap="round"/>',
        '<rect class="pet-fill-cream" x="27.4" y="63.4" width="11.2" height="8.6" rx="2"/>',
        '<rect class="pet-fill-base" x="29.4" y="65.4" width="7.2" height="1.6" rx=".8"/>',
        '<rect class="pet-fill-shade" x="29.4" y="68.2" width="4.6" height="1.4" rx=".7"/>',
        '</g>'
      ].join('')
    },
    {
      id: 'vest',
      slot: 'body',
      label: '马甲',
      phrase: '工具都在兜里，要哪个？',
      swatch: '#C9551C',
      svg: [
        '<g class="pet-body-item">',
        '<path class="pet-fill-shade" d="M13.6,57.8 C18,55.2 25.5,54 33,54 C40.5,54 48,55.2 52.4,57.8 L52,69.6 C47.6,72 40,72.8 33,72.8 C26,72.8 18.4,72 14,69.6Z" opacity=".95"/>',
        '<path class="pet-stroke-cream" d="M33,54 L33,72.4" fill="none" stroke-width="1.1" opacity=".4"/>',
        '<rect class="pet-fill-cream" x="17.8" y="62.2" width="7" height="5.4" rx="1.2" opacity=".8"/>',
        '<rect class="pet-fill-cream" x="41.2" y="62.2" width="7" height="5.4" rx="1.2" opacity=".8"/>',
        '</g>'
      ].join('')
    },
    {
      id: 'apron',
      slot: 'body',
      label: '围裙',
      phrase: '干活前先系好围裙。',
      swatch: '#FFF3E3',
      svg: [
        '<g class="pet-body-item">',
        '<path class="pet-fill-cream" d="M24,53.8 C27,53.2 30,53 33,53 C36,53 39,53.2 42,53.8 L45.2,71.6 C40,72.6 36,73 33,73 C30,73 26,72.6 20.8,71.6Z" opacity=".95"/>',
        '<path class="pet-stroke-shade" d="M27.4,53.4 L25.4,58.6 M38.6,53.4 L40.6,58.6" fill="none" stroke-width="1.2" stroke-linecap="round" opacity=".4"/>',
        '<rect class="pet-stroke-shade" x="27.8" y="63.6" width="10.4" height="6" rx="1.6" fill="none" stroke-width="1" opacity=".35"/>',
        '</g>'
      ].join('')
    }
  ];

  // 一键整套：outfit 与单项完全同构，套用走同一函数
  var PRESETS = [
    { id: 'default', label: '出厂设置', outfit: { tail: 'tape', body: '', neck: '', head: '' }, phrase: '回到最轻松的样子。' },
    { id: 'craft', label: '修复模式', outfit: { tail: 'tape', body: 'vest', neck: 'lanyard', head: 'beret' }, phrase: '工具备齐，开工！' },
    { id: 'winter', label: '冬日值守', outfit: { tail: 'plush', body: '', neck: 'scarf', head: 'ears' }, phrase: '冬天也要暖暖的。' }
  ];

  var itemById = {};
  var slotById = {};
  ITEMS.forEach(function (item) { itemById[item.id] = item; });
  SLOTS.forEach(function (slot) { slotById[slot.id] = slot; });

  // 旧版本单选形象 → 新槽位组合，供设置迁移使用
  var LEGACY_MAP = {
    ears: { head: 'ears' },
    hat: { head: 'beret' },
    scarf: { neck: 'scarf' }
  };

  var fromLegacyAppearance = function (name) {
    return LEGACY_MAP[name] || {};
  };

  var normalizeOutfit = function (input) {
    var next = { tail: DEFAULTS.tail, body: DEFAULTS.body, neck: DEFAULTS.neck, head: DEFAULTS.head };
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      SLOTS.forEach(function (slot) {
        var candidate = input[slot.id];
        var item = typeof candidate === 'string' ? itemById[candidate] : null;
        if (item && item.slot === slot.id) {
          next[slot.id] = item.id;
        } else if (!slot.allowEmpty) {
          next[slot.id] = DEFAULTS[slot.id];
        }
      });
    }
    return next;
  };

  var itemsForSlot = function (slotId) {
    var slot = slotById[slotId];
    if (!slot) return [];
    var list = ITEMS.filter(function (item) { return item.slot === slotId; });
    return slot.allowEmpty ? [{ id: '', slot: slotId, label: '无', phrase: '' }].concat(list) : list;
  };

  var isSameOutfit = function (a, b) {
    var left = normalizeOutfit(a);
    var right = normalizeOutfit(b);
    return SLOTS.every(function (slot) { return left[slot.id] === right[slot.id]; });
  };

  var getItem = function (id) {
    return itemById[id] || null;
  };

  return {
    version: 1,
    geometry: GEOMETRY,
    slots: SLOTS,
    items: ITEMS,
    defaults: DEFAULTS,
    presets: PRESETS,
    normalizeOutfit: normalizeOutfit,
    fromLegacyAppearance: fromLegacyAppearance,
    itemsForSlot: itemsForSlot,
    isSameOutfit: isSameOutfit,
    getItem: getItem
  };
});
