import React, { useState, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { iconResolver, type IconCacheType } from '../../services/iconResolver';

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

// 只有远程地址需要解析：本地路径（plugins/icons/...）、data://、blob:、local-media: 均可直接显示
const REMOTE_SRC = /^https?:\/\//i;

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

  const trimmedSrc = (effectiveSrc ?? '').trim();

  // 本地路径（如 plugins/icons/...）与已解析过的图标首帧直接出图，
  // 路由切走再切回时无需再走一轮解析
  const isRemote = REMOTE_SRC.test(trimmedSrc);
  const knownSrc = isRemote ? iconResolver.peek(trimmedSrc, type) : (trimmedSrc || undefined);
  const [imageSrc, setImageSrc] = useState<string | null>(knownSrc ?? null);
  const [isLoading, setIsLoading] = useState(!knownSrc);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(iconOnly);
  const iconRef = React.useRef<HTMLDivElement>(null);

  const fetchImage = useCallback(async () => {
    if (!trimmedSrc) {
      setImageSrc(null);
      setIsLoading(false);
      setHasError(true);
      return;
    }

    // 本地路径等非远程地址无需解析，直接使用
    if (!REMOTE_SRC.test(trimmedSrc)) {
      setImageSrc(trimmedSrc);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);
    setImageSrc(null);

    // 解析由统一调度器负责：Electron 走主进程批量 IPC，Web 走 Cache API + 候选竞速。
    // 拿不到地址一律走兜底图标，绝不回退裸远程 URL（国内网络下必然破图）。
    await iconResolver.ensure([trimmedSrc], type);
    const resolvedUrl = iconResolver.peek(trimmedSrc, type);

    setImageSrc(resolvedUrl ?? null);
    setHasError(!resolvedUrl);
    setIsLoading(false);
  }, [trimmedSrc, type]);

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