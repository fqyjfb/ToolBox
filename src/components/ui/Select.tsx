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
}

const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled = false,
  className = '',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOffset, setDropdownOffset] = useState(2);
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
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropdownOffset(spaceBelow < 160 ? -164 : 2);
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  const dropdown = isOpen ? (
    <div
      ref={dropdownRef}
      className="fixed bg-white dark:bg-gray-800 rounded-md shadow-lg z-[1000]"
      style={{
        left: triggerRef.current ? triggerRef.current.getBoundingClientRect().left : 0,
        top: triggerRef.current ? triggerRef.current.getBoundingClientRect().bottom + dropdownOffset : 0,
        minWidth: triggerRef.current ? triggerRef.current.offsetWidth : 0,
      }}
    >
      <div className="max-h-60 overflow-y-auto py-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              onChange(option.value);
              setIsOpen(false);
            }}
            className={`w-full px-2 py-1.5 text-left text-xs transition-colors ${
              option.value === value
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
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
          className={`w-full px-3 py-2 text-sm flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none whitespace-nowrap border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white ${className}`}
        >
          <span className={`truncate text-left ${selectedOption ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ml-1 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {createPortal(dropdown, document.body)}
    </>
  );
};

export default Select;
