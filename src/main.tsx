import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import App from './App.tsx'
import { QueryProvider } from './providers/QueryProvider'
import ErrorBoundary from './components/ui/ErrorBoundary'
import { isElectron } from './utils/environment'
import './services/aiApi'

(window as Window & { React?: typeof React }).React = React;

// 便签墙独立窗口：首帧前打标记，让 theme.css 关闭整窗背景（默认/深色/自定义主题）
if (new URLSearchParams(window.location.search).get('standalone') === 'sticky-wall') {
  document.documentElement.classList.add('sticky-wall-mode');
}

// 桌面端预热首页 chunk：与 routes.tsx 的 lazy(Home) 指向同一模块，命中模块缓存后
// 首帧不再走 Suspense 回退；加载失败时路由自身的 lazy 仍会重新加载。
if (isElectron()) {
  import('./pages/desktop/Home').catch(() => {
    // 忽略预热失败
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ErrorBoundary>
  </StrictMode>,
)
