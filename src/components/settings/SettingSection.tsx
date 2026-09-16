import React from 'react';

interface SettingSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const SettingSection: React.FC<SettingSectionProps> = ({ title, subtitle, children }) => {
  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between px-4 py-3 bg-bg-secondary">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {subtitle && (
            <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="divide-y divide-border">
        {children}
      </div>
    </div>
  );
};

export default SettingSection;