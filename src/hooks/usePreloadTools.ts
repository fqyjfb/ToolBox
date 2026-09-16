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

    if ('requestIdleCallback' in window) {
      const idleCallbackId = window.requestIdleCallback(preload, { timeout: 5000 });
      return () => window.cancelIdleCallback(idleCallbackId);
    } else {
      const timeoutId = setTimeout(preload, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, []);
};

export default usePreloadTools;
