import { useEffect } from 'react';

const PRELOAD_MODULES = [
  () => import('../pages/tools/todo'),
  () => import('../pages/tools/notes'),
  () => import('../pages/tools/quick-reply'),
  () => import('../pages/tools/cloud-clipboard'),
];

export const usePreloadTools = () => {
  useEffect(() => {
    const preload = () => {
      PRELOAD_MODULES.forEach((moduleLoader) => {
        moduleLoader().catch(() => {});
      });
    };

    // 5s 的兜底时限会让预加载几乎必定在首屏阶段执行，与首屏渲染和数据请求争抢主线程。
    // 放宽到 30s：浏览器空闲时照常预加载，忙碌时则推迟，不影响「最终一定预加载完成」。
    if ('requestIdleCallback' in window) {
      const idleCallbackId = window.requestIdleCallback(preload, { timeout: 30000 });
      return () => window.cancelIdleCallback(idleCallbackId);
    } else {
      const timeoutId = setTimeout(preload, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, []);
};
