import React from 'react';

interface SettingSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const SettingSection: React.FC<SettingSectionProps> = ({ title, subtitle, icon, children }) => {
  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 settings-section-header">
        <div className="flex items-center gap-2">
          {icon && <span className="text-primary flex-shrink-0">{icon}</span>}
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
            {subtitle && (
              <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      <div className="divide-y divide-border">
        {children}
      </div>
    </div>
  );
};

export default SettingSection;