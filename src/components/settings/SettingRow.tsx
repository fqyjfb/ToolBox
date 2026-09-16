import React from 'react';

interface SettingRowProps {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, children, className = '' }) => {
  return (
    <div className={`flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${className}`}>
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      {children}
    </div>
  );
};

export default SettingRow;