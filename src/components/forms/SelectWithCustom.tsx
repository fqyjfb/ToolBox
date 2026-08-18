import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

interface SelectOption {
  id: string;
  label: string;
}

interface SelectWithCustomProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const DROPDOWN_HEIGHT = 280;

const SelectWithCustom: React.FC<SelectWithCustomProps> = ({
  value,
  onChange,
  options,
  placeholder = '选择或输入',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
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
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 仅在窗口缩放时关闭下拉，避免定位错乱（模态框打开时 body overflow:hidden，无需监听滚动）
  useEffect(() => {
    if (!isOpen) return;
    const handle = () => {
      setIsOpen(false);
      setSearchTerm('');
    };
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    let top: number;
    if (spaceBelow >= DROPDOWN_HEIGHT || spaceBelow >= spaceAbove) {
      top = rect.bottom + 2;
    } else {
      top = Math.max(8, rect.top - DROPDOWN_HEIGHT - 2);
    }
    // 宽度严格等于触发按钮宽度，避免内容撑开超出视口
    let left = rect.left;
    const rightEdge = left + rect.width;
    if (rightEdge > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - rect.width - 8);
    }
    setDropdownStyle({
      left,
      top,
      width: rect.width,
    });
  }, [isOpen]);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.label === value);

  const handleOptionClick = (label: string) => {
    onChange(label);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleCustomInput = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    onChange(target.value);
  };

  const dropdown = isOpen ? (
    <div
      ref={dropdownRef}
      className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[1000] flex flex-col"
      style={{ ...dropdownStyle, maxHeight: DROPDOWN_HEIGHT }}
    >
      <div className="relative flex-shrink-0">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索..."
          className="w-full px-3 py-2 pl-10 border-b border-gray-200 dark:border-gray-700 focus:outline-none dark:bg-gray-800 dark:text-white text-sm"
          autoFocus
        />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {filteredOptions.length > 0 ? (
          <div className="py-1">
            {filteredOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.label)}
                className={`w-full px-3 py-2 text-left text-sm transition-colors truncate ${
                  option.label === value
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="py-2 px-3 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? '无匹配结果' : '暂无数据'}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 p-2 flex-shrink-0">
        <input
          type="text"
          value={searchTerm || (!selectedOption ? value : '')}
          onChange={handleCustomInput}
          onBlur={() => {
            if (!searchTerm && !value) setIsOpen(false);
          }}
          placeholder="输入自定义值..."
          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="relative" ref={containerRef}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`${className} text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed`.trim()}
        >
          <span className={`truncate ${value ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
            {value || placeholder}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-1 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {createPortal(dropdown, document.body)}
    </>
  );
};

export default SelectWithCustom;
