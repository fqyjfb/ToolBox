import React, { useEffect, useState, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate as useRouterNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import Layout from './components/layout/Layout';
import WebLayout from './components/layout/WebLayout';
import MobileLayout from './components/layout/MobileLayout';
import Toast from './components/ui/Toast';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import PluginPanels from './components/plugins/PluginPanels';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/AuthStore';
import { useSidebarStore } from './store/sidebarStore';
import { useSyncStore } from './store/syncStore';
import { logError, logInfo } from './services/loggerService';
import { syncManager } from './services/syncManager';
import { validateEncryptionKey, setEncryptionKey } from './utils/crypto';
import { reinitSupabase } from './services/supabase';
import { NavSearchProvider } from './contexts/NavSearchContext';
import { TodoNotificationProvider } from './contexts/TodoNotificationContext';
import { desktopRoutes, webRoutes, mobileRoutes, protectedRoutes, adminRoutes, RouteConfig } from './config/routes';
import { QueryProvider } from './providers/QueryProvider';
import { websiteService } from './services/WebsiteService';
const LogsPage = React.lazy(() => import('./pages/logs/index'));
import { isElectron } from './utils/environment';
import { usePreloadTools } from './hooks/usePreloadTools';
import { RecentToolsHandler } from './hooks/useRecentTools';
import { pluginApi } from './services/pluginApi';

// 路由保护组件
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  isAuthenticated: boolean;
  requiresAdmin?: boolean;
  isAdmin?: boolean;
}> = ({ children, isAuthenticated, requiresAdmin, isAdmin }) => {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiresAdmin && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// 渲染路由列表
const renderRoutes = (
  routes: RouteConfig[],
  isAuthenticated: boolean,
  isAdmin: boolean,
  LayoutComponent: React.ComponentType<{ children: React.ReactNode }> | null
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
          <ProtectedRoute isAuthenticated={isAuthenticated} requiresAdmin={route.requiresAdmin} isAdmin={isAdmin}>
            {route.element}
          </ProtectedRoute>
        ) : route.requiresAuth ? (
          <ProtectedRoute isAuthenticated={isAuthenticated} requiresAdmin={route.requiresAdmin}>
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

const PluginLaunchHandler: React.FC = () => {
  useEffect(() => {
    const handleLaunchPlugin = (pluginId: string) => {
      pluginApi.openPluginWindow(pluginId);
    };

    window.electron?.onLaunchPlugin?.(handleLaunchPlugin);

    return () => {
      window.electron?.onLaunchPlugin?.(() => {});
    };
  }, []);

  return null;
};

const isMobile = (): boolean => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 768;
  }
  return false;
};

function App() {
  const { isDark, setTheme } = useThemeStore(useShallow((s) => ({ isDark: s.isDark, setTheme: s.setTheme })));
  const { setLastSyncTime, setStorageLocation, setSyncEnabled, setSyncModules, setSyncOnStartupEnabled } = useSyncStore();
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

        // 预加载网址导航数据，用户导航到该页面时数据已在缓存中
        websiteService.getCategories().catch(() => {
          // 忽略预加载错误
        });
        websiteService.getPublicBookmarks().catch(() => {
          // 忽略预加载错误
        });
      } catch (error) {
        logError('初始化失败', 'App', error as Error);
      } finally {
        setIsInitialized(true);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const loadSyncMetadata = async () => {
      try {
        const metadata = await syncManager.getSyncMetadata(user.id);
        if (metadata) {
          setSyncEnabled(metadata.syncEnabled);
          setStorageLocation(metadata.storageLocation);
          if (metadata.syncModules && metadata.syncModules.length > 0) {
            const validKeys = ['account', 'todo', 'quickReply', 'clipboard', 'memo'] as const;
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
      syncManager.syncOnStartup(user.id);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user?.id, setSyncEnabled, setStorageLocation, setSyncModules, setLastSyncTime, setSyncOnStartupEnabled]);

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-800">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const isDesktopApp = isElectron();
  const isWebApp = !isDesktopApp && !isMobileDevice;

  const currentRoutes = isDesktopApp ? desktopRoutes : isWebApp ? webRoutes : mobileRoutes;

  const isStandaloneLogWindow = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('standalone') === 'logs';
    }
    return false;
  };

  // 根据平台选择布局组件
  const getLayoutComponent = () => {
    if (isStandaloneLogWindow()) return null;
    if (isDesktopApp) return Layout;
    if (isWebApp) return WebLayout;
    return MobileLayout;
  };

  const LayoutComponent = getLayoutComponent();

  return (
    <ErrorBoundary>
      <TodoNotificationProvider>
        <NavSearchProvider>
          <QueryProvider>
            <Router>
            {isDesktopApp && !isStandaloneLogWindow() && <TrayNavigationHandler>{/* Tray navigation handler */}</TrayNavigationHandler>}
            {isDesktopApp && !isStandaloneLogWindow() && <PluginLaunchHandler />}
            <RecentToolsHandler />
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
                      renderRoutes(currentRoutes, isAuthenticated, isAdmin || false, LayoutComponent)
                    )}
                    <Toast />
                    <PluginPanels />
                  </>
                }
              />
            </Routes>
          </Router>
          </QueryProvider>
        </NavSearchProvider>
      </TodoNotificationProvider>
    </ErrorBoundary>
  );
}

export default App;
