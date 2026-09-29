import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  dense?: boolean;
}

// 下拉列表与触发器的间距
const DROPDOWN_GAP = 2;
// 下拉列表距视口边缘的安全距离
const VIEWPORT_MARGIN = 8;
// 下拉列表最大高度（原 Tailwind max-h-60）
const DROPDOWN_MAX_HEIGHT = 240;

const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled = false,
  className = '',
  size = 'md',
  dense = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(DROPDOWN_MAX_HEIGHT);
  const [dropdownLeft, setDropdownLeft] = useState(0);
  const [dropdownMaxWidth, setDropdownMaxWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    // 依据触发器上/下方真实可用空间决定展开方向，列表高度同步收敛到可用空间内
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const shouldOpenUp = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;
    const availableHeight = (shouldOpenUp ? spaceAbove : spaceBelow) - DROPDOWN_GAP;
    setOpenUp(shouldOpenUp);
    setDropdownMaxHeight(Math.min(DROPDOWN_MAX_HEIGHT, Math.max(availableHeight, 0)));
    const left = rect.left;
    const width = rect.width;
    const viewportWidth = window.innerWidth;
    if (left + width > viewportWidth - VIEWPORT_MARGIN) {
      setDropdownLeft(left + width - viewportWidth + VIEWPORT_MARGIN);
      setDropdownMaxWidth(viewportWidth - left - VIEWPORT_MARGIN);
    } else {
      setDropdownLeft(0);
      setDropdownMaxWidth(0);
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);
  const triggerRect = triggerRef.current?.getBoundingClientRect();
  // 向上展开时以 bottom 锚定触发器上沿，保证实际内容高度不一时仍贴合触发器
  const verticalPositionStyle: React.CSSProperties = openUp && triggerRect
    ? { bottom: window.innerHeight - triggerRect.top + DROPDOWN_GAP }
    : { top: triggerRect ? triggerRect.bottom + DROPDOWN_GAP : 0 };

  const dropdown = isOpen ? (
    <div
      ref={dropdownRef}
      className="fixed bg-surface rounded-md shadow-lg z-[1000]"
      style={{
        left: triggerRect ? triggerRect.left + dropdownLeft : 0,
        width: triggerRef.current ? triggerRef.current.offsetWidth : 0,
        maxWidth: dropdownMaxWidth > 0 ? dropdownMaxWidth : undefined,
        ...verticalPositionStyle,
      }}
    >
      <div
        className="scrollbar-thin overflow-y-auto py-1"
        style={{ maxHeight: dropdownMaxHeight }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              onChange(option.value);
              setIsOpen(false);
            }}
            className={`w-full px-2 py-1.5 text-left text-xs transition-colors ${
              option.value === value
                ? 'bg-surface-secondary text-content-primary'
                : 'text-content-primary hover:bg-menu-hover'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <>
      <div ref={containerRef} className={`relative inline-block ${size === 'sm' ? 'w-fit' : 'w-full'}`}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none whitespace-nowrap rounded-lg ${dense ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} ${className}`}
        >
          <span className={`truncate text-left ${selectedOption ? 'text-content-primary' : 'text-content-secondary'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-content-secondary transition-transform flex-shrink-0 ml-1 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {createPortal(dropdown, document.body)}
    </>
  );
};

export default Select;
