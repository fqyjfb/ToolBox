/**
 * 浏览器服务
 * 用于处理浏览器相关的功能，包括根据用户设置打开链接
 */

/**
 * 打开链接
 * @param url 要打开的URL
 */
export const openUrl = (url: string): void => {
  const browserMode = localStorage.getItem('toolbox_browser_mode') as 'internal' | 'external' || 'internal';
  
  if (window.electron) {
    if (browserMode === 'external') {
      window.electron.openExternal(url);
    } else {
      window.electron.openInternal(url);
    }
  } else {
    window.open(url, '_blank');
  }
};

/**
 * 获取当前浏览器设置
 * @returns 当前浏览器设置
 */
export const getBrowserMode = (): 'internal' | 'external' => {
  return localStorage.getItem('toolbox_browser_mode') as 'internal' | 'external' || 'internal';
};

/**
 * 设置浏览器模式
 * @param mode 浏览器模式
 */
export const setBrowserMode = (mode: 'internal' | 'external'): void => {
  localStorage.setItem('toolbox_browser_mode', mode);
};
