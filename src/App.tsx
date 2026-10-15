import React, { useEffect, useState, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate as useRouterNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import Layout from './components/layout/Layout';
import WebLayout from './components/layout/WebLayout';
import MobileLayout from './components/layout/MobileLayout';
import CompactLayout from './components/layout/CompactLayout';
import Toast from './components/ui/Toast';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import PluginPanels from './components/plugins/PluginPanels';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/AuthStore';
import { useSidebarStore } from './store/sidebarStore';
import { useWindowModeStore } from './store/windowModeStore';
import { useSyncStore } from './store/syncStore';
import { logError, logInfo } from './services/loggerService';
import { syncManager } from './services/syncManager';
import { startNetworkMonitor } from './services/networkMonitor';
import { validateEncryptionKey, setEncryptionKey } from './utils/crypto';
import { reinitSupabase } from './services/supabase';
import { NavSearchProvider } from './contexts/NavSearchContext';
import { desktopRoutes, webRoutes, mobileRoutes, protectedRoutes, adminRoutes, RouteConfig } from './config/routes';
import { QueryProvider } from './providers/QueryProvider';
import { useQueryClient } from '@tanstack/react-query';
import { websiteBookmarksQuery, websiteCategoriesQuery } from './services/websiteQueries';
const LogsPage = React.lazy(() => import('./pages/logs/index'));
const ReminderPopup = React.lazy(() => import('./pages/tools/reminder/ReminderPopup'));
import { isElectron } from './utils/environment';
import { usePreloadTools } from './hooks/usePreloadTools';
import { pluginApi } from './services/pluginApi';

// 路由保护组件
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  isAuthenticated: boolean;
  requiresAdmin?: boolean;
  isAdmin?: boolean;
  isAuthLoading?: boolean;
}> = ({ children, isAuthenticated, requiresAdmin, isAdmin, isAuthLoading }) => {
  // 鉴权结果未决时先局部等待，避免「已登录但会话尚未恢复」被误判为未登录而跳登录页
  if (isAuthLoading && !isAuthenticated) {
    return <div className="flex items-center justify-center h-full"><LoadingSpinner size="md" /></div>;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiresAdmin && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// 渲染路由列表
const renderRoutes = (
  routes: RouteConfig[],
  isAuthenticated: boolean,
  isAdmin: boolean,
  LayoutComponent: React.ComponentType<{ children: React.ReactNode }> | null,
  isAuthLoading?: boolean
) => {
  const routeElements = routes.map((route) => (
    <Route
      key={route.path}
      path={route.path}
      element={route.element}
    />
  ));

  const protectedRouteElements = protectedRoutes.map((route) => (
    <Route
      key={route.path}
      path={route.path}
      element={
        route.requiresAdmin ? (
          <ProtectedRoute isAuthenticated={isAuthenticated} requiresAdmin={route.requiresAdmin} isAdmin={isAdmin} isAuthLoading={isAuthLoading}>
            {route.element}
          </ProtectedRoute>
        ) : route.requiresAuth ? (
          <ProtectedRoute isAuthenticated={isAuthenticated} requiresAdmin={route.requiresAdmin} isAuthLoading={isAuthLoading}>
            {route.element}
          </ProtectedRoute>
        ) : (
          route.element
        )
      }
    />
  ));

  const adminRouteElements = adminRoutes.map((route) => (
    <Route
      key={route.path}
      path={route.path}
      element={
        isAuthenticated && isAdmin ? (
          route.element
        ) : (
          <Navigate to="/login" replace />
        )
      }
    />
  ));

  const notFoundRoute = <Route path="*" element={<Navigate to="/" replace />} />;

  const unauthorizedRoutes = (
    <>
      {protectedRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={<Navigate to="/login" replace />}
        />
      ))}
      {adminRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={<Navigate to="/login" replace />}
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </>
  );

  const content = (
    <>
      {routeElements}
      {isAuthenticated ? (
        <>
          {protectedRouteElements}
          {isAdmin && adminRouteElements}
          {notFoundRoute}
        </>
      ) : (
        unauthorizedRoutes
      )}
    </>
  );

  return LayoutComponent ? (
    <LayoutComponent>
      <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner size="md" /></div>}>
        <Routes>{content}</Routes>
      </Suspense>
    </LayoutComponent>
  ) : (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner size="md" /></div>}>
      <Routes>{content}</Routes>
    </Suspense>
  );
};

const TrayNavigationHandler: React.FC = () => {
  const navigate = useRouterNavigate();

  useEffect(() => {
    pluginApi.setNavigate(navigate);

    const handleNavigate = (path: string) => {
      navigate(path);
    };

    window.electron?.onNavigate(handleNavigate);

    return () => {
      window.electron?.onNavigate(() => {});
    };
  }, [navigate]);

  return null;
};

// 定时提醒弹窗（notify_method === 'popup'）由主进程 reminderPopupWindow.cjs
// 创建独立 BrowserWindow 加载 ?standalone=reminder-popup#/reminder-popup 路由渲染，
// 不再在主窗口 React 树内显示 Modal

const isMobile = (): boolean => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 768;
  }
  return false;
};

// 独立窗口判定：由主进程单独创建的 BrowserWindow，以 ?standalone= 标识，
// 不参与主窗口的布局与路由树。纯 URL 判断，故提到模块级，
// 便于在 App 任一位置（含 hooks 之后的提前 return）生效。
const getStandaloneMode = (): string | null => {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('standalone');
};

const isStandaloneLogWindow = (): boolean => getStandaloneMode() === 'logs';

// 定时提醒弹窗：独立 BrowserWindow 加载 ?standalone=reminder-popup
const isStandaloneReminderPopup = (): boolean => getStandaloneMode() === 'reminder-popup';

const isStandaloneWindow = (): boolean => isStandaloneLogWindow() || isStandaloneReminderPopup();

function App() {
  const queryClient = useQueryClient();
  const { isDark, setTheme } = useThemeStore(useShallow((s) => ({ isDark: s.isDark, setTheme: s.setTheme })));
  const { setLastSyncTime, setStorageLocation, setSyncEnabled, setSyncModules, setSyncOnStartupEnabled } = useSyncStore(useShallow((s) => ({
    setLastSyncTime: s.setLastSyncTime,
    setStorageLocation: s.setStorageLocation,
    setSyncEnabled: s.setSyncEnabled,
    setSyncModules: s.setSyncModules,
    setSyncOnStartupEnabled: s.setSyncOnStartupEnabled,
  })));
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const { setVisible, setPosition } = useSidebarStore(useShallow((s) => ({ setVisible: s.setVisible, setPosition: s.setPosition })));

  usePreloadTools();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileDevice(isMobile());
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDark]);

  // 小窗模式根节点 class：与 dark class 同款机制，供 P2 页面级 CSS 覆写兜底使用
  const windowMode = useWindowModeStore((s) => s.mode);
  useEffect(() => {
    // isDesktopApp 定义在 isInitialized 早退之后，此处用 isElectron()（环境恒定，无碍）
    document.documentElement.classList.toggle('compact-mode', isElectron() && windowMode === 'compact');
  }, [windowMode]);

  // 边缘吸附停靠态：光标跨越窗口边界时通知主进程（mouseleave → 延迟折叠 / mouseenter → 取消折叠、提示条即时展开）；
  // IME 组合态同步（compositionstart/end）：输入中主进程抑制自动折叠，避免候选窗夺焦或光标在外时窗口被收回
  useEffect(() => {
    if (!isElectron() || !window.electron?.edgeSnapCursorLeft) return undefined;
    const { edgeSnapCursorLeft, edgeSnapCursorEnter, edgeSnapImeState } = window.electron;
    const handleCompositionStart = () => edgeSnapImeState?.(true);
    const handleCompositionEnd = () => edgeSnapImeState?.(false);
    document.addEventListener('mouseleave', edgeSnapCursorLeft);
    document.addEventListener('mouseenter', edgeSnapCursorEnter);
    document.addEventListener('compositionstart', handleCompositionStart);
    document.addEventListener('compositionend', handleCompositionEnd);
    return () => {
      document.removeEventListener('mouseleave', edgeSnapCursorLeft);
      document.removeEventListener('mouseenter', edgeSnapCursorEnter);
      document.removeEventListener('compositionstart', handleCompositionStart);
      document.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, []);

  useEffect(() => {
    const handleSettingChanged = (setting: { name: string; value: unknown }) => {
      if (setting.name === 'isMenuVisible') {
        setVisible(setting.value !== 0);
      } else if (setting.name === 'leftMenuPosition') {
        setPosition(setting.value as 'left' | 'right');
      } else if (setting.name === 'systemTheme') {
        setTheme(setting.value === 'dark' || (setting.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
      }
    };

    window.electron?.onSettingChanged(handleSettingChanged);

    return () => {
      window.electron?.onSettingChanged(() => {});
    };
  }, [setVisible, setPosition, setTheme]);

  useEffect(() => {
    const initialize = async () => {
      try {
        // 启动网络可达性监控
        startNetworkMonitor();

        // 桌面端：优先应用用户自定义的 Supabase 和加密密钥配置
        if (isElectron() && window.electron?.getSettings) {
          try {
            const settings = await window.electron.getSettings();
            const sc = settings.find(s => s.name === 'supabaseConfig')?.value as { url?: string; anonKey?: string } | undefined;
            if (sc?.url && sc?.anonKey) {
              reinitSupabase(sc.url, sc.anonKey);
            }
            const customKey = settings.find(s => s.name === 'encryptionKey')?.value as string | undefined;
            if (customKey) {
              setEncryptionKey(customKey);
            }
            // 窗口模式回流：getSettings 本就随初始化调用一次，带出上次模式，首帧即按正确布局渲染（无闪烁）
            const winMode = settings.find(s => s.name === 'windowMode')?.value;
            useWindowModeStore.getState().hydrate(winMode === 'compact' ? 'compact' : 'large');
          } catch (error) {
            logError('加载桌面端自定义配置失败', 'App', error as Error);
          }
        }

        if (validateEncryptionKey()) {
          logInfo('加密密钥加载成功', 'App');
        } else {
          logError('加密密钥加载失败，桌面端请在设置中配置', 'App');
        }

        useAuthStore.getState().getCurrentUser().catch(() => {
          logError('初始化认证状态失败', 'App');
        });

        if (isElectron() && window.electron?.plugin?.getInstalled) {
          try {
            await window.electron.plugin.getInstalled();
          } catch (error) {
            logError('获取插件列表失败', 'App', error as Error);
          }
        }

        // 预加载网址导航数据：走 React Query 预取，与 NavPage 共用 queryKey，
        // 用户切到该页时直接命中缓存（不进 React Query 的话 NavPage 仍会独立再请求一次）
        void queryClient.prefetchQuery(websiteCategoriesQuery);
        void queryClient.prefetchQuery(websiteBookmarksQuery);
      } catch (error) {
        logError('初始化失败', 'App', error as Error);
      } finally {
        setIsInitialized(true);
      }
    };

    initialize();
  }, [queryClient]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const loadSyncMetadata = async () => {
      try {
        const metadata = await syncManager.getSyncMetadata(user.id);
        if (metadata) {
          setSyncEnabled(metadata.syncEnabled);
          setStorageLocation(metadata.storageLocation);
          if (metadata.syncModules && metadata.syncModules.length > 0) {
            const validKeys = ['account', 'todo', 'quickReply', 'clipboard', 'memo', 'reminder'] as const;
            setSyncModules(metadata.syncModules.filter(m => validKeys.includes(m.key)));
          }
          if (metadata.lastSyncTime !== '1970-01-01T00:00:00Z') {
            setLastSyncTime(metadata.lastSyncTime);
          }
          setSyncOnStartupEnabled(metadata.syncOnStartupEnabled ?? true);
        }
      } catch (error) {
        logError('加载同步配置失败', 'App', error as Error);
      }
    };

    loadSyncMetadata();

    const timer = setTimeout(() => {
      syncManager.recoverAndSync(user.id);
    }, 2000);

    // 断网恢复在线时先补偿离线变更，再走增量同步
    const handleOnline = () => {
      syncManager.recoverAndSync(user.id);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
    };
  }, [isAuthenticated, user?.id, setSyncEnabled, setStorageLocation, setSyncModules, setLastSyncTime, setSyncOnStartupEnabled]);

  // 提醒弹窗是主进程创建的独立 BrowserWindow，与主窗口无任何关联：
  // 不进入下面的初始化等待（鉴权/插件/预取均为网络或 IPC 耗时操作），
  // 也不挂载 Router 与各 Provider，收到 show-reminder 即刻渲染。
  // 此处位于全部 hooks 之后，条件返回不影响 hooks 调用顺序。
  if (isStandaloneReminderPopup()) {
    return (
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-bg-primary">
            <LoadingSpinner size="md" />
          </div>
        }
      >
        <ReminderPopup />
      </Suspense>
    );
  }

  // 只等本地初始化完成；鉴权是网络请求，不能阻塞首屏（首页是公开路由，不依赖登录态）
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const isDesktopApp = isElectron();
  const isWebApp = !isDesktopApp && !isMobileDevice;
  // 小窗模式：仅 Electron 生效；路由仍走 desktopRoutes，保证桌面路由全部可达
  const isCompact = isDesktopApp && windowMode === 'compact';

  const currentRoutes = isDesktopApp ? desktopRoutes : isWebApp ? webRoutes : mobileRoutes;

  // 根据平台选择布局组件
  const getLayoutComponent = () => {
    if (isStandaloneWindow()) return null;
    if (isCompact) return CompactLayout;
    if (isDesktopApp) return Layout;
    if (isWebApp) return WebLayout;
    return MobileLayout;
  };

  const LayoutComponent = getLayoutComponent();

  return (
    <ErrorBoundary>
      <QueryProvider>
        <Router>
          <NavSearchProvider>
          {isDesktopApp && !isStandaloneWindow() && <TrayNavigationHandler />}
              <Routes>
                <Route
                  path="/*"
                  element={
                    <>
                      {isStandaloneLogWindow() ? (
                        <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner size="md" /></div>}>
                          <Routes>
                            <Route path="/logs" element={<LogsPage />} />
                          </Routes>
                        </Suspense>
                      ) : (
                        renderRoutes(currentRoutes, isAuthenticated, isAdmin || false, LayoutComponent, isLoading)
                      )}
                      <Toast />
                      <PluginPanels />
                    </>
                  }
                />
              </Routes>
          </NavSearchProvider>
        </Router>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
