import React, { useState, useRef, useEffect } from 'react';
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
}

const SelectWithCustom: React.FC<SelectWithCustomProps> = ({
  value,
  onChange,
  options,
  placeholder = '选择或输入',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 text-left border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
      >
        <span className={value ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="relative">
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

          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              <div className="py-1">
                {filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleOptionClick(option.label)}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors ${
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

          <div className="border-t border-gray-200 dark:border-gray-700 p-2">
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
      )}
    </div>
  );
};

export default SelectWithCustom;