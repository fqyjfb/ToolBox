import { useEffect } from 'react';

// 常驻预载：只保留首页高频入口（待办、快捷回复）。
// notes / cloud-clipboard 属于重型或低频页，改为意图预载 / 首次访问加载。
const PRELOAD_MODULES = [
  () => import('../pages/tools/todo'),
  () => import('../pages/tools/quick-reply'),
];

// 悬停意图预载：命中入口后延迟 180ms 再加载，避免光标快速划过造成无谓解析
const INTENT_DELAY_MS = 180;

const INTENT_MODULES = {
  notes: () => import('../pages/tools/notes'),
};

const loadedIntents = new Set<keyof typeof INTENT_MODULES>();

export const preloadToolByIntent = (key: keyof typeof INTENT_MODULES) => {
  if (loadedIntents.has(key)) return;
  loadedIntents.add(key);
  setTimeout(() => {
    INTENT_MODULES[key]().catch(() => {});
  }, INTENT_DELAY_MS);
};

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
