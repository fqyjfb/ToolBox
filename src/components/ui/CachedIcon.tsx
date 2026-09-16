import React, { useState, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { iconCacheService, IconCacheType } from '../../services/iconCacheService';
import { isElectron } from '../../utils/environment';

interface CachedIconProps {
  src?: string | null;
  url?: string;
  alt?: string;
  name?: string;
  className?: string;
  defaultIcon?: React.ReactNode;
  fallbackIcon?: React.ReactNode;
  onError?: () => void;
  type?: IconCacheType;
  iconOnly?: boolean;
}

const activeRequests = new Map<string, Promise<string>>();

// 已解析出的图片地址（src -> 可直接用于 <img> 的地址），跨组件挂载复用：
// 路由切走再切回时无需重开 Cache API，首帧直接出图
const resolvedUrls = new Map<string, string>();

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
  url,
  alt,
  name,
  className = '',
  defaultIcon,
  fallbackIcon,
  onError,
  type = 'general',
  iconOnly = false,
}) => {
  const effectiveSrc = src ?? url;
  const effectiveAlt = alt ?? name ?? '';
  const effectiveFallback = defaultIcon ?? fallbackIcon;

  const requestKey = `${type}:${effectiveSrc}`;

  const [imageSrc, setImageSrc] = useState<string | null>(() => resolvedUrls.get(requestKey) ?? null);
  const [isLoading, setIsLoading] = useState(() => !resolvedUrls.has(requestKey));
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(iconOnly);
  const iconRef = React.useRef<HTMLDivElement>(null);

  const fetchImage = useCallback(async () => {
    if (!effectiveSrc || !effectiveSrc.trim()) {
      setImageSrc(null);
      setIsLoading(false);
      setHasError(true);
      return;
    }

    setIsLoading(true);
    setHasError(false);
    setImageSrc(null);

    const applyUrl = (objUrl: string) => {
      resolvedUrls.set(requestKey, objUrl);
      setImageSrc(objUrl);
      setIsLoading(false);
    };

    try {
      if (activeRequests.has(requestKey)) {
        applyUrl(await activeRequests.get(requestKey)!);
        return;
      }

      const cachedResponse = await iconCacheService.get(effectiveSrc, type);

      if (cachedResponse) {
        applyUrl(URL.createObjectURL(await cachedResponse.blob()));
        return;
      }

      const requestPromise = fetchWithFallback(effectiveSrc).then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        await iconCacheService.set(effectiveSrc, response.clone(), type);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }).finally(() => {
        activeRequests.delete(requestKey);
      });

      activeRequests.set(requestKey, requestPromise);
      applyUrl(await requestPromise);

    } catch {
      // fetch 失败（通常是浏览器 CORS 限制），回退到 <img> 直接加载
      // <img> 标签加载跨域图片不受 CORS 限制，仍可正常显示
      applyUrl(effectiveSrc);
    }
  }, [effectiveSrc, type, requestKey]);

  useEffect(() => {
    if (iconOnly) return;
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
  }, [iconOnly]);

  useEffect(() => {
    if (!isVisible) return;
    fetchImage();
  }, [isVisible, fetchImage]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  if (iconOnly) {
    if (hasError || !imageSrc) {
      return <>{effectiveFallback}</>;
    }
    return (
      <img
        src={imageSrc}
        alt={effectiveAlt}
        className={className}
        onError={handleError}
        loading="lazy"
        decoding="async"
      />
    );
  }

  if (!isVisible) {
    return (
      <div ref={iconRef} className={`${className} flex items-center justify-center`}>
        <Globe className="w-4 h-4 text-gray-400" />
      </div>
    );
  }

  if (isLoading) {
    if (effectiveFallback) {
      return <div ref={iconRef} className={className}>{effectiveFallback}</div>;
    }
    return (
      <div ref={iconRef} className={`${className} flex items-center justify-center`}>
        <Globe className="w-4 h-4 text-gray-400 animate-pulse" />
      </div>
    );
  }

  if (hasError || !imageSrc) {
    if (effectiveFallback) {
      return <div className={className}>{effectiveFallback}</div>;
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
      alt={effectiveAlt}
      className={className}
      onError={handleError}
      loading="lazy"
      decoding="async"
    />
  );
};

export default CachedIcon;