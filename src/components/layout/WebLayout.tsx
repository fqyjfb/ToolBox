import React from 'react';
import WebNavbar from './WebNavbar';

interface WebLayoutProps {
  children: React.ReactNode;
}

const WebLayout: React.FC<WebLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <WebNavbar />
      <main className="max-w-7xl mx-auto" style={{ padding: 'var(--space-4)', paddingTop: 'var(--space-3)' }}>
        {children}
      </main>
      <footer style={{ marginTop: 'var(--space-5)', padding: 'var(--space-4)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            <p>ToolBox Web Edition - 高效便捷的在线工具平台</p>
            <p style={{ marginTop: 'var(--space-1)' }}>© 2026 ToolBox. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WebLayout;