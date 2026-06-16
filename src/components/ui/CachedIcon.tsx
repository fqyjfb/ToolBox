import React, { useState, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { iconCacheService } from '../../services/iconCacheService';

interface CachedIconProps {
  src?: string | null;
  alt: string;
  className?: string;
  defaultIcon?: React.ReactNode;
  onError?: () => void;
}

const getProxiedUrl = (url: string): string => {
  const raw = (url || '').trim();
  if (!raw) return '';
  if (/^(data|blob):/i.test(raw)) return raw;
  
  try {
    return `https://images.weserv.nl/?url=${encodeURIComponent(raw)}`;
  } catch {
    return raw;
  }
};

const CachedIcon: React.FC<CachedIconProps> = ({
  src,
  alt,
  className = '',
  defaultIcon,
  onError
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const previousImageSrc = React.useRef<string | null>(null);

  const fetchImage = useCallback(async () => {
    if (!src || !src.trim()) {
      setImageSrc(null);
      setIsLoading(false);
      setHasError(true);
      return;
    }

    setIsLoading(true);
    setHasError(false);
    setImageSrc(null);

    try {
      const cachedResponse = await iconCacheService.get(src);

      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        const url = URL.createObjectURL(blob);
        setImageSrc(url);
        setIsLoading(false);
        return;
      }

      const proxiedUrl = getProxiedUrl(src);
      const response = await fetch(proxiedUrl, {
        mode: 'cors',
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      await iconCacheService.set(src, response.clone());

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setImageSrc(url);
      setIsLoading(false);
    } catch {
      setHasError(true);
      setIsLoading(false);
    }
  }, [src]);

  useEffect(() => {
    fetchImage();

    return () => {
      if (previousImageSrc.current && previousImageSrc.current.startsWith('blob:')) {
        URL.revokeObjectURL(previousImageSrc.current);
      }
    };
  }, [fetchImage]);

  useEffect(() => {
    previousImageSrc.current = imageSrc;
  }, [imageSrc]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center`}>
        <Globe className="w-4 h-4 text-gray-400 animate-pulse" />
      </div>
    );
  }

  if (hasError || !imageSrc) {
    if (defaultIcon) {
      return <div className={className}>{defaultIcon}</div>;
    }
    return (
      <div className={`${className} flex items-center justify-center`}>
        <Globe className="w-4 h-4 text-gray-500" />
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={handleError}
      loading="lazy"
      decoding="async"
    />
  );
};

export default CachedIcon;