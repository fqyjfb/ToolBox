import React, { useState, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { iconCacheService } from '../../services/iconCacheService';
import { isElectron } from '../../utils/environment';

interface CachedIconProps {
  src?: string | null;
  alt: string;
  className?: string;
  defaultIcon?: React.ReactNode;
  onError?: () => void;
}

// 请求去重Map，确保同一URL的图标只发起一次请求
const activeRequests = new Map<string, Promise<string>>();

const getProxiedUrl = (url: string): string => {
  const raw = (url || '').trim();
  if (!raw) return '';
  if (/^(data|blob):/i.test(raw)) return raw;
  
  // Electron环境直接返回原图URL，无需代理
  if (isElectron()) {
    return raw;
  }
  
  try {
    return `https://images.weserv.nl/?url=${encodeURIComponent(raw)}`;
  } catch {
    return raw;
  }
};

// 优先尝试直接请求，失败时使用代理
const fetchWithFallback = async (url: string): Promise<Response> => {
  // 优先尝试直接请求
  try {
    const response = await fetch(url, {
      mode: 'cors',
      cache: 'force-cache'
    });
    if (response.ok) {
      return response;
    }
  } catch {
    // 直接请求失败，使用代理
  }
  
  // 使用代理作为fallback
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
  onError
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
      // 检查是否已有相同请求在进行
      if (activeRequests.has(src)) {
        const url = await activeRequests.get(src)!;
        if (previousImageSrc.current && previousImageSrc.current.startsWith('blob:')) {
          URL.revokeObjectURL(previousImageSrc.current);
        }
        previousImageSrc.current = url;
        setImageSrc(url);
        setIsLoading(false);
        return;
      }

      const cachedResponse = await iconCacheService.get(src);

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

      // 创建请求Promise并缓存
      const requestPromise = fetchWithFallback(src).then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        await iconCacheService.set(src, response.clone());
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }).finally(() => {
        activeRequests.delete(src);
      });

      activeRequests.set(src, requestPromise);
      const url = await requestPromise;
      
      if (previousImageSrc.current && previousImageSrc.current.startsWith('blob:')) {
        URL.revokeObjectURL(previousImageSrc.current);
      }
      previousImageSrc.current = url;
      setImageSrc(url);
      setIsLoading(false);

    } catch {
      setHasError(true);
      setIsLoading(false);
    }
  }, [src]);

  // 使用 IntersectionObserver 实现懒加载
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // 提前100px加载
        threshold: 0.1
      }
    );

    if (iconRef.current) {
      observer.observe(iconRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // 可见时才加载图标
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

  // 不可见时显示占位符，不发起请求
  if (!isVisible) {
    return (
      <div ref={iconRef} className={`${className} flex items-center justify-center`}>
        <Globe className="w-4 h-4 text-gray-400" />
      </div>
    );
  }

  if (isLoading) {
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