import React from 'react';
import { Check, Palette } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import SettingSection from './SettingSection';
import { useThemeStore } from '../../store/themeStore';

const LIGHT_BG = 'url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%201600%20900%27%20width=%271600%27%20height=%27900%27%20preserveAspectRatio=%27xMidYMid%20slice%27%3E%3Cdefs%3E%3Cfilter%20id=%27f%27%20x=%27-10%25%27%20y=%27-10%25%27%20width=%27120%25%27%20height=%27120%25%27%3E%3CfeGaussianBlur%20stdDeviation=%2760%27/%3E%3C/filter%3E%3CradialGradient%20id=%27rg0%27%20cx=%2722%25%27%20cy=%2720%25%27%20r=%2760%25%27%3E%3Cstop%20offset=%270%25%27%20stop-color=%27%23e2eaf4%27/%3E%3Cstop%20offset=%27100%25%27%20stop-color=%27%23e2eaf4%27%20stop-opacity=%270%27/%3E%3C/radialGradient%3E%3CradialGradient%20id=%27rg1%27%20cx=%2778%25%27%20cy=%2770%25%27%20r=%2758%25%27%3E%3Cstop%20offset=%270%25%27%20stop-color=%27%23e8e4f0%27/%3E%3Cstop%20offset=%27100%25%27%20stop-color=%27%23e8e4f0%27%20stop-opacity=%270%27/%3E%3C/radialGradient%3E%3CradialGradient%20id=%27rg2%27%20cx=%2750%25%27%20cy=%2785%25%27%20r=%2750%25%27%3E%3Cstop%20offset=%270%25%27%20stop-color=%27%23e2ede8%27/%3E%3Cstop%20offset=%27100%25%27%20stop-color=%27%23e2ede8%27%20stop-opacity=%270%27/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect%20width=%271600%27%20height=%27900%27%20fill=%27%23f7f8fb%27/%3E%3Cg%20filter=%27url(%23f)%27%3E%3Crect%20x=%27-400%27%20y=%27-300%27%20width=%272400%27%20height=%271500%27%20fill=%27url(%23rg0)%27/%3E%3Crect%20x=%27-400%27%20y=%27-300%27%20width=%272400%27%20height=%271500%27%20fill=%27url(%23rg1)%27/%3E%3Crect%20x=%27-400%27%20y=%27-300%27%20width=%272400%27%20height=%271500%27%20fill=%27url(%23rg2)%27/%3E%3C/g%3E%3C/svg%3E")';
const DARK_BG  = 'url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%201600%20900%27%20width=%271600%27%20height=%27900%27%20preserveAspectRatio=%27xMidYMid%20slice%27%3E%3Cdefs%3E%3CradialGradient%20id=%27rg0%27%20cx=%2718%25%27%20cy=%2716%25%27%20r=%2772%25%27%3E%3Cstop%20offset=%270%25%27%20stop-color=%27%23765038%27/%3E%3Cstop%20offset=%27100%25%27%20stop-color=%27%23765038%27%20stop-opacity=%270%27/%3E%3C/radialGradient%3E%3CradialGradient%20id=%27rg1%27%20cx=%2755%25%27%20cy=%2750%25%27%20r=%2762%25%27%3E%3Cstop%20offset=%270%25%27%20stop-color=%27%232c2848%27/%3E%3Cstop%20offset=%27100%25%27%20stop-color=%27%232c2848%27%20stop-opacity=%270%27/%3E%3C/radialGradient%3E%3CradialGradient%20id=%27rg2%27%20cx=%2786%25%27%20cy=%2782%25%27%20r=%2766%25%27%3E%3Cstop%20offset=%270%25%27%20stop-color=%27%231c4066%27/%3E%3Cstop%20offset=%27100%25%27%20stop-color=%27%231c4066%27%20stop-opacity=%270%27/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect%20width=%271600%27%20height=%27900%27%20fill=%27%230c131a%27/%3E%3Crect%20x=%27-200%27%20y=%27-200%27%20width=%272000%27%20height=%271300%27%20fill=%27url(%23rg0)%27/%3E%3Crect%20x=%27-200%27%20y=%27-200%27%20width=%272000%27%20height=%271300%27%20fill=%27url(%23rg1)%27/%3E%3Crect%20x=%27-200%27%20y=%27-200%27%20width=%272000%27%20height=%271300%27%20fill=%27url(%23rg2)%27/%3E%3C/svg%3E")';

interface ThemeOptionProps {
  type: 'light' | 'dark';
  label: string;
  bg: string;
  selected: boolean;
  onClick: () => void;
}

const ThemeOption: React.FC<ThemeOptionProps> = ({ type, label, bg, selected, onClick }) => (
  <button
    onClick={onClick}
    className={`inline-flex relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200 border min-w-[120px] max-w-[180px] ${
      selected ? 'shadow-sm' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
    }`}
    style={{
      aspectRatio: '16/9',
      background: `color-mix(in srgb, var(--color-card) 75%, transparent)`,
    }}
    title={`切换为${label}`}
  >
    <div
      className="absolute inset-0"
      style={{ backgroundImage: bg, backgroundSize: 'cover', backgroundPosition: 'center' }}
    />
    <div
      className="absolute inset-0 flex flex-col justify-end p-2"
      style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 60%)',
      }}
    >
      {selected && (
        <span
          className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[10px] font-semibold text-button-text"
          style={{ background: 'var(--color-primary)' }}
        >
          <Check size={9} />
        </span>
      )}
      <span className="text-xs font-semibold" style={{ color: type === 'dark' ? '#ffffff' : '#111827' }}>{label}</span>
    </div>
  </button>
);

const ThemeTab: React.FC = () => {
  const { isDark, setTheme } = useThemeStore(useShallow(s => ({ isDark: s.isDark, setTheme: s.setTheme })));

  return (
    <SettingSection title="主题设置" icon={<Palette size={14} />}>
      <div className="flex items-start gap-2 p-4">
        <ThemeOption
          type="light"
          label="浅色模式"
          bg={LIGHT_BG}
          selected={!isDark}
          onClick={() => setTheme('light')}
        />
        <ThemeOption
          type="dark"
          label="深色模式"
          bg={DARK_BG}
          selected={isDark}
          onClick={() => setTheme('dark')}
        />
      </div>
    </SettingSection>
  );
};

export default ThemeTab;
