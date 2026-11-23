import React, { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import App from './App.tsx'
import { QueryProvider } from './providers/QueryProvider'
import ErrorBoundary from './components/ui/ErrorBoundary'
import LoadingSpinner from './components/ui/LoadingSpinner'
import StickyNoteWall from './pages/tools/sticky-note/StickyNoteWall'
import ReminderPopup from './pages/tools/reminder/ReminderPopup'
import LogsPage from './pages/logs/index'
import { isElectron } from './utils/environment'
import './services/aiApi'

(window as Window & { React?: typeof React }).React = React;

const standaloneMode = new URLSearchParams(window.location.search).get('standalone');

// 便签墙独立窗口：首帧前打标记，让 theme.css 关闭整窗背景（默认/深色/自定义主题）
if (standaloneMode === 'sticky-wall') {
  document.documentElement.classList.add('sticky-wall-mode');
}

// 桌面端预热首页 chunk：与 routes.tsx 的 lazy(Home) 指向同一模块，命中模块缓存后
// 首帧不再走 Suspense 回退；加载失败时路由自身的 lazy 仍会重新加载。
// 独立窗口不需要预热，因为不会进入主路由树。
if (isElectron() && !standaloneMode) {
  import('./pages/desktop/Home').catch(() => {
    // 忽略预热失败
  });
}

// 独立窗口不走 App 函数体，直接挂载最小组件树：
//   便签墙跳过网络请求、插件扫描、同步管理器、全局 settingChanged 监听等所有初始化。
//   提醒弹窗和日志同理，各自只挂自己需要的内容。
const mountStandalone = (mode: string) => {
  switch (mode) {
    case 'sticky-wall':
      return (
        <StrictMode>
          <ErrorBoundary>
            <QueryProvider>
              <StickyNoteWall />
            </QueryProvider>
          </ErrorBoundary>
        </StrictMode>
      );
    case 'reminder-popup':
      return (
        <StrictMode>
          <ErrorBoundary>
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center bg-bg-primary">
                <LoadingSpinner size="md" />
              </div>
            }>
              <ReminderPopup />
            </Suspense>
          </ErrorBoundary>
        </StrictMode>
      );
    case 'logs':
      return (
        <StrictMode>
          <ErrorBoundary>
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner size="md" />
              </div>
            }>
              <LogsPage />
            </Suspense>
          </ErrorBoundary>
        </StrictMode>
      );
    default:
      return null;
  }
};

const standaloneContent = standaloneMode ? mountStandalone(standaloneMode) : null;

if (standaloneContent) {
  createRoot(document.getElementById('root')!).render(standaloneContent);
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
