import React from 'react';

interface SettingSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const SettingSection: React.FC<SettingSectionProps> = ({ title, subtitle, children }) => {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {children}
      </div>
    </div>
  );
};

export default SettingSection;