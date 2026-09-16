import React from 'react';

interface ToggleSwitchProps {
  enabled?: boolean;
  checked?: boolean;
  onChange: (enabled: boolean) => void;
  checkedLabel?: string;
  uncheckedLabel?: string;
  label?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  enabled,
  checked,
  onChange,
  checkedLabel = '开启',
  uncheckedLabel = '关闭',
  label,
}) => {
  const isChecked = checked ?? enabled ?? false;
  const text = label ?? (isChecked ? checkedLabel : uncheckedLabel);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(!isChecked)}
        className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors focus:outline-none focus:ring-1.5 focus:ring-offset-1.5 focus:ring-primary ${
          isChecked ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
        }`}
      >
        <span
          className={`inline-block w-3 h-3 transform rounded-full transition-transform ${
            isChecked ? 'translate-x-5' : 'translate-x-1'
          }`}
          style={{ backgroundColor: 'white' }}
        />
      </button>
      {text && (
        <span className="text-xs text-gray-500">{text}</span>
      )}
    </div>
  );
};

export default ToggleSwitch;
