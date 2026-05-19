import React, { useState, useRef, useEffect } from 'react';
import { List, Check } from 'lucide-react';

export interface ColumnConfig {
  key: string;
  label: string;
  defaultVisible?: boolean;
}

interface ColumnSelectorProps {
  columns: ColumnConfig[];
  visibleColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({ columns, visibleColumns, onColumnsChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleColumnToggle = (columnKey: string) => {
    const newVisibleColumns = visibleColumns.includes(columnKey)
      ? visibleColumns.filter(c => c !== columnKey)
      : [...visibleColumns, columnKey];
    
    if (newVisibleColumns.length > 0) {
      onColumnsChange(newVisibleColumns);
    }
  };

  const isAllSelected = columns.every(c => visibleColumns.includes(c.key));

  const handleSelectAll = () => {
    if (isAllSelected) {
      onColumnsChange([columns[0]?.key].filter(Boolean));
    } else {
      onColumnsChange(columns.map(c => c.key));
    }
  };

  const handleReset = () => {
    const defaultColumns = columns.filter(c => c.defaultVisible).map(c => c.key);
    onColumnsChange(defaultColumns.length > 0 ? defaultColumns : [columns[0]?.key].filter(Boolean));
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        title="列选择"
      >
        <List size={16} />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                全选
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                重置
              </button>
            </div>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {columns.map(column => (
              <button
                key={column.key}
                onClick={() => handleColumnToggle(column.key)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  visibleColumns.includes(column.key) 
                    ? 'text-gray-900 dark:text-white' 
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <span>{column.label}</span>
                {visibleColumns.includes(column.key) && (
                  <Check className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnSelector;