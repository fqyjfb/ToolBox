import React from 'react';

interface ColorPickerProps {
  /** 当前值；空字符串 / undefined 表示「跟随预设默认值」 */
  value: string | undefined;
  onChange: (value: string) => void;
  label: string;
  /** 未配置时使用的预设色（同时作为输入框 placeholder） */
  defaultColor: string;
  /** 该颜色作用到的组件说明，展示在行尾 */
  desc?: string;
}

// input[type=color] 规范只接受 #RRGGBB，不支持 rgba()/hsl()。
// 非 hex 值时禁用取色器并保留文本输入，避免浏览器强制改写成 #000000 导致原值丢失。
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, label, defaultColor, desc }) => {
  const trimmed = value?.trim() ?? '';
  const usingDefault = !trimmed;
  const effective = usingDefault ? defaultColor : trimmed;
  const pickerSupported = HEX_COLOR.test(effective);

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-content-secondary w-20 shrink-0 truncate" title={label}>
        {label}
      </span>
      <input
        type="color"
        value={pickerSupported ? effective : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        disabled={!pickerSupported}
        aria-label={`${label}取色器`}
        title={pickerSupported ? '点击取色' : '当前值不是 hex 颜色，请在右侧文本框输入'}
        className="w-7 h-7 shrink-0 p-0.5 rounded cursor-pointer border border-content bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
      />
      <input
        type="text"
        value={trimmed}
        onChange={(e) => onChange(e.target.value)}
        placeholder={defaultColor}
        aria-label={`${label}颜色值`}
        spellCheck={false}
        className="text-xs w-24 px-1.5 py-0.5 rounded bg-surface text-content-primary font-mono focus:outline-none"
      />
      {usingDefault ? (
        <span className="text-2xs text-content-tertiary">跟随预设</span>
      ) : (
        <button
          type="button"
          onClick={() => onChange('')}
          title="清除该颜色，跟随预设"
          aria-label={`清除${label}`}
          className="text-xs text-content-tertiary hover:text-content-primary"
        >
          ✕
        </button>
      )}
      {desc && (
        <span
          className="text-2xs text-content-tertiary flex-1 min-w-0 truncate pl-2"
          title={desc}
        >
          {desc}
        </span>
      )}
    </div>
  );
};

export default ColorPicker;
