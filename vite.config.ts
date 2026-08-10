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
          target: 'https://60s.viki.moe/v2',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/news/, ''),
          secure: true,
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
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('node_modules/@open-file-viewer') || id.includes('node_modules/pdfjs-dist')) {
                return 'vendor-viewer';
              }
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
              return 'vendor-other';
            }
            if (id.includes('/src/pages/tools/')) {
              const toolName = id.split('/pages/tools/')[1]?.split('/')[0];
              return toolName ? `tool-${toolName}` : undefined;
            }
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  };
});