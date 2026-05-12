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
              if (['react', 'react-dom', 'react-router-dom'].some(pkg => id.includes(pkg))) {
                return 'vendor';
              }
              if (['lucide-react', 'qrcode', 'marked', 'html2canvas', 'jspdf'].some(pkg => id.includes(pkg))) {
                return 'tools';
              }
              return 'vendor';
            }
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  };
})