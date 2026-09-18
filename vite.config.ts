import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron';

  return {
    plugins: [react()],
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: isElectron ? 5174 : 5173,
      host: true,
      proxy: {
        '/api/news': {
          target: 'https://60s.fqy-jfb.workers.dev/v2',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/news/, ''),
          secure: true,
        },
        '/api/news-fallback': {
          target: 'https://60s.viki.moe/v2',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/news-fallback/, ''),
          secure: true,
        },
        '/api/ip': {
          target: 'http://demo.ip-api.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ip/, ''),
          secure: false,
        },
      },
    },
    preview: {
      port: isElectron ? 5174 : 5173,
    },
    build: {
      target: 'esnext',
      cssMinify: 'lightningcss',
      rollupOptions: {
        external: [
          '@aws-sdk/client-s3',
          '@aws-sdk/s3-request-presigner',
          'adm-zip',
          'sql.js',
          'electron-log',
          'follow-redirects',
          'electron',
        ],
        output: {
          // 关闭依赖提升：避免被动态导入的工具页/文件预览依赖被提升进入口 chunk，
          // 从而在首屏被整体预加载
          hoistTransitiveImports: false,
          manualChunks: (id0) => {
            // Windows 下 id 为绝对路径，统一分隔符后再匹配
            const id = id0.replace(/\\/g, '/');
            if (id.includes('node_modules')) {
              // 文件预览相关（@open-file-viewer / pdfjs-dist）不做强制分组：
              // 交由 Rollup 自动分割，避免 Vite 的 __vitePreload 辅助块落在这里而被首屏依赖
              if (id.includes('node_modules/vditor')) {
                return 'vendor-editor';
              }
              if (id.includes('node_modules/lucide-react')) {
                return 'vendor-ui';
              }
              if (id.includes('node_modules/@supabase') || id.includes('node_modules/@tanstack')) {
                return 'vendor-tools';
              }
              if (
                id.includes('node_modules/react/') ||
                id.includes('node_modules/react-dom/') ||
                id.includes('node_modules/react-router') ||
                id.includes('node_modules/scheduler') ||
                id.includes('node_modules/zustand')
              ) {
                return 'vendor-react';
              }
              // 不指定兜底块：交由 Rollup 按依赖图自动分割，
              // 避免未分类依赖被聚成一个大块并在首屏被整体加载
              return undefined;
            }
            // 工具页不再按目录强制分组：交由 Rollup 依据动态导入关系自动分割，
            // 使被入口共享的模块独立为共享块，而不是把整个工具页拖进首屏
            return undefined;
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  };
});