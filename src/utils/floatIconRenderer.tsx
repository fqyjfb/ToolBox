import React from 'react';
import { customSvgIconMap, InfoIcon } from '../components/icons/CustomIcons';
import { AVAILABLE_ICONS } from '../constants/settings';

export const isPredefinedIcon = (icon: string): boolean => {
  return !!icon && AVAILABLE_ICONS.some(i => i.name === icon);
};

export const isPluginIcon = (icon: string): boolean => {
  return !!icon && icon.startsWith('plugin:');
};

export const getPluginIconId = (icon: string): string => {
  if (!isPluginIcon(icon)) return '';
  return icon.substring(7);
};

export const formatIconSrc = (icon: string): string | null => {
  if (icon.startsWith('data:image/')) {
    return icon;
  }
  if (icon && icon.length > 100 && !icon.includes(' ')) {
    return `data:image/png;base64,${icon}`;
  }
  return null;
};

export interface FloatIconRenderResult {
  element: React.ReactNode;
  isImg: boolean;
  iconSrc: string | null;
  isPlugin: boolean;
  pluginId: string;
}

export const renderFloatIcon = (
  icon: string,
  size: number = 18
): FloatIconRenderResult => {
  const isPlugin = isPluginIcon(icon);
  if (isPlugin) {
    const pluginId = getPluginIconId(icon);
    return {
      element: <InfoIcon size={size} />,
      isImg: false,
      iconSrc: null,
      isPlugin: true,
      pluginId
    };
  }

  const isPredefined = isPredefinedIcon(icon);
  const iconSrc = formatIconSrc(icon);
  const isImg = !isPredefined && !!iconSrc;

  if (isImg) {
    return {
      element: (
        <img
          loading="lazy"
          src={iconSrc!}
          alt=""
          style={{ width: size, height: size, objectFit: 'contain', borderRadius: '4px' }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ),
      isImg: true,
      iconSrc,
      isPlugin: false,
      pluginId: ''
    };
  }

  const Icon = customSvgIconMap[isPredefined ? icon : 'HelpCircle'] || InfoIcon;
  return {
    element: <Icon size={size} />,
    isImg: false,
    iconSrc: null,
    isPlugin: false,
    pluginId: ''
  };
};
