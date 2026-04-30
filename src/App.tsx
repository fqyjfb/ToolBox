import { useEffect, useState, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate as useRouterNavigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import WebLayout from './components/layout/WebLayout';
import MobileLayout from './components/layout/MobileLayout';
import Toast from './components/ui/Toast';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/AuthStore';
import { useSidebarStore } from './store/sidebarStore';
import { NavSearchProvider } from './contexts/NavSearchContext';
import { TodoNotificationProvider } from './contexts/TodoNotificationContext';
import { desktopRoutes, webRoutes, mobileRoutes, protectedRoutes, adminRoutes } from './config/routes';
import { isElectron } from './utils/environment';

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
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    const handleSettingChanged = (setting: { name: string; value: any }) => {
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
        console.error('初始化认证状态失败:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    initialize();
  }, []);

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

  return (
    <TodoNotificationProvider>
      <NavSearchProvider>
        <Router>
          {isDesktopApp && <TrayNavigationHandler>{/* Tray navigation handler */}</TrayNavigationHandler>}
          <Routes>
            <Route 
              path="/*" 
              element={
                <>
                  {isDesktopApp ? (
                    <Layout>
                      <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner size="md" /></div>}>
                        <Routes>
                          {currentRoutes.map((route) => (
                            <Route 
                              key={route.path} 
                              path={route.path} 
                              element={route.element} 
                            />
                          ))}

                          {isAuthenticated ? (
                            <>
                              {protectedRoutes.map((route) => (
                                <Route 
                                  key={route.path} 
                                  path={route.path} 
                                  element={route.element} 
                                />
                              ))}
                              {isAdmin && adminRoutes.map((route) => (
                                <Route 
                                  key={route.path} 
                                  path={route.path} 
                                  element={route.element} 
                                />
                              ))}
                              <Route path="*" element={<Navigate to="/" replace />} />
                            </>
                          ) : (
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
                          )}
                        </Routes>
                      </Suspense>
                    </Layout>
                  ) : isWebApp ? (
                    <WebLayout>
                      <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner size="md" /></div>}>
                        <Routes>
                          {currentRoutes.map((route) => (
                            <Route 
                              key={route.path} 
                              path={route.path} 
                              element={route.element} 
                            />
                          ))}

                          {isAuthenticated ? (
                            <>
                              {protectedRoutes.map((route) => (
                                <Route 
                                  key={route.path} 
                                  path={route.path} 
                                  element={route.element} 
                                />
                              ))}
                              {isAdmin && adminRoutes.map((route) => (
                                <Route 
                                  key={route.path} 
                                  path={route.path} 
                                  element={route.element} 
                                />
                              ))}
                              <Route path="*" element={<Navigate to="/" replace />} />
                            </>
                          ) : (
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
                          )}
                        </Routes>
                      </Suspense>
                    </WebLayout>
                  ) : (
                    <MobileLayout>
                      <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner size="md" /></div>}>
                        <Routes>
                          {currentRoutes.map((route) => (
                            <Route 
                              key={route.path} 
                              path={route.path} 
                              element={route.element} 
                            />
                          ))}

                          {isAuthenticated ? (
                            <>
                              {protectedRoutes.map((route) => (
                                <Route 
                                  key={route.path} 
                                  path={route.path} 
                                  element={route.element} 
                                />
                              ))}
                              {isAdmin && adminRoutes.map((route) => (
                                <Route 
                                  key={route.path} 
                                  path={route.path} 
                                  element={route.element} 
                                />
                              ))}
                              <Route path="*" element={<Navigate to="/" replace />} />
                            </>
                          ) : (
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
                          )}
                        </Routes>
                      </Suspense>
                    </MobileLayout>
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