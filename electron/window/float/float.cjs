const floatBall = document.getElementById('floatBall');

let isExpanded = false;
let isDragging = false;
let moved = false;
let floatConfig = [];
let collapseTimer = null;
let dragPendingFrame = false;
function getTooltipContainer() {
  return document.getElementById('tooltipContainer');
}

function getIconByName(name, item) {
  if (!name) return '';
  
  // Use pre-cached icon data URL (base64) if available
  if (item && item.iconDataUrl) {
    return '<img src="' + item.iconDataUrl + '" class="app-icon plugin-icon" />';
  }
  
  // Handle plugin icon type
  // 图标已由主进程落盘为本地缓存并转成 iconDataUrl（见上方分支）；走到这里说明本地
  // 也没有图标，直接显示兜底文字，不再回退远程地址（国内网络下会破图）
  if (name.startsWith('plugin:')) {
    return '<span class="plugin-fallback-icon">插件</span>';
  }
  
  if (name.startsWith('data:image/')) {
    return '<img src="' + name + '" class="app-icon" />';
  }
  
  if (name.length > 100 && !name.includes(' ')) {
    return '<img src="data:image/png;base64,' + name + '" class="app-icon" />';
  }
  
  // 图标已由主进程统一解析为上述可识别形式，其余情况回退首字符兜底
  return '';
}

// 菜单项常驻 DOM：只切 .expanded 才会触发 float.css 里的 transform/opacity/visibility 过渡。
// 若每次展开都重建节点，元素首帧就是终态，浏览器无从计算过渡起点，飞散动画会消失。
const escapeHtml = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function renderFloatBall() {
  const tooltipContainer = getTooltipContainer();
  if (floatConfig.length === 0) {
    tooltipContainer.innerHTML = '<div class="tooltip-item"><span style="color: var(--float-fallback-text); font-size: 12px;">暂无配置</span></div>';
  } else {
    const itemsHTML = floatConfig.map((item, index) => {
      const iconHTML = getIconByName(item.icon, item);
      const name = escapeHtml(item.name);
      const body = iconHTML || '<span style="color: var(--float-fallback-text);">' + escapeHtml(item.name.charAt(0)) + '</span>';
      // 名称仅用自定义 .tooltip-label 展示，不再加原生 title，避免悬浮时出现两个提示
      return '<div class="tooltip-item" data-index="' + index + '">' + body + '<span class="tooltip-label">' + name + '</span></div>';
    }).join('');
    tooltipContainer.innerHTML = itemsHTML;
  }
  positionTooltipItems();
  attachItemEvents();
  applyExpandedClass();
}

function positionTooltipItems() {
  const tooltipContainer = getTooltipContainer();
  const items = tooltipContainer.querySelectorAll('.tooltip-item');
  items.forEach((item, index) => {
    const angle = (index * 360 / items.length) - 90;
    // 半径需让菜单项完全避开中间的桌宠形象（66x90）
    const radius = 78;
    const x = Math.cos((angle * Math.PI) / 180) * radius;
    const y = Math.sin((angle * Math.PI) / 180) * radius;
    item.style.setProperty('--dx', x + 'px');
    item.style.setProperty('--dy', y + 'px');
  });
}

// 展开前强制一次重排：新建的菜单项先以折叠态完成样式计算，再切展开态，过渡才有起点
function applyExpandedClass() {
  if (!isExpanded) {
    floatBall.classList.remove('expanded');
    return;
  }
  floatBall.classList.remove('expanded');
  void getTooltipContainer().offsetWidth;
  floatBall.classList.add('expanded');
}

function attachItemEvents() {
  const tooltipContainer = getTooltipContainer();
  const items = tooltipContainer.querySelectorAll('.tooltip-item');
  items.forEach(item => {
    item.addEventListener('click', handleItemClick);
    item.addEventListener('mouseenter', handleFloatBallMouseEnter);
  });
}

function handleItemClick(e) {
  e.stopPropagation();

  const index = parseInt(e.currentTarget.dataset.index, 10);
  const configItem = floatConfig[index];
  
  if (!configItem) {
    toggleExpand();
    return;
  }
  
  let actionToSend = '';
  
  if (configItem.type === 'tool') {
    // 工具的 path 是站内路由；缺路径时交给主进程回退到工具中心
    actionToSend = 'tool:' + (configItem.path || '');
  } else if (configItem.type === 'nav') {
    const path = configItem.path || configItem.action;
    if (path) {
      actionToSend = 'nav:' + path;
    }
  } else if (configItem.type === 'app') {
    const appPath = configItem.path || '';
    if (appPath) {
      actionToSend = 'open-app:' + appPath;
    }
  } else if (configItem.type === 'plugin') {
    const pluginId = configItem.action;
    if (pluginId) {
      actionToSend = 'plugin:' + pluginId;
    }
  } else if (configItem.type === 'ai') {
    const aiAction = configItem.action || 'chat';
    actionToSend = aiAction.startsWith('ai:') ? aiAction : 'ai:' + aiAction;
  } else {
    actionToSend = configItem.action || '';
  }
  
  if (actionToSend) {
    window.electronAPI.floatAction(actionToSend);
  }
  toggleExpand();
}

function toggleExpand() {
  isExpanded = !isExpanded;
  window.electronAPI.setExpanded(isExpanded);
  // 展开时让桌宠闭嘴，避免台词气泡和菜单项叠在一起
  if (isExpanded) window.FloatPet.clearBubble();
  // 兜底：配置还没加载完就点击时，菜单项尚未构建，先补一次构建
  if (isExpanded && getTooltipContainer().children.length === 0) {
    renderFloatBall();
    return;
  }
  applyExpandedClass();
}

// 单击即时展开（保留原有飞散动画）/ 双击打开 AI 面板。
// 用原生 dblclick + MouseEvent.detail 判定，不再用定时器延迟单击，
// 否则点击后有 200ms 空窗，看起来像「没反应 / 动画丢了」。
const DOUBLE_CLICK_ACTION = 'ai:chat';

function handleFloatBallClick(e) {
  e.stopPropagation();
  // 长按已经触发快速捕捉，松手产生的 click 不应再展开菜单
  if (longPressFired) {
    longPressFired = false;
    return;
  }
  if (moved) {
    moved = false;
    return;
  }
  // 双击产生的第二次 click 不切换菜单，交给 dblclick 处理
  if (e.detail > 1) return;
  toggleExpand();
}

function handleFloatBallDoubleClick(e) {
  e.stopPropagation();
  if (moved) {
    moved = false;
    return;
  }
  if (isExpanded) {
    // 双击时跳过收起过渡，避免菜单先闪一下再弹出面板
    floatBall.classList.add('instant');
    toggleExpand();
    // 用宏任务复位：窗口隐藏时 rAF 可能一直不触发，会连累后续所有展开动画
    setTimeout(function () {
      floatBall.classList.remove('instant');
    }, 0);
  }
  window.electronAPI.floatAction(DOUBLE_CLICK_ACTION);
}

// ── P2-3 手势层 ──
let gesturesEnabled = true;
let longPressTimer = null;
let longPressFired = false;
let pressStart = { x: 0, y: 0 };
let wheelIndex = -1;
let wheelAccum = 0;
let wheelThrottle = 0;
let wheelTimer = null;

const cancelLongPress = () => {
  clearTimeout(longPressTimer);
  longPressTimer = null;
};

function handleWheel(e) {
  if (!gesturesEnabled || !isExpanded || isDragging) return;
  e.preventDefault();
  const now = Date.now();
  wheelAccum += e.deltaY;
  if (now - wheelThrottle < 100) return;
  wheelThrottle = now;
  const nodes = Array.from(getTooltipContainer().querySelectorAll('.tooltip-item'));
  if (nodes.length === 0) return;
  const direction = wheelAccum >= 0 ? 1 : -1;
  wheelAccum = 0;
  wheelIndex = (wheelIndex + direction + nodes.length) % nodes.length;
  nodes.forEach((node, index) => node.classList.toggle('wheel-active', index === wheelIndex));
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => {
    const node = nodes[wheelIndex];
    if (node) node.click();
  }, 300);
}

function handleDragOver(e) {
  if (!gesturesEnabled || isDragging) return;
  e.preventDefault();
  floatBall.classList.add('drop-active');
  window.electronAPI.setDragOver(true);
}

function handleDragLeave(e) {
  if (e.relatedTarget) return;
  floatBall.classList.remove('drop-active');
  window.electronAPI.setDragOver(false);
}

function handleDrop(e) {
  e.preventDefault();
  floatBall.classList.remove('drop-active');
  window.electronAPI.setDragOver(false);
  const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
  const paths = files.map(file => window.electronAPI.getPathForFile(file)).filter(Boolean);
  if (paths.length === 0) return;
  Promise.resolve(window.electronAPI.shelfAdd(paths))
    .then((result) => {
      const ok = result && result.ok;
      const text = ok ? `已暂存 ${result.added} 个文件` : ((result && result.error) || '暂存失败');
      const actions = ok && result.added > 0
        ? [{ label: '查看中转站', action: 'ai:shelf' }]
        : [];
      window.FloatPet.showCard({ text, actions, ttl: 6000 });
    })
    .catch(() => window.FloatPet.showCard({ text: '暂存失败', ttl: 4000 }));
}

function handleFloatBallMouseDown(e) {
  // 只响应左键，右键留给原生菜单（否则 mouseup 被菜单吞掉会卡在拖拽态）
  if (e.button !== 0) return;
  // 气泡（收件箱/剪贴板提示）里的按钮：不能进入拖拽逻辑。
  // 一旦 setDragging(true) 会立刻 clearBubble()，按钮在 mouseup 前就被移除，click 永远不触发
  if (e.target && e.target.closest && e.target.closest('.pet-bubble')) return;
  e.preventDefault();
  isDragging = true;
  moved = false;
  longPressFired = false;
  pressStart = { x: e.clientX, y: e.clientY };
  floatBall.classList.add('dragging');
  window.FloatPet.setDragging(true);
  window.electronAPI.dragStart();
  if (gesturesEnabled) {
    cancelLongPress();
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      if (isDragging && !moved) {
        longPressFired = true;
        window.electronAPI.floatAction('ai:capture');
      }
    }, 500);
  }
}

// 窗口位置由主进程跟随系统光标更新（保证 DPI 换算正确），这里只做节流调度：
// 高频鼠标（可达上千事件/秒）若每个事件都发一次 IPC，主进程消息队列会被灌满导致窗口无响应
function scheduleDragMove() {
  if (dragPendingFrame) return;
  dragPendingFrame = true;
  requestAnimationFrame(function () {
    dragPendingFrame = false;
    if (isDragging) window.electronAPI.dragMove();
  });
}

function handleDocumentMouseMove(e) {
  if (!isDragging) return;
  // 快速甩动时 mouseup 可能落在窗口外丢失，按按键状态兜底结束拖拽
  if (e.buttons === 0) {
    stopDrag();
    return;
  }
  // 位移超过 4px 视为拖拽，取消长按手势
  if (longPressTimer && (Math.abs(e.clientX - pressStart.x) > 4 || Math.abs(e.clientY - pressStart.y) > 4)) {
    cancelLongPress();
  }
  moved = true;
  scheduleDragMove();
}

// 统一收口拖拽结束，供 mouseup 与窗口失焦两条路径复用
function stopDrag() {
  if (!isDragging) return;
  isDragging = false;
  cancelLongPress();
  floatBall.classList.remove('dragging');
  window.FloatPet.setDragging(false);
  window.electronAPI.dragEnd();
}

function handleDocumentClick(e) {
  if (isExpanded && !floatBall.contains(e.target)) {
    toggleExpand();
  }
}

function handleFloatBallMouseLeave() {
  if (isExpanded && !isDragging) {
    collapseTimer = setTimeout(() => {
      toggleExpand();
    }, 300);
  }
}

function handleFloatBallMouseEnter() {
  if (collapseTimer) {
    clearTimeout(collapseTimer);
    collapseTimer = null;
  }
}

function handleContextMenu(e) {
  e.preventDefault();
  window.electronAPI.showContextMenu();
}

function initFloatBall() {
  floatBall.addEventListener('click', handleFloatBallClick);
  floatBall.addEventListener('dblclick', handleFloatBallDoubleClick);
  floatBall.addEventListener('mousedown', handleFloatBallMouseDown);
  floatBall.addEventListener('mouseenter', handleFloatBallMouseEnter);
  floatBall.addEventListener('mouseleave', handleFloatBallMouseLeave);
  floatBall.addEventListener('contextmenu', handleContextMenu);
  // mousemove / mouseup 全局常驻，避免每次拖拽反复增删监听器
  document.addEventListener('mousemove', handleDocumentMouseMove, { passive: true });
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('wheel', handleWheel, { passive: false });
  document.addEventListener('dragover', handleDragOver);
  document.addEventListener('dragleave', handleDragLeave);
  document.addEventListener('drop', handleDrop);
  // 兜底：失焦时 mouseup 可能收不到，防止一直卡在拖拽态
  window.addEventListener('blur', stopDrag);

  if (window.electronAPI.getGesturesEnabled) {
    window.electronAPI.getGesturesEnabled()
      .then((value) => { gesturesEnabled = value !== false; })
      .catch(() => {});
  }
  
  async function loadData() {
    try {
      // Try to load config with cached icons first
      if (window.electronAPI.getFloatConfigWithIcons) {
        try {
          const config = await window.electronAPI.getFloatConfigWithIcons();
          if (config && Array.isArray(config) && config.length > 0) {
            floatConfig = config;
            // 如果悬浮球已展开，重新渲染以显示加载完成的配置
            // 菜单项常驻 DOM，配置加载完必须构建，否则首次点击没有可展开的节点
            renderFloatBall();
            return;
          }
        } catch (e) {
          console.warn('Failed to load config with icons, falling back to basic config');
        }
      }
      // Fallback to basic config without icons
      const config = await window.electronAPI.getFloatConfig();
      floatConfig = (config && Array.isArray(config) && config.length > 0) ? config : floatConfig;
      renderFloatBall();
    } catch (error) {
      console.error('Failed to get float config:', error);
      // 加载失败时保留现有配置，不清空
    }
  }
  
  loadData();

  // 主题跟随主窗口：只切 <html class="dark">，配色全部由 float.css 的 CSS 变量承担，
  // 因此不需要重渲染（否则会打断展开动画/位置状态）
  function applyTheme(isDark) {
    document.documentElement.classList.toggle('dark', !!isDark);
  }

  if (window.electronAPI.getTheme) {
    window.electronAPI.getTheme().then(function(data) {
      applyTheme(data && data.isDark);
    }).catch(function() {});
  }

  if (window.electronAPI.onThemeChanged) {
    window.electronAPI.onThemeChanged(function(data) {
      applyTheme(data && data.isDark);
    });
  }

  window.electronAPI.onConfigChanged(async function(newConfig) {
    // Try to load config with icons when config changes
    if (window.electronAPI.getFloatConfigWithIcons) {
      try {
        const configWithIcons = await window.electronAPI.getFloatConfigWithIcons();
        if (configWithIcons && Array.isArray(configWithIcons) && configWithIcons.length > 0) {
          floatConfig = configWithIcons;
          renderFloatBall();
          return;
        }
      } catch (e) {
        console.warn('Failed to load config with icons on change');
      }
    }
    // Fallback to the provided config（仅在 newConfig 是非空数组时才更新，避免清空）
    if (newConfig && Array.isArray(newConfig) && newConfig.length > 0) {
      floatConfig = newConfig;
      renderFloatBall();
    } else if (newConfig && Array.isArray(newConfig) && newConfig.length === 0) {
      // 空配置可能是重置操作，重新从后端加载默认配置
      try {
        const reloaded = await window.electronAPI.getFloatConfig();
        if (reloaded && Array.isArray(reloaded) && reloaded.length > 0) {
          floatConfig = reloaded;
          renderFloatBall();
        }
      } catch (e) {
        console.warn('Failed to reload float config after empty config received');
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFloatBall);
} else {
  initFloatBall();
}
