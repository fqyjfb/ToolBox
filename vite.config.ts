import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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
    },
    preview: {
      port: isElectron ? 5174 : 5173,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (['react', 'react-dom', 'react-router-dom', 'zustand'].some(pkg => id.includes(pkg))) {
                return 'vendor-react';
              }
              if (['vditor', 'react-markdown', 'marked', 'rehype-raw', 'remark-gfm'].some(pkg => id.includes(pkg))) {
                return 'vendor-editor';
              }
              if (['jspdf', 'html2canvas'].some(pkg => id.includes(pkg))) {
                return 'vendor-pdf';
              }
              if (['lucide-react', 'styled-components'].some(pkg => id.includes(pkg))) {
                return 'vendor-ui';
              }
              if (['qrcode', '@supabase/supabase-js', '@tanstack/react-query'].some(pkg => id.includes(pkg))) {
                return 'vendor-tools';
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
})