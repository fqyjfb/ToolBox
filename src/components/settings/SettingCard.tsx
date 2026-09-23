import React from 'react';

interface SettingCardProps {
  children: React.ReactNode;
  className?: string;
}

const SettingCard: React.FC<SettingCardProps> = ({ children, className = '' }) => {
  return (
    <div className={`rounded-lg ${className}`} style={{ background: 'color-mix(in srgb, var(--color-card) 60%, transparent)' }}>
      {children}
    </div>
  );
};

export default SettingCard;