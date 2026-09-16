import React from 'react';

interface SettingCardProps {
  children: React.ReactNode;
  className?: string;
}

const SettingCard: React.FC<SettingCardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-card rounded-lg border border-border ${className}`}>
      {children}
    </div>
  );
};

export default SettingCard;