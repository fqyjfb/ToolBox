import React, { useEffect, useState, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate as useRouterNavigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import WebLayout from './components/layout/WebLayout';
import MobileLayout from './components/layout/MobileLayout';
import Toast from './components/ui/Toast';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/AuthStore';
import { useSidebarStore } from './store/sidebarStore';
import { logError, logInfo } from './services/loggerService';
import { syncManager } from './services/syncManager';
import { NavSearchProvider } from './contexts/NavSearchContext';
import { TodoNotificationProvider } from './contexts/TodoNotificationContext';
import { desktopRoutes, webRoutes, mobileRoutes, protectedRoutes, adminRoutes, RouteConfig } from './config/routes';
const LogsPage = React.lazy(() => import('./pages/logs/index'));
import { isElectron } from './utils/environment';
import { usePreloadTools } from './hooks/usePreloadTools';

// 路由保护组件
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  isAuthenticated: boolean;
  isAdmin?: boolean;
}> = ({ children, isAuthenticated, isAdmin }) => {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isAdmin === false) return <Navigate to="/" replace />;
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
          <ProtectedRoute isAuthenticated={isAuthenticated} isAdmin={isAdmin}>
            {route.element}
          </ProtectedRoute>
        ) : route.requiresAuth ? (
          <ProtectedRoute isAuthenticated={isAuthenticated} isAdmin={isAdmin}>
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

const isMobile = (): boolean => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 768;
  }
  return false;
};

function App() {
  const { isDark, setTheme } = useThemeStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const admin = useAuthStore((state) => state.admin);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const isAdmin = admin && (admin.role === 'super' || admin.role === 'normal');
  const { setVisible, setPosition } = useSidebarStore();

  // 预加载常用工具页面
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
        await useAuthStore.getState().getCurrentAdmin();
      } catch (error) {
        logError('初始化认证状态失败', 'App', error as Error);
      } finally {
        setIsInitialized(true);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !admin?.id) return;

    const performSync = async () => {
      const storageLocation = useThemeStore.getState().storageLocation;
      const syncEnabled = useThemeStore.getState().syncEnabled;

      if (storageLocation !== 'cloud' || !syncEnabled) {
        return;
      }

      try {
        const hasUpdates = await syncManager.hasCloudUpdates(admin.id);
        if (!hasUpdates) {
          return;
        }
        
        await syncManager.syncAll(admin.id, true);
        useThemeStore.getState().setLastSyncTime(new Date().toISOString());
        logInfo('静默同步完成', 'App');
      } catch (error) {
        logError('静默同步失败', 'App', error as Error);
      }
    };

    performSync();
  }, [isAuthenticated, admin?.id]);

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
    <TodoNotificationProvider>
      <NavSearchProvider>
        <Router>
          {isDesktopApp && !isStandaloneLogWindow() && <TrayNavigationHandler>{/* Tray navigation handler */}</TrayNavigationHandler>}
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
                </>
              }
            />
          </Routes>
        </Router>
      </NavSearchProvider>
    </TodoNotificationProvider>
  );
}

export default App;
