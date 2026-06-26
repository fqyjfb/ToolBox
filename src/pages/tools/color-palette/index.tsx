import React, { useState, useCallback, useEffect } from 'react';
import { Palette, Copy, Clipboard } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';
import {
  hexToRgb, rgbToHsl, rgbToHsv, isValidHex,
  generateAllSchemes, basicColors, popularPalettes,
  RGB, HSL, HSV, ColorScheme
} from '../../../utils/colorUtils';

const ColorPalettePage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [hex, setHex] = useState('#845EC2');
  const [inputValue, setInputValue] = useState('#845EC2');
  const [rgb, setRgb] = useState<RGB>({ r: 132, g: 94, b: 194 });
  const [hsl, setHsl] = useState<HSL>({ h: 264, s: 46, l: 56 });
  const [hsv, setHsv] = useState<HSV>({ h: 264, s: 52, v: 76 });
  const [colorSchemes, setColorSchemes] = useState<ColorScheme[]>([]);
  const [activeSchemeId, setActiveSchemeId] = useState<string>('generic-gradient');

  useEffect(() => setColorSchemes(generateAllSchemes(hex)), [hex]);

  const updateColor = useCallback((newHex: string) => {
    const cleanedHex = newHex.trim().replace(/[^0-9a-fA-F#]/g, '');
    if (!isValidHex(cleanedHex)) {
      return;
    }
    const formattedHex = cleanedHex.startsWith('#') ? cleanedHex : `#${cleanedHex}`;
    setHex(formattedHex);
    setInputValue(formattedHex);
    const rgbValue = hexToRgb(formattedHex)!;
    setRgb(rgbValue);
    setHsl(rgbToHsl(rgbValue.r, rgbValue.g, rgbValue.b));
    setHsv(rgbToHsv(rgbValue.r, rgbValue.g, rgbValue.b));
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const allowed = /^#?[0-9a-fA-F]*$/;
    if (allowed.test(value)) {
      setInputValue(value);
    }
  }, []);

  const handleInputBlur = useCallback(() => {
    if (isValidHex(inputValue)) {
      updateColor(inputValue);
    } else if (inputValue.length > 0) {
      setInputValue(hex);
      addToast({ message: '无效的颜色值', type: 'error' });
    }
  }, [inputValue, hex, updateColor, addToast]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    }
  }, [handleInputBlur]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast({ message: '已复制到剪贴板', type: 'success' });
    }).catch(() => {
      addToast({ message: '复制失败', type: 'error' });
    });
  }, [addToast]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = text.trim().replace(/[^0-9a-fA-F#]/g, '');
      if (isValidHex(cleaned)) {
        updateColor(cleaned);
        addToast({ message: '已粘贴', type: 'success' });
      } else {
        addToast({ message: '无效的颜色值', type: 'error' });
      }
    } catch {
      addToast({ message: '粘贴失败', type: 'error' });
    }
  }, [updateColor, addToast]);

  const handleColorCardClick = useCallback((color: string) => {
    handleCopy(color);
  }, [handleCopy]);

  const currentScheme = colorSchemes.find(s => s.id === activeSchemeId);

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="flex items-center gap-3 mb-4">
        <Palette className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">调色板</h2>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
          <div className="rounded-lg overflow-hidden shadow-lg" style={{ backgroundColor: hex }}>
            <div className="p-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    onKeyDown={handleInputKeyDown}
                    className="w-full pr-9 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-mono text-sm focus:outline-none focus:border-blue-500"
                    placeholder="#845EC2"
                    maxLength={7}
                  />
                  <button
                    onClick={handlePaste}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="粘贴"
                  >
                    <Clipboard className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
                <input
                  type="color"
                  value={hex}
                  onChange={(e) => updateColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {[
              { label: 'HEX', value: hex },
              { label: 'RGB', value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
              { label: 'HSL', value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
              { label: 'HSV', value: `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)` },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-8">{item.label}</span>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={item.value}
                      readOnly
                      className="w-full px-2 py-1.5 bg-white dark:bg-gray-600 rounded text-xs font-mono text-gray-800 dark:text-gray-200 focus:outline-none"
                    />
                    <button
                      onClick={() => handleCopy(item.value)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                      title="复制"
                    >
                      <Copy className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">配色方案</h3>
            <div className="flex flex-wrap gap-1.5">
              {colorSchemes.map((scheme) => (
                <button
                  key={scheme.id}
                  onClick={() => setActiveSchemeId(scheme.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    activeSchemeId === scheme.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                  }`}
                >
                  {scheme.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-auto p-4">
          {currentScheme && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-medium text-gray-800 dark:text-gray-200">{currentScheme.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{currentScheme.description}</span>
              </div>
              <div className="container-items">
                {currentScheme.colors.map((color, index) => (
                  <button
                    key={`${color}-${index}`}
                    className="item-color"
                    style={{ '--color': color } as React.CSSProperties}
                    data-color={color}
                    onClick={() => handleColorCardClick(color)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">基础颜色</h3>
            <div className="container-items">
              {basicColors.map((color) => (
                <button
                  key={color.hex}
                  className="item-color"
                  style={{ '--color': color.hex } as React.CSSProperties}
                  data-color={color.name}
                  onClick={() => updateColor(color.hex)}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">流行配色</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {popularPalettes.map((palette) => (
                <div key={palette.name} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{palette.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{palette.description}</div>
                  <div className="container-items">
                    {palette.colors.map((color, index) => (
                      <button
                        key={`${palette.name}-${color}-${index}`}
                        className="item-color"
                        style={{ '--color': color } as React.CSSProperties}
                        data-color={color}
                        onClick={() => handleColorCardClick(color)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorPalettePage;