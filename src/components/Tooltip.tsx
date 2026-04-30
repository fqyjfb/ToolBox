import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  title: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ children, title, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && tooltipRef.current && triggerRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let newPosition = position;

      if (position === 'top' && triggerRect.top < tooltipRect.height + 10) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && triggerRect.bottom + tooltipRect.height > viewportHeight - 10) {
        newPosition = 'top';
      } else if (position === 'left' && triggerRect.left < tooltipRect.width + 10) {
        newPosition = 'right';
      } else if (position === 'right' && triggerRect.right + tooltipRect.width > viewportWidth - 10) {
        newPosition = 'left';
      }

      setActualPosition(newPosition);
    }
  }, [isVisible, position]);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowPositionClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b',
    left: 'left-full top-1/2 -translate-y-1/2 border-l',
    right: 'right-full top-1/2 -translate-y-1/2 border-r',
  };

  const getArrowBorderColor = () => {
    const color = 'var(--color-tooltip-bg, dodgerblue)';
    if (actualPosition === 'top') return { borderTopColor: color };
    if (actualPosition === 'bottom') return { borderBottomColor: color };
    if (actualPosition === 'left') return { borderLeftColor: color };
    if (actualPosition === 'right') return { borderRightColor: color };
    return {};
  };

  return (
    <div
      className="relative inline-block"
      ref={triggerRef}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-[1000] rounded-lg whitespace-nowrap transition-all duration-200 opacity-100 pointer-events-none ${positionClasses[actualPosition]}`}
          style={{
            backgroundColor: 'var(--color-tooltip-bg, dodgerblue)',
            color: 'white',
            fontSize: 'small',
            fontWeight: 'bold',
            paddingInline: '7px',
            paddingBlock: '3px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {title}
        </div>
      )}
      {isVisible && (
        <div
          className={`absolute z-[1001] w-0 h-0 border-4 border-transparent pointer-events-none ${arrowPositionClasses[actualPosition]}`}
          style={getArrowBorderColor()}
        />
      )}
    </div>
  );
};

export default Tooltip;