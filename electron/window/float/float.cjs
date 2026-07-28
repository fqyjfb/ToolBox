const floatBall = document.getElementById('floatBall');

let isExpanded = false;
let isDragging = false;
let moved = false;
let floatConfig = [];
let collapseTimer = null;

function getTooltipContainer() {
  return document.getElementById('tooltipContainer');
}

// 从共享文件加载图标数据
let customIcons = {};
let getIconSvgByName = (name) => '';

// 初始化图标数据
function initIcons() {
  if (window.IconData) {
    customIcons = window.IconData.customIcons;
    getIconSvgByName = window.IconData.getIconSvgByName;
  } else {
    console.warn('Failed to load icon data, using fallback icons');
    // 备用图标
    customIcons = {
      Info: '<svg t="1778300057036" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M950.9 109.7H73.1C32.9 109.7 0 142.6 0 182.9v658.3c0 40.2 32.9 73.1 73.1 73.1h877.7c40.2 0 73.1-32.9 73.1-73.1V182.9c0.1-40.3-32.8-73.2-73-73.2zM329.1 548.6c0 20.1-16.5 36.6-36.6 36.6h-73.1c-20.1 0-36.6-16.5-36.6-36.6v-73.1c0-20.1 16.5-36.6 36.6-36.6h73.1c20.1 0 36.6 16.5 36.6 36.6v73.1z m256 0c0 20.1-16.5 36.6-36.6 36.6h-73.1c-20.1 0-36.6-16.5-36.6-36.6v-73.1c0-20.1 16.5-36.6 36.6-36.6h73.1c20.1 0 36.6 16.5 36.6 36.6v73.1z m256 0c0 20.1-16.5 36.6-36.6 36.6h-73.1c-20.1 0-36.6-16.5-36.6-36.6v-73.1c0-20.1 16.5-36.6 36.6-36.6h73.1c20.1 0 36.6 16.5 36.6 36.6v73.1z" fill="#00A2FF"></path></svg>'
    };
  }
}

const defaultFloatIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 16 16"><path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471z" /></svg>';

function getIconByName(name, item) {
  if (!name) return '';
  
  // Handle plugin icon type
  if (name.startsWith('plugin:')) {
    if (item && item.path) {
      return '<img src="' + item.path + '" class="app-icon plugin-icon" />';
    }
    const pluginId = name.substring(7);
    return '<span class="plugin-fallback-icon">插件</span>';
  }
  
  if (name.startsWith('data:image/')) {
    return '<img src="' + name + '" class="app-icon" />';
  }
  
  if (name.length > 100 && !name.includes(' ')) {
    return '<img src="data:image/png;base64,' + name + '" class="app-icon" />';
  }
  
  return customIcons[name] || customIcons.Info || '';
}

function renderFloatBall() {
  if (!isExpanded) {
    floatBall.innerHTML = '<span class="main-icon">' + defaultFloatIcon + '</span><div id="tooltipContainer"></div>';
    floatBall.classList.remove('expanded');
  } else {
    const tooltipContainer = getTooltipContainer();
    if (floatConfig.length === 0) {
      tooltipContainer.innerHTML = '<div class="tooltip-item"><span style="color: #666; font-size: 12px;">暂无配置</span></div>';
    } else {
      const itemsHTML = floatConfig.map((item, index) => {
        const iconHTML = getIconByName(item.icon, item);
        if (iconHTML) {
          return '<div class="tooltip-item" data-index="' + index + '" title="' + item.name + '">' + iconHTML + '<span class="tooltip-label">' + item.name + '</span></div>';
        } else {
          return '<div class="tooltip-item" data-index="' + index + '" title="' + item.name + '"><span style="color: #666;">' + item.name.charAt(0) + '</span><span class="tooltip-label">' + item.name + '</span></div>';
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
    const radius = 60;
    const x = Math.cos((angle * Math.PI) / 180) * radius;
    const y = Math.sin((angle * Math.PI) / 180) * radius;
    item.style.transform = 'translate(-50%, -50%) translate(' + x + 'px, ' + y + 'px)';
    item.style.opacity = '1';
    item.style.visibility = 'visible';
  });
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
  e.preventDefault();
  isDragging = true;
  moved = false;
  floatBall.classList.add('dragging');
  
  window.electronAPI.dragStart();
  
  const startX = e.clientX;
  const startY = e.clientY;
  const startLeft = parseFloat(floatBall.style.left) || 0;
  const startTop = parseFloat(floatBall.style.top) || 0;

  const onMouseMove = function(e) {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    floatBall.style.left = (startLeft + deltaX) + 'px';
    floatBall.style.top = (startTop + deltaY) + 'px';
    window.electronAPI.dragMove();
    moved = true;
  };

  const onMouseUp = function() {
    isDragging = false;
    floatBall.classList.remove('dragging');
    window.electronAPI.dragEnd();
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
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
  // 初始化图标数据
  initIcons();
  
  floatBall.addEventListener('click', handleFloatBallClick);
  floatBall.addEventListener('mousedown', handleFloatBallMouseDown);
  floatBall.addEventListener('mouseenter', handleFloatBallMouseEnter);
  floatBall.addEventListener('mouseleave', handleFloatBallMouseLeave);
  floatBall.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('click', handleDocumentClick);
  
  async function loadData() {
    try {
      const config = await window.electronAPI.getFloatConfig();
      floatConfig = config || [];
    } catch (error) {
      console.error('Failed to get float config:', error);
      floatConfig = [];
    }
  }
  
  loadData();
  
  window.electronAPI.onConfigChanged(function(newConfig) {
    floatConfig = newConfig || [];
    if (isExpanded) {
      renderFloatBall();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFloatBall);
} else {
  initFloatBall();
}
