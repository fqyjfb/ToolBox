import React from 'react';
import { iconDataList, getIconSvgByName } from './iconData';

/* eslint-disable react-refresh/only-export-components */
interface CustomIconProps {
  size?: number;
  className?: string;
}

export const CustomIcon: React.FC<{ name: string } & CustomIconProps> = ({ name, size = 20, className = '' }) => {
  const svgString = getIconSvgByName(name);
  return (
    <span 
      className={`custom-icon ${className}`} 
      style={{ width: size, height: size, display: 'inline-block' }}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
};

export const iconMap: Record<string, React.ComponentType<CustomIconProps>> = {};

iconDataList.forEach((item) => {
  const IconComponent: React.FC<CustomIconProps> = ({ size = 20, className = '' }) => (
    <span 
      className={`icon ${className}`} 
      style={{ width: size, height: size, display: 'inline-block' }}
      dangerouslySetInnerHTML={{ __html: item.svg }}
    />
  );
  iconMap[item.name] = IconComponent;
});

export const InfoIcon = iconMap['Info'];