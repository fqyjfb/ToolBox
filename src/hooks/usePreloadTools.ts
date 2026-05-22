import { useEffect } from 'react';

// 预加载的模块列表（高频工具页面）
const PRELOAD_MODULES = [
  () => import('../pages/tools/todo'),
  () => import('../pages/tools/notes'),
  () => import('../pages/tools/quick-reply'),
  () => import('../pages/tools/cloud-clipboard'),
];

/**
 * 预加载常用工具页面
 * 在用户登录后或首页加载完成后调用
 */
export const usePreloadTools = () => {
  useEffect(() => {
    // 使用 requestIdleCallback 在浏览器空闲时预加载
    const preload = () => {
      PRELOAD_MODULES.forEach((moduleLoader) => {
        moduleLoader().catch(() => {
          // 静默处理预加载失败，不影响主流程
        });
      });
    };

    if ('requestIdleCallback' in window) {
      const idleCallbackId = window.requestIdleCallback(preload, { timeout: 5000 });
      return () => window.cancelIdleCallback(idleCallbackId);
    } else {
      // 降级处理：使用 setTimeout
      const timeoutId = setTimeout(preload, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, []);
};

export default usePreloadTools;
