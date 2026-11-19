import React, { useEffect, useState, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate as useRouterNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import Layout from './components/layout/Layout';
import WebLayout from './components/layout/WebLayout';
import MobileLayout from './components/layout/MobileLayout';
import CompactLayout from './components/layout/CompactLayout';
import Toast from './components/ui/Toast';
import SelectionToolbar from './components/SelectionToolbar';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import PluginPanels from './components/plugins/PluginPanels';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/AuthStore';
import { useSidebarStore } from './store/sidebarStore';
import { useWindowModeStore } from './store/windowModeStore';
import { useSyncStore } from './store/syncStore';
import { useToastStore } from './store/toastStore';
import { logError, logInfo } from './services/loggerService';
import { syncManager } from './services/syncManager';
import { startNetworkMonitor } from './services/networkMonitor';
import { validateEncryptionKey, setEncryptionKey } from './utils/crypto';
import { reinitSupabase } from './services/supabase';
import { iconResolver } from './services/iconResolver';
import { NavSearchProvider } from './contexts/NavSearchContext';
import { desktopRoutes, webRoutes, mobileRoutes, protectedRoutes, adminRoutes, RouteConfig } from './config/routes';
import { useQueryClient } from '@tanstack/react-query';
import { websiteBookmarksQuery, websiteCategoriesQuery } from './services/websiteQueries';
const LogsPage = React.lazy(() => import('./pages/logs/index'));
const ReminderPopup = React.lazy(() => import('./pages/tools/reminder/ReminderPopup'));
const StickyNoteWall = React.lazy(() => import('./pages/tools/sticky-note/StickyNoteWall'));
import { isElectron } from './utils/environment';
import { usePreloadTools } from './hooks/usePreloadTools';
import { useFloatAiActions } from './hooks/useFloatAiActions';
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

// 路由级错误边界：单页渲染抛错只降级当前路由区域（保留侧栏导航，可重试/回首页），
// 不再击穿根边界导致全窗口白屏。切到其它路由时 children 变化，边界自动复位。
const RouteBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary showGoHome>{children}</ErrorBoundary>
);

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
      element={<RouteBoundary>{route.element}</RouteBoundary>}
    />
  ));

  const protectedRouteElements = protectedRoutes.map((route) => (
    <Route
      key={route.path}
      path={route.path}
      element={
        route.requiresAdmin ? (
          <ProtectedRoute isAuthenticated={isAuthenticated} requiresAdmin={route.requiresAdmin} isAdmin={isAdmin} isAuthLoading={isAuthLoading}>
            <RouteBoundary>{route.element}</RouteBoundary>
          </ProtectedRoute>
        ) : route.requiresAuth ? (
          <ProtectedRoute isAuthenticated={isAuthenticated} requiresAdmin={route.requiresAdmin} isAuthLoading={isAuthLoading}>
            <RouteBoundary>{route.element}</RouteBoundary>
          </ProtectedRoute>
        ) : (
          <RouteBoundary>{route.element}</RouteBoundary>
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
          <RouteBoundary>{route.element}</RouteBoundary>
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

    // onNavigate 返回退订函数（多播），卸载时正确退订
    const unsubscribe = window.electron?.onNavigate(handleNavigate);

    return () => {
      unsubscribe?.();
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

// 便签墙：独立 BrowserWindow 加载 ?standalone=sticky-wall
const isStandaloneStickyWall = (): boolean => getStandaloneMode() === 'sticky-wall';

const isStandaloneWindow = (): boolean =>
  isStandaloneLogWindow() || isStandaloneReminderPopup() || isStandaloneStickyWall();

function App() {
  const queryClient = useQueryClient();
  const { setBaseTheme } = useThemeStore(useShallow((s) => ({ setBaseTheme: s.setBaseTheme })));
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
  const addToast = useToastStore((state) => state.addToast);
  const [isInitialized, setIsInitialized] = useState(false);
  const [startupIssue, setStartupIssue] = useState<string | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  // 划词工具条开关：初始化读设置（未落库默认开启），onSettingChanged 实时同步
  const [isSelectionToolbarEnabled, setIsSelectionToolbarEnabled] = useState(true);
  const { setVisible, setPosition } = useSidebarStore(useShallow((s) => ({ setVisible: s.setVisible, setPosition: s.setPosition })));

  usePreloadTools();
  useFloatAiActions();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileDevice(isMobile());
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
        // 主进程会回广播自己刚收到的 systemTheme。这里只能用 setBaseTheme：
        // setTheme 会 switchToPreset 清掉自定义注入、改写 THEME 并删除主题快照。
        // setBaseTheme 在基色相同时早退，同值回广播无副作用；外部来源则只调整基色。
        setBaseTheme(setting.value === 'dark' || (setting.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
      } else if (setting.name === 'isSelectionToolbarEnabled') {
        setIsSelectionToolbarEnabled(setting.value !== 0 && setting.value !== false);
      }
    };

    const unsubscribeSettingChanged = window.electron?.onSettingChanged(handleSettingChanged);

    return () => {
      // 正确退订：原先注册一个空函数会把 baseApi / PluginService 的回调一起顶掉，
      // 导致改了 networkConfig 后它们的缓存失效回调从未生效。
      if (typeof unsubscribeSettingChanged === 'function') {
        unsubscribeSettingChanged();
      }
    };
  }, [setVisible, setPosition, setBaseTheme]);

  useEffect(() => {
    // 网络监控幂等：返回 stop 供 effect cleanup 使用，避免 StrictMode/重入时重复注册。
    const stopMonitor = startNetworkMonitor();
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
            // 窗口模式回流：getSettings 本就随初始化调用一次，带出上次模式，首帧即按正确布局渲染（无闪烁）
            const winMode = settings.find(s => s.name === 'windowMode')?.value;
            useWindowModeStore.getState().hydrate(winMode === 'compact' ? 'compact' : 'large');
            // 划词工具条开关：设置未落库时默认开启
            const selectionRaw = settings.find(s => s.name === 'isSelectionToolbarEnabled')?.value;
            setIsSelectionToolbarEnabled(selectionRaw === undefined || (selectionRaw !== 0 && selectionRaw !== false));
          } catch (error) {
            logError('加载桌面端自定义配置失败', 'App', error as Error);
            setStartupIssue('读取本地配置失败，已按默认配置启动');
          }
        }

        if (validateEncryptionKey()) {
          logInfo('加密密钥加载成功', 'App');
        } else {
          logError('加密密钥加载失败，桌面端请在设置中配置', 'App');
        }

        useAuthStore.getState().getCurrentUser().catch((error: unknown) => {
          logError('初始化认证状态失败', 'App', error as Error);
          setStartupIssue('登录状态恢复失败，请重新登录');
          addToast({ message: '登录状态恢复失败，请重新登录', type: 'error' });
        });

        // 该调用的作用仅是让主进程扫描一次已安装插件目录；返回值在此处并不使用：
        // 侧边栏插件项由 pluginStore 从 localStorage 恢复首帧内容，插件商店页会自行刷新 store。
        // 因此不 await —— 避免一次目录扫描阻塞首屏初始化。
        const getInstalledPlugins = window.electron?.plugin?.getInstalled;
        if (isElectron() && getInstalledPlugins) {
          // 目录扫描 + 图标补齐不阻塞首屏：放到空闲期执行。
          const scanInstalledPlugins = () => {
            getInstalledPlugins().catch((error: unknown) => {
              logError('获取插件列表失败', 'App', error as Error);
            });
          };
          if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(scanInstalledPlugins, { timeout: 5000 });
          } else {
            setTimeout(scanInstalledPlugins, 0);
          }
        }

        // 预加载网址导航数据：走 React Query 预取，与 NavPage 共用 queryKey，
        // 用户切到该页时直接命中缓存（不进 React Query 的话 NavPage 仍会独立再请求一次）
        void queryClient.prefetchQuery(websiteCategoriesQuery);
        const bookmarksPrefetch = queryClient.prefetchQuery(websiteBookmarksQuery);
        void bookmarksPrefetch;

        // 书签落地后批量预热图标：命中磁盘缓存时一次 IPC 即可回填渲染层同步表，
        // 不阻塞首屏；失败时 NavPage 的 CachedIcon 仍按原链路解析并回退默认图。
        if (isElectron()) {
          void bookmarksPrefetch.then(() => {
            const bookmarks = queryClient.getQueryData<Array<{ ico_url?: string | null }>>(websiteBookmarksQuery.queryKey);
            const urls = (bookmarks || [])
              .map((bookmark) => bookmark.ico_url)
              .filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url));
            if (urls.length === 0) return;
            const warm = () => void iconResolver.ensure(urls, 'general');
            if (typeof window.requestIdleCallback === 'function') {
              window.requestIdleCallback(warm, { timeout: 3000 });
            } else {
              setTimeout(warm, 0);
            }
          }).catch(() => { /* 预取失败不改变图标回退行为 */ });
        }
      } catch (error) {
        logError('初始化失败', 'App', error as Error);
      } finally {
        setIsInitialized(true);
      }
    };

    initialize();
    return stopMonitor;
  }, [queryClient, addToast]);

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
        <RouteBoundary>
          <ReminderPopup />
        </RouteBoundary>
      </Suspense>
    );
  }

  if (isStandaloneStickyWall()) {
    return (
      <Suspense fallback={<div className="sticky-wall" />}>
        <RouteBoundary>
          <StickyNoteWall />
        </RouteBoundary>
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
      <Router>
        <NavSearchProvider>
          {startupIssue && (
            <div className="flex items-center justify-center gap-3 px-4 py-2 bg-toast-warning-bg text-toast-warning-text text-xs border-b border-toast-warning-border">
              <span>{startupIssue}</span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-2 py-0.5 rounded border border-toast-warning-border hover:brightness-110"
              >
                重试
              </button>
              <button
                type="button"
                onClick={() => setStartupIssue(null)}
                className="px-2 py-0.5 rounded hover:brightness-110"
                aria-label="忽略启动提示"
              >
                忽略
              </button>
            </div>
          )}
          {isDesktopApp && !isStandaloneWindow() && <TrayNavigationHandler />}
          <Routes>
            <Route
              path="/*"
              element={
                <>
                  {isStandaloneLogWindow() ? (
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner size="md" /></div>}>
                      <Routes>
                        <Route path="/logs" element={<RouteBoundary><LogsPage /></RouteBoundary>} />
                      </Routes>
                    </Suspense>
                  ) : (
                    renderRoutes(currentRoutes, isAuthenticated, isAdmin || false, LayoutComponent, isLoading)
                  )}
                  <Toast />
                  {isDesktopApp && !isStandaloneWindow() && (
                    <SelectionToolbar enabled={isSelectionToolbarEnabled} />
                  )}
                  <PluginPanels />
                </>
              }
            />
          </Routes>
        </NavSearchProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
