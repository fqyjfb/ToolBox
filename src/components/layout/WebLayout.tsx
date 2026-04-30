import React from 'react';

interface WebLayoutProps {
  children: React.ReactNode;
}

const WebLayout: React.FC<WebLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {children}
    </div>
  );
};

export default WebLayout;