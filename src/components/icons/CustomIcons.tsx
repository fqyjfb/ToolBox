import React from 'react';
import { iconDataList } from './iconData';

/* eslint-disable react-refresh/only-export-components */
interface CustomIconProps {
  size?: number;
  className?: string;
}

export const customSvgIconMap: Record<string, React.ComponentType<CustomIconProps>> = {};

iconDataList.forEach((item) => {
  const IconComponent: React.FC<CustomIconProps> = ({ size = 20, className = '' }) => (
    <span 
      className={`icon ${className}`} 
      style={{ width: size, height: size, display: 'inline-block' }}
      dangerouslySetInnerHTML={{ __html: item.svg }}
    />
  );
  customSvgIconMap[item.name] = IconComponent;
});

export const InfoIcon = customSvgIconMap['Info'];