import React, { useState } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  title: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ children, title, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);

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

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <>
          <div
            className={`absolute z-[1000] rounded-lg whitespace-nowrap transition-all duration-200 opacity-100 pointer-events-none ${positionClasses[position]}`}
            style={{
              backgroundColor: 'var(--color-tooltip-bg, dodgerblue)',
              color: 'var(--color-tooltip-text, white)',
              fontSize: 'small',
              fontWeight: 'bold',
              paddingInline: '7px',
              paddingBlock: '3px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {title}
          </div>
          <div
            className={`absolute z-[1001] w-0 h-0 border-4 border-transparent pointer-events-none ${arrowPositionClasses[position]}`}
            style={{
              borderTopColor: 'var(--color-tooltip-bg, dodgerblue)',
              borderBottomColor: position === 'bottom' ? 'var(--color-tooltip-bg, dodgerblue)' : 'transparent',
              borderLeftColor: position === 'left' ? 'var(--color-tooltip-bg, dodgerblue)' : 'transparent',
              borderRightColor: position === 'right' ? 'var(--color-tooltip-bg, dodgerblue)' : 'transparent',
            }}
          />
        </>
      )}
    </div>
  );
};

export default Tooltip;