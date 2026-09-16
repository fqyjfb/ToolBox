import React from 'react';

interface SettingRowProps {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, children, className = '' }) => {
  return (
    <div className={`flex items-center justify-between px-4 py-2 hover:bg-bg-secondary ${className}`}>
      <div className="text-sm text-gray-700 dark:text-gray-300">{label}</div>
      {children}
    </div>
  );
};

export default SettingRow;