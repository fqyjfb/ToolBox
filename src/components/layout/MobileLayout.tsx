import React from 'react';
import MobileNavbar from './MobileNavbar';

interface MobileLayoutProps {
  children: React.ReactNode;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-secondary)', paddingBottom: 'calc(var(--space-8) + var(--space-3))' }}>
      <MobileNavbar />
      <main style={{ padding: 'var(--space-3)' }}>
        {children}
      </main>
    </div>
  );
};

export default MobileLayout;