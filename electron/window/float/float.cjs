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

function renderFloatBall() {
  if (!isExpanded) {
    // 桌宠形象是常驻 DOM，不能重建，否则持续动画会被打断
    getTooltipContainer().innerHTML = '';
    floatBall.classList.remove('expanded');
  } else {
    const tooltipContainer = getTooltipContainer();
    if (floatConfig.length === 0) {
      tooltipContainer.innerHTML = '<div class="tooltip-item"><span style="color: var(--float-fallback-text); font-size: 12px;">暂无配置</span></div>';
    } else {
      const itemsHTML = floatConfig.map((item, index) => {
        const iconHTML = getIconByName(item.icon, item);
        // 名称仅用自定义 .tooltip-label 展示，不再加原生 title，避免悬浮时出现两个提示
        if (iconHTML) {
          return '<div class="tooltip-item" data-index="' + index + '">' + iconHTML + '<span class="tooltip-label">' + item.name + '</span></div>';
        } else {
          return '<div class="tooltip-item" data-index="' + index + '"><span style="color: var(--float-fallback-text);">' + item.name.charAt(0) + '</span><span class="tooltip-label">' + item.name + '</span></div>';
        }
      }).join('');
      tooltipContainer.innerHTML = itemsHTML;
    }
    floatBall.classList.add('expanded');
    positionTooltipItems();
    attachItemEvents();
  }
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
    // 存储偏移到 data 属性，下一帧通过 CSS 变量生效以触发动画
    item.dataset.dx = x + 'px';
    item.dataset.dy = y + 'px';
  });
  // 延迟一帧让浏览器渲染折叠态后再应用展开态，确保动画播放
  setTimeout(function() {
    items.forEach(function(item) {
      item.style.setProperty('--dx', item.dataset.dx);
      item.style.setProperty('--dy', item.dataset.dy);
    });
  }, 0);
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
  
  const index = parseInt(e.currentTarget.dataset.index);
  const configItem = floatConfig[index];
  
  if (!configItem) {
    toggleExpand();
    return;
  }
  
  let actionToSend = '';
  
  if (configItem.type === 'tool' || configItem.type === 'nav') {
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
  renderFloatBall();
}

function handleFloatBallClick(e) {
  e.stopPropagation();
  
  if (!moved) {
    toggleExpand();
  }
  moved = false;
}

function handleFloatBallMouseDown(e) {
  // 只响应左键，右键留给原生菜单（否则 mouseup 被菜单吞掉会卡在拖拽态）
  if (e.button !== 0) return;
  e.preventDefault();
  isDragging = true;
  moved = false;
  floatBall.classList.add('dragging');
  window.FloatPet.setDragging(true);
  window.electronAPI.dragStart();
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
  moved = true;
  scheduleDragMove();
}

// 统一收口拖拽结束，供 mouseup 与窗口失焦两条路径复用
function stopDrag() {
  if (!isDragging) return;
  isDragging = false;
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
  floatBall.addEventListener('mousedown', handleFloatBallMouseDown);
  floatBall.addEventListener('mouseenter', handleFloatBallMouseEnter);
  floatBall.addEventListener('mouseleave', handleFloatBallMouseLeave);
  floatBall.addEventListener('contextmenu', handleContextMenu);
  // mousemove / mouseup 全局常驻，避免每次拖拽反复增删监听器
  document.addEventListener('mousemove', handleDocumentMouseMove, { passive: true });
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('click', handleDocumentClick);
  // 兜底：失焦时 mouseup 可能收不到，防止一直卡在拖拽态
  window.addEventListener('blur', stopDrag);
  
  async function loadData() {
    try {
      // Try to load config with cached icons first
      if (window.electronAPI.getFloatConfigWithIcons) {
        try {
          const config = await window.electronAPI.getFloatConfigWithIcons();
          if (config && Array.isArray(config) && config.length > 0) {
            floatConfig = config;
            // 如果悬浮球已展开，重新渲染以显示加载完成的配置
            if (isExpanded) {
              renderFloatBall();
            }
            return;
          }
        } catch (e) {
          console.warn('Failed to load config with icons, falling back to basic config');
        }
      }
      // Fallback to basic config without icons
      const config = await window.electronAPI.getFloatConfig();
      floatConfig = (config && Array.isArray(config) && config.length > 0) ? config : floatConfig;
      if (isExpanded) {
        renderFloatBall();
      }
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
          if (isExpanded) {
            renderFloatBall();
          }
          return;
        }
      } catch (e) {
        console.warn('Failed to load config with icons on change');
      }
    }
    // Fallback to the provided config（仅在 newConfig 是非空数组时才更新，避免清空）
    if (newConfig && Array.isArray(newConfig) && newConfig.length > 0) {
      floatConfig = newConfig;
      if (isExpanded) {
        renderFloatBall();
      }
    } else if (newConfig && Array.isArray(newConfig) && newConfig.length === 0) {
      // 空配置可能是重置操作，重新从后端加载默认配置
      try {
        const reloaded = await window.electronAPI.getFloatConfig();
        if (reloaded && Array.isArray(reloaded) && reloaded.length > 0) {
          floatConfig = reloaded;
          if (isExpanded) {
            renderFloatBall();
          }
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
