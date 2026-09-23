import React from 'react';

interface SettingRowProps {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, children, className = '' }) => {
  return (
    <div className={`flex items-center justify-between px-4 py-2 hover:bg-menu-hover ${className}`}>
      <div className="text-sm text-content-primary">{label}</div>
      {children}
    </div>
  );
};

export default SettingRow;