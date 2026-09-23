import React from 'react';

interface RadioOption {
  label: string;
  value: string;
}

interface RadioGroupProps {
  value: string;
  options: RadioOption[];
  onChange: (value: string) => void;
}

const RadioGroup: React.FC<RadioGroupProps> = ({ value, options, onChange }) => {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            value === option.value
              ? 'bg-primary text-button-text'
              : 'bg-surface-secondary text-content-primary hover:bg-menu-hover'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default RadioGroup;
