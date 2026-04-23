import { useEffect, useState, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate as useRouterNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Toast from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/AuthStore';
import { NavSearchProvider } from './contexts/NavSearchContext';
import { TodoNotificationProvider } from './contexts/TodoNotificationContext';
import { publicRoutes, protectedRoutes, adminRoutes } from './config/routes';

const TrayNavigationHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  return <>{children}</>;
};

function App() {
  const { isDark } = useThemeStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const admin = useAuthStore((state) => state.admin);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [isInitialized, setIsInitialized] = useState(false);
  const isAdmin = admin && (admin.role === 'super' || admin.role === 'normal');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

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

  return (
    <TodoNotificationProvider>
      <NavSearchProvider>
        <Router>
          <TrayNavigationHandler>
            <Routes>
              <Route 
                path="/*" 
                element={
                <div>
                    <Layout>
                      <Suspense fallback={<div className="flex items-center justify-center h-full"><LoadingSpinner size="md" /></div>}>
                        <Routes>
                          {publicRoutes.map((route) => (
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
                    <Toast />
                  </div>
              } 
            />
          </Routes>
        </TrayNavigationHandler>
        </Router>
      </NavSearchProvider>
    </TodoNotificationProvider>
  );
}

export default App;