import React from 'react';
import Sidebar from './Sidebar';
import Content from './Content';
import OfflineBanner from './OfflineBanner';
import { useSidebarStore } from '../../store/sidebarStore';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const sidebarPosition = useSidebarStore((s) => s.position);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <OfflineBanner />
      <div className={`flex flex-1 min-h-0 overflow-hidden ${sidebarPosition === 'right' ? 'flex-row-reverse' : ''}`}>
        <Sidebar />
        <Content>
          {children}
        </Content>
      </div>
    </div>
  );
};

export default Layout;