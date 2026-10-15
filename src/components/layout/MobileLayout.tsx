import React from 'react';
import MobileNavbar from './MobileNavbar';
import OfflineBanner from './OfflineBanner';

interface MobileLayoutProps {
  children: React.ReactNode;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <OfflineBanner />
      <MobileNavbar />
      <main className="flex-1 overflow-y-auto scrollbar-5px" style={{ padding: 'var(--space-3)', paddingBottom: 'var(--mobile-bottom-nav-height)' }}>
        {children}
      </main>
    </div>
  );
};

export default MobileLayout;