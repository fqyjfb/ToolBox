import React from 'react';

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  checkedLabel?: string;
  uncheckedLabel?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ 
  enabled, 
  onChange, 
  checkedLabel = '开启', 
  uncheckedLabel = '关闭' 
}) => {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors focus:outline-none focus:ring-1.5 focus:ring-offset-1.5 focus:ring-primary ${
          enabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
        }`}
      >
        <span
          className={`inline-block w-3 h-3 transform rounded-full transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-1'
          }`}
          style={{ backgroundColor: 'white' }}
        />
      </button>
      <span className="text-xs text-gray-500">
        {enabled ? checkedLabel : uncheckedLabel}
      </span>
    </div>
  );
};

export default ToggleSwitch;
