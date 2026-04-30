import React from 'react';
import MobileNavbar from './MobileNavbar';

interface MobileLayoutProps {
  children: React.ReactNode;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <MobileNavbar />
      <main className="px-4 py-4">
        {children}
      </main>
    </div>
  );
};

export default MobileLayout;