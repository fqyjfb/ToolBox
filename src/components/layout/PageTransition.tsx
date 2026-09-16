import React from 'react';
import { useLocation } from 'react-router-dom';
import { isElectron } from '../../utils/environment';
import './PageTransition.css';

interface PageTransitionProps {
  children: React.ReactNode;
}

// 桌面端页面切换动画：以 location.pathname 为重挂载 key，用 CSS keyframes 播统一的
// 进入动画（微缩放 + 位移 + 渐显）；外层固定尺寸 + overflow-hidden，避免动画期间出现滚动条。
const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();
  const enabled = isElectron();

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div className="page-transition-viewport" key={location.pathname}>
      <div className="page-transition-inner">
        {children}
      </div>
    </div>
  );
};

export default React.memo(PageTransition);
