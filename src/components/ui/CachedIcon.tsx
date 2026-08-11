import React, { useState, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { iconCacheService, IconCacheType } from '../../services/iconCacheService';
import { isElectron } from '../../utils/environment';

interface CachedIconProps {
  src?: string | null;
  alt: string;
  className?: string;
  defaultIcon?: React.ReactNode;
  onError?: () => void;
  type?: IconCacheType;
}

const activeRequests = new Map<string, Promise<string>>();

const getProxiedUrl = (url: string): string => {
  const raw = (url || '').trim();
  if (!raw) return '';
  if (/^(data|blob):/i.test(raw)) return raw;
  
  if (isElectron()) {
    return raw;
  }
  
  try {
    return `https://images.weserv.nl/?url=${encodeURIComponent(raw)}`;
  } catch {
    return raw;
  }
};

const fetchWithFallback = async (url: string): Promise<Response> => {
  try {
    const response = await fetch(url, {
      mode: 'cors',
      cache: 'force-cache'
    });
    if (response.ok) {
      return response;
    }
  } catch {
    // 直接 fetch 失败（通常是 CORS），继续尝试代理
  }

  const proxiedUrl = getProxiedUrl(url);
  return fetch(proxiedUrl, {
    mode: 'cors',
    cache: 'force-cache'
  });
};

const CachedIcon: React.FC<CachedIconProps> = ({
  src,
  alt,
  className = '',
  defaultIcon,
  onError,
  type = 'general'
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const previousImageSrc = React.useRef<string | null>(null);
  const iconRef = React.useRef<HTMLDivElement>(null);

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
      const requestKey = `${type}:${src}`;
      
      if (activeRequests.has(requestKey)) {
        const url = await activeRequests.get(requestKey)!;
        if (previousImageSrc.current && previousImageSrc.current.startsWith('blob:')) {
          URL.revokeObjectURL(previousImageSrc.current);
        }
        previousImageSrc.current = url;
        setImageSrc(url);
        setIsLoading(false);
        return;
      }

      const cachedResponse = await iconCacheService.get(src, type);

      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        const url = URL.createObjectURL(blob);
        if (previousImageSrc.current && previousImageSrc.current.startsWith('blob:')) {
          URL.revokeObjectURL(previousImageSrc.current);
        }
        previousImageSrc.current = url;
        setImageSrc(url);
        setIsLoading(false);
        return;
      }

      const requestPromise = fetchWithFallback(src).then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        await iconCacheService.set(src, response.clone(), type);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }).finally(() => {
        activeRequests.delete(requestKey);
      });

      activeRequests.set(requestKey, requestPromise);
      const url = await requestPromise;
      
      if (previousImageSrc.current && previousImageSrc.current.startsWith('blob:')) {
        URL.revokeObjectURL(previousImageSrc.current);
      }
      previousImageSrc.current = url;
      setImageSrc(url);
      setIsLoading(false);

    } catch {
      // fetch 失败（通常是浏览器 CORS 限制），回退到 <img> 直接加载
      // <img> 标签加载跨域图片不受 CORS 限制，仍可正常显示
      previousImageSrc.current = src;
      setImageSrc(src);
      setIsLoading(false);
    }
  }, [src, type]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px',
        threshold: 0.1
      }
    );

    if (iconRef.current) {
      observer.observe(iconRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    fetchImage();

    return () => {
      if (previousImageSrc.current && previousImageSrc.current.startsWith('blob:')) {
        URL.revokeObjectURL(previousImageSrc.current);
      }
    };
  }, [isVisible, fetchImage]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  if (!isVisible) {
    return (
      <div ref={iconRef} className={`${className} flex items-center justify-center`}>
        <Globe className="w-4 h-4 text-gray-400" />
      </div>
    );
  }

  if (isLoading) {
    if (defaultIcon) {
      return <div ref={iconRef} className={className}>{defaultIcon}</div>;
    }
    return (
      <div ref={iconRef} className={`${className} flex items-center justify-center`}>
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