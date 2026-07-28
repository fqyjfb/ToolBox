import React, { useState, useEffect, useCallback } from 'react';
import { iconCacheService, IconCacheType } from '../../services/iconCacheService';

interface CachedPluginIconProps {
  url: string;
  name: string;
  type?: IconCacheType;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

const CachedPluginIcon: React.FC<CachedPluginIconProps> = ({
  url,
  name,
  type = 'plugin',
  className = '',
  fallbackIcon
}) => {
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const loadIcon = useCallback(async () => {
    if (!url) {
      setHasError(true);
      return;
    }

    try {
      const cached = await iconCacheService.get(url, type);
      if (cached) {
        const blob = await cached.blob();
        const objectUrl = URL.createObjectURL(blob);
        setIconUrl(objectUrl);
        return;
      }

      const response = await fetch(url);
      if (response.ok) {
        await iconCacheService.set(url, response.clone(), type);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setIconUrl(objectUrl);
      } else {
        setHasError(true);
      }
    } catch {
      setHasError(true);
    }
  }, [url, type]);

  useEffect(() => {
    loadIcon();
  }, [loadIcon]);

  useEffect(() => {
    return () => {
      if (iconUrl) {
        URL.revokeObjectURL(iconUrl);
      }
    };
  }, [iconUrl]);

  if (hasError || !iconUrl) {
    return <>{fallbackIcon}</>;
  }

  return (
    <img
      src={iconUrl}
      alt={name}
      className={className}
      onError={() => setHasError(true)}
    />
  );
};

export default CachedPluginIcon;
