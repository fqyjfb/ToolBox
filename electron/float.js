const floatBall = document.getElementById('floatBall');
const tooltipContainer = document.getElementById('tooltipContainer');

let isExpanded = false;
let isDragging = false;
let moved = false;
let clickTimer = null;
let floatConfig = [];

const iconPaths = {
  Home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
  Folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>',
  Wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>',
  Zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>',
  Bookmark: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>',
  CheckCircle: '<circle cx="12" cy="12" r="10"></circle><polyline points="16 10 10 16 8 14"></polyline>',
  Search: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
  Flame: '<path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"></path><circle cx="11.25" cy="13.25" r="1.5"></circle>',
  Settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>',
  FileText: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>',
  Calculator: '<path d="M18 18h-12a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2z"></path><line x1="6" y1="4" x2="18" y2="4"></line><line x1="6" y1="20" x2="18" y2="20"></line>',
  Globe: '<circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="2" y2="12"></line><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path>',
  Clipboard: '<rect x="9" y="2" width="6" height="4" rx="2"></rect><path d="M16 4h-6v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4z"></path><path d="M8 4H2v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V4z"></path>',
  MessageSquare: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
  Download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>',
  Upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 10 12 15 7 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>',
  Camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle>',
  Music: '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
  Image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>',
  Video: '<path d="M23 7v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2z"></path><polygon points="16 13 10 20 10 10 16 13"></polygon>',
  Clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
  Shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
  Heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>',
  Star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
  User: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
  Mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22 6 12 13 2 6"></polyline>',
  Phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>',
  Map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="22" x2="8" y2="18"></line><line x1="16" y1="22" x2="16" y2="18"></line><line x1="1" y1="6" x2="8" y2="10"></line><line x1="8" y1="10" x2="16" y2="6"></line>',
  Layers: '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"></polygon><polyline points="12 2 12 22"></polyline><polyline points="2 8.5 12 15.5 22 8.5"></polyline>',
  Palette: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"></path><circle cx="8.5" cy="8.5" r="1.5"></circle><circle cx="12" cy="7" r="1"></circle><circle cx="15.5" cy="8.5" r="1.5"></circle><circle cx="11" cy="12" r="1"></circle><circle cx="14" cy="14" r="1"></circle>',
  Bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>',
  Gift: '<rect x="3" y="12" width="18" height="8" rx="2"></rect><path d="M12 22V12"></path><path d="M17 12l-5-5-5 5"></path><path d="M9 7.5V5a3.5 3.5 0 0 1 7 0v2.5"></path>',
  ChevronRight: '<path d="M9 18l6-6-6-6"></path>',
  ArrowRight: '<path d="M9 18l6-6-6-6"></path>',
  RefreshCw: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path>',
  Trash2: '<path d="M3 6h18"></path><path d="M19 6v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V6"></path><path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2"></path>',
  Lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>',
  Unlock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path><path d="M15 15H9"></path>',
  Wifi: '<path d="M12 20a8 8 0 0 0 0-16 8 8 0 0 0 0 16"></path><path d="M12 14a4 4 0 0 0 0-8 4 4 0 0 0 0 8"></path><path d="M12 8a2 2 0 0 0 0-4 2 2 0 0 0 0 4"></path>',
  Battery: '<rect x="2" y="6" width="20" height="14" rx="2"></rect><path d="M22 10v4"></path><path d="M6 10v4h12"></path>',
  Volume2: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>',
  VolumeX: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>',
  Maximize2: '<path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M21 8v3a2 2 0 0 1-2 2h-3"></path><path d="M16 21h3a2 2 0 0 0 2-2v-3"></path><path d="M3 16v-3a2 2 0 0 1 2-2h3"></path>',
  Minimize2: '<path d="M4 14h16"></path><path d="M10 4v16"></path>',
  RotateCcw: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 16v5h-5"></path>',
  Moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
  Sun: '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>',
  Cpu: '<rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="12" x2="15" y2="12"></line><line x1="12" y1="9" x2="12" y2="15"></line>',
  HardDrive: '<path d="M22 12h-4V4h-12v8H2"></path><path d="M6 16h12"></path><path d="M6 20h12"></path>',
  Monitor: '<rect x="2" y="3" width="20" height="14" rx="2"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path>',
  Smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"></rect><path d="M12 22v-2"></path>',
  Printer: '<path d="M6 2H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2"></path><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h2"></path><path d="M22 2h-2a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2"></path><path d="M10 18h6"></path><path d="M12 14h2"></path><path d="M22 18h-2a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h2"></path><path d="M18 7V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v3"></path>',
  Cloud: '<path d="M19 18H6a4 4 0 0 1-.38-7.98 5.5 5.5 0 0 1 10.63-1.62A3.5 3.5 0 0 1 19 11v7z"></path>',
  CloudRain: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M16 14v6"></path><path d="M8 14v6"></path><path d="M12 16v6"></path>',
  CloudSun: '<path d="M22 11.08A9 9 0 1 0 3.92 13 7 7 0 0 1 22 11.08z"></path>',
  CloudMoon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
  ZapOff: '<path d="M12 2l3 6 6 1.5-4.5 3.5 1 6-5.5-3-5.5 3 1-6L3 9.5l6-1.5 3-6"></path><line x1="2" y1="2" x2="22" y2="22"></line>',
  AlertCircle: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
  AlertTriangle: '<path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>',
  Info: '<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path>',
  XCircle: '<circle cx="12" cy="12" r="10"></circle><path d="M15 9l-6 6-6-6"></path>',
  HelpCircle: '<circle cx="12" cy="12" r="10"></circle><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>',
  Terminal: '<path d="M4 17l4-4-4-4M12 17l4-4-4-4M20 17l4-4-4-4"></path><path d="M2 3h20v14H2z"></path>',
  Code: '<path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29-1.42 1.41z"></path>',
  GitBranch: '<line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="18" r="3"></circle><line x1="18" y1="9" x2="18" y2="15"></line><line x1="21" y1="18" x2="15" y2="18"></line>',
  Github: '<path d="M15 22v-4a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v4"></path><path d="M12 14a7 7 0 0 1-7 7h14a7 7 0 0 1-7-7z"></path><path d="M8 2.3a4 4 0 0 1 4-4 4 4 0 0 1 4 4v.3"></path>',
  ExternalLink: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>',
  DownloadCloud: '<path d="M12 12h0"></path>',
  UploadCloud: '<path d="M12 12h0"></path>'
};

const tooltipPositions = [
  { top: '150%', left: '50%', transform: 'translate(-50%, -5px)' },
  { top: '-120%', left: '50%', transform: 'translate(-50%, -5px)' },
  { top: '10%', left: '60%', transform: 'translate(85%, -5px)' },
  { top: '10%', left: '-190%', transform: 'translate(70%, -5px)' },
  { top: '-78%', left: '-145%', transform: 'translate(70%, -5px)' },
  { top: '-79%', left: '35%', transform: 'translate(70%, -5px)' },
  { top: '104%', left: '39%', transform: 'translate(70%, -5px)' },
  { top: '101%', left: '-150%', transform: 'translate(70%, -5px)' }
];

const isPredefinedIcon = (icon) => {
  return icon && iconPaths.hasOwnProperty(icon);
};

const isBase64Icon = (icon) => {
  return icon && (icon.startsWith('data:image/') || (icon.length > 100 && !icon.includes(' ')));
};

const formatIconSrc = (icon) => {
  if (icon.startsWith('data:image/')) {
    return icon;
  }
  if (icon && icon.length > 100 && !icon.includes(' ')) {
    return `data:image/png;base64,${icon}`;
  }
  return null;
};

const createTooltipItem = (config, index) => {
  const position = tooltipPositions[index];
  const isPredefined = isPredefinedIcon(config.icon);
  const iconSrc = formatIconSrc(config.icon);
  const iconPath = isPredefined ? iconPaths[config.icon] : iconPaths['HelpCircle'];
  
  const item = document.createElement('span');
  item.className = `tooltip-item tooltip${index + 1}`;
  item.dataset.action = config.action;
  item.dataset.type = config.type;
  item.dataset.path = config.path || '';
  
  const iconHtml = iconSrc 
    ? `<img src="${iconSrc}" alt="" class="app-icon" />`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>`;
  
  item.innerHTML = `${iconHtml}<span class="tooltip-label">${config.name}</span>`;
  
  item.style.setProperty('--tooltip-color', config.color);
  if (!iconSrc) {
    item.style.fill = config.color;
  }
  item.style.top = position.top;
  item.style.left = position.left;
  item.style.transform = position.transform;
  
  item.addEventListener('mouseenter', () => {
    item.style.background = config.color;
    const svg = item.querySelector('svg');
    if (svg) {
      svg.style.fill = '#fff';
    }
  });
  
  item.addEventListener('mouseleave', () => {
    item.style.background = '#fff';
    const svg = item.querySelector('svg');
    if (svg) {
      svg.style.fill = config.color;
    }
  });
  
  const img = item.querySelector('img');
  if (img) {
    img.addEventListener('error', () => {
      img.style.display = 'none';
      const svgContainer = document.createElement('div');
      svgContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px">${iconPaths['Folder']}</svg>`;
      img.parentNode.insertBefore(svgContainer, img);
    });
  }
  
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    handleTooltipClick(config);
    collapseBall();
  });
  
  return item;
};

const renderTooltips = (config) => {
  tooltipContainer.innerHTML = '';
  config.forEach((item, index) => {
    const tooltip = createTooltipItem(item, index);
    tooltipContainer.appendChild(tooltip);
  });
};

const loadConfig = async () => {
  try {
    const config = await window.electronAPI.getFloatConfig();
    floatConfig = config;
    renderTooltips(config);
  } catch (error) {
    console.error('Failed to load float config:', error);
    floatConfig = [];
    renderTooltips(floatConfig);
  }
};

const handleTooltipClick = (config) => {
  if (config.type === 'nav') {
    window.electronAPI.floatAction(config.action);
  } else if (config.type === 'app' && config.path) {
    window.electronAPI.floatAction(`open-app:${config.path}`);
  } else if (config.type === 'tool' && config.path) {
    window.electronAPI.floatAction(`nav:${config.path}`);
  }
};

const collapseBall = () => {
  isExpanded = false;
  floatBall.classList.remove('expanded');
};

const expandBall = () => {
  isExpanded = true;
  floatBall.classList.add('expanded');
};

const handleMouseDown = (e) => {
  if (e.button !== 0) return;
  e.preventDefault();

  moved = false;
  isDragging = true;
  floatBall.classList.add('dragging');
  window.electronAPI.dragStart();

  const onMove = () => {
    moved = true;
    window.electronAPI.dragMove();
  };

  const onUp = (ev) => {
    floatBall.classList.remove('dragging');
    isDragging = false;
    window.electronAPI.dragEnd();

    const rect = floatBall.getBoundingClientRect();
    const isOver =
      ev.clientX >= rect.left &&
      ev.clientX <= rect.right &&
      ev.clientY >= rect.top &&
      ev.clientY <= rect.bottom;
    if (!isOver) {
      window.electronAPI.setIgnoreMouseEvents(true);
    }

    if (!moved) {
      if (isExpanded) {
        collapseBall();
      } else if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        expandBall();
      } else {
        clickTimer = setTimeout(() => {
          clickTimer = null;
          expandBall();
        }, 250);
      }
    }

    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
};

const handleMouseEnter = () => {
  window.electronAPI.setIgnoreMouseEvents(false);
};

const handleMouseLeave = () => {
  if (!isDragging) {
    window.electronAPI.setIgnoreMouseEvents(true);
  }
};

const handleContextMenu = (e) => {
  e.preventDefault();
  window.electronAPI.showContextMenu();
};

const handleDragEnter = (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer.types.includes('Files')) {
    floatBall.classList.add('drop-active');
    window.electronAPI.setIgnoreMouseEvents(false);
  }
};

const handleDragOver = (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer.types.includes('Files')) {
    e.dataTransfer.dropEffect = 'copy';
  }
};

const handleDragLeave = (e) => {
  e.preventDefault();
  e.stopPropagation();
  floatBall.classList.remove('drop-active');
  if (!isDragging) {
    window.electronAPI.setIgnoreMouseEvents(true);
  }
};

const handleDrop = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  floatBall.classList.remove('drop-active');

  const files = e.dataTransfer.files;
  if (files.length === 0) return;

  const paths = [];
  for (let i = 0; i < files.length; i++) {
    try {
      const p = files[i].path;
      if (p) paths.push(p);
    } catch {}
  }

  if (paths.length > 0) {
    window.electronAPI.resolveDroppedFiles(paths);
  }

  if (!isDragging) {
    window.electronAPI.setIgnoreMouseEvents(true);
  }
};

const initEventListeners = () => {
  floatBall.addEventListener('mousedown', handleMouseDown);
  floatBall.addEventListener('mouseenter', handleMouseEnter);
  floatBall.addEventListener('mouseleave', handleMouseLeave);
  floatBall.addEventListener('contextmenu', handleContextMenu);
  floatBall.addEventListener('dragenter', handleDragEnter);
  floatBall.addEventListener('dragover', handleDragOver);
  floatBall.addEventListener('dragleave', handleDragLeave);
  floatBall.addEventListener('drop', handleDrop);

  window.electronAPI.onConfigChanged((config) => {
    floatConfig = config;
    renderTooltips(config);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadConfig();
});