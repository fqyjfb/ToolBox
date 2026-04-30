import React from 'react';
import WebNavbar from './WebNavbar';

interface WebLayoutProps {
  children: React.ReactNode;
}

const WebLayout: React.FC<WebLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <WebNavbar />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>ToolBox Web Edition - 高效便捷的在线工具平台</p>
            <p className="mt-1">© 2024 ToolBox. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WebLayout;