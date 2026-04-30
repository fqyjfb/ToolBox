import React from 'react';

interface SwitchFilterOption {
  value: string;
  label: string;
}

interface SwitchFilterProps {
  value: string;
  onChange: (value: string) => void;
  options: SwitchFilterOption[];
}

const SwitchFilter: React.FC<SwitchFilterProps> = ({ value, onChange, options }) => {
  return (
    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
            value === option.value
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default SwitchFilter;