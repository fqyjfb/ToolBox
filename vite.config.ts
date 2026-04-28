import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const isElectron = mode === 'electron';
  
  return {
    plugins: [react()],
    base: './',
    server: {
      port: isElectron ? 5174 : 5173,
      host: true,
    },
    preview: {
      port: isElectron ? 5174 : 5173,
    },
  };
})
