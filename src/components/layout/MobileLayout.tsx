import React from 'react';
import MobileNavbar from './MobileNavbar';

interface MobileLayoutProps {
  children: React.ReactNode;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <MobileNavbar />
      <main className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-3)', paddingBottom: 'var(--mobile-bottom-nav-height)' }}>
        {children}
      </main>
    </div>
  );
};

export default MobileLayout;