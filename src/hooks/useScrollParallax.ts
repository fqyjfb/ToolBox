import { useState, useEffect, useCallback, useRef } from 'react';

export const useScrollParallax = () => {
  const [scrollY, setScrollY] = useState(0);
  const rafRef = useRef<number>(0);
  const lastScrollRef = useRef(0);

  const handleScroll = useCallback(() => {
    rafRef.current = requestAnimationFrame(() => {
      const currentScroll = window.scrollY || window.pageYOffset;
      if (Math.abs(currentScroll - lastScrollRef.current) > 0.5) {
        lastScrollRef.current = currentScroll;
        setScrollY(currentScroll);
      }
    });
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  return scrollY;
};

export const useElementParallax = (factor: number = 0.3) => {
  const ref = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const elementCenter = rect.top + rect.height / 2;
      const viewportCenter = windowHeight / 2;
      const distance = elementCenter - viewportCenter;
      setOffset(distance * factor);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [factor]);

  return { ref, offset };
};

export const useRevealAnimation = (threshold: number = 0.15) => {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
};
