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
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        type="button"
        onClick={() => onChange(!isChecked)}
        className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors focus:outline-none focus:ring-1.5 focus:ring-offset-1.5 focus:ring-primary ${
          isChecked ? 'bg-primary' : 'bg-surface-secondary'
        }`}
      >
        <span
          className={`inline-block w-3 h-3 transform rounded-full transition-all ${
            isChecked ? 'translate-x-5 switch-thumb-active' : 'translate-x-1 switch-thumb-inactive'
          }`}
        />
      </button>
      {text && (
        <span className="text-xs text-gray-500 whitespace-nowrap">{text}</span>
      )}
    </div>
  );
};

export default ToggleSwitch;
