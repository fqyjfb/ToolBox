import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/AuthStore';

// 需要登录才能访问的工具页统一守卫：未登录时跳转登录页，避免停留在空白页面。
// 返回当前登录态，供页面在跳转生效前先不渲染业务内容。
// 说明：src/App.tsx 的 ProtectedRoute 因未受保护的同 path 路由先渲染而不生效，
// 各页面仍需自行守卫，此处收敛为该守卫的唯一实现，避免每个页面各写一份。
export const useRequireAuth = (): boolean => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  return isAuthenticated;
};
