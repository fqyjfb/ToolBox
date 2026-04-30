import React from 'react';
import Sidebar from '../Sidebar';
import Content from '../Content';
import { useSidebarStore } from '../../store/sidebarStore';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { position: sidebarPosition } = useSidebarStore();

  return (
    <div className={`flex h-screen overflow-hidden ${sidebarPosition === 'right' ? 'flex-row-reverse' : ''}`}>
      <Sidebar />
      <Content>
        {children}
      </Content>
    </div>
  );
};

export default Layout;