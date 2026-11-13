import React, { useEffect, useState } from 'react';
import FloatConfigEditor from './FloatConfigEditor';
import SettingCard from './SettingCard';
import SettingRow from './SettingRow';
import ToggleSwitch from './ToggleSwitch';
import { FloatConfigItem } from '../../types/settings';
import { QuickLaunchItem } from '../../utils/quickLaunch';
import FloatConfigIcon from '../ui/FloatConfigIcon';

// 圆形按钮内径 40px，图标统一 20px（与真实悬浮窗菜单项一致）
const BALL_ICON_SIZE = 20;

// 进阶功能开关：直接走既有的 getSettings / updateSetting 通道，
// 不往 Settings.tsx 增加一组 props 与 useState（避免多处重复维护同一份状态）
// shortcutName 对应 config.cjs / shortcuts.json 里的 name 字段，用于动态展示当前快捷键
const FLOAT_FEATURE_SWITCHES: Array<{ name: string; label: string; desc?: string; shortcutName?: string }> = [
  { name: 'floatShopAssistantEnabled', label: '店铺场景助手', desc: '识别买家消息与物流单号，推荐话术与查询入口' },
  { name: 'floatScreenshotQAEnabled', label: '截图问答', shortcutName: 'floatScreenshotQA', desc: '截图只在本机内存处理，不落盘；需先在 AI 设置中配置模型' },
  { name: 'floatGesturesEnabled', label: '手势（长按 / 滚轮 / 拖入）', desc: '长按快速捕捉、展开态滚轮切换、拖入文件到收件箱' },
  { name: 'floatPaletteEnabled', label: '命令面板', shortcutName: 'floatPalette', desc: '搜索工具、待办、笔记、动作并直达' },
  { name: 'floatShelfEnabled', label: '拖拽收件箱', desc: '文件拖到球上暂存，可在面板中取用' },
  { name: 'floatCaptureEnabled', label: '快速捕捉', shortcutName: 'floatQuickCapture', desc: '一句话记待办 / 提醒 / 笔记，落库前必须确认' },
];

const CLIPBOARD_SETTING_NAMES = [
  'floatClipboardHintEnabled',
  'floatClipboardHintMinLen',
  'floatClipboardHintMaxLen',
  'floatClipboardHintCooldownMs',
];

interface FloatWindowTabProps {
  floatConfig: FloatConfigItem[];
  quickLaunchApps: QuickLaunchItem[];
  onFloatConfigUpdate: (index: number, config: FloatConfigItem) => void;
  onSaveFloatConfig: () => void;
  onResetFloatConfig: () => void;
}

const FloatWindowTab: React.FC<FloatWindowTabProps> = ({
  floatConfig,
  quickLaunchApps,
  onFloatConfigUpdate,
  onSaveFloatConfig,
  onResetFloatConfig
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [featureValues, setFeatureValues] = useState<Record<string, number>>({});
  const [shortcutCmds, setShortcutCmds] = useState<Record<string, string>>({});

  // 加载当前快捷键映射 — 用于动态展示功能开关旁边的快捷键提示
  useEffect(() => {
    let alive = true;
    window.electron?.getShortcuts?.()
      .then((list) => {
        if (!alive || !Array.isArray(list)) return;
        const map: Record<string, string> = {};
        list.forEach((s: { name?: string; cmd?: string }) => {
          if (s && s.name && s.cmd) map[s.name] = s.cmd;
        });
        setShortcutCmds(map);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const safeActiveIndex = floatConfig.length > 0 ? Math.min(activeIndex, floatConfig.length - 1) : 0;

  useEffect(() => {
    let alive = true;
    const names = [...FLOAT_FEATURE_SWITCHES.map(item => item.name), ...CLIPBOARD_SETTING_NAMES];
    window.electron?.getSettings?.()
      .then((settings) => {
        if (!alive || !Array.isArray(settings)) return;
        const next: Record<string, number> = {};
        settings.forEach((item) => {
          if (!names.includes(item.name)) return;
          const value = item.value;
          next[item.name] = typeof value === 'number'
            ? value
            : (value === true || value === '1' ? 1 : 0);
        });
        setFeatureValues(next);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const updateFeature = (name: string, value: number) => {
    setFeatureValues(prev => ({ ...prev, [name]: value }));
    void window.electron?.updateSetting?.({ name, value });
  };

  const updateClipboardNumber = (name: string, raw: string, min: number, max: number, fallback: number) => {
    const n = Number(raw);
    const v = Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
    updateFeature(name, v);
  };

  const handleIconClick = (index: number) => {
    setActiveIndex(index);
  };

  const getRadialPosition = (index: number, total: number) => {
    if (total <= 1) return { x: 0, y: 0 };
    const angle = (index * 360 / total) - 90;
    const radius = total <= 4 ? 48 : total <= 6 ? 52 : 56;
    const rad = (angle * Math.PI) / 180;
    return {
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius
    };
  };

  return (
    <SettingCard>
      <div className="flex items-center gap-2 p-4 settings-section-header">
        <div className="w-5 h-5 flex items-center justify-center text-primary">
          <svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor">
            <circle cx="512" cy="512" r="480" fill="none" stroke="currentColor" strokeWidth="40" opacity="0.3" />
            <circle cx="512" cy="512" r="200" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-content-primary">悬浮窗设置</h2>
      </div>

      <div className="p-4">
        <div className="flex gap-6 items-start">
          {/* 左侧：悬浮球展开预览 */}
          <div className="flex-1 flex justify-center py-6 border-r border-content pr-6">
            <div className="relative" style={{ width: 180, height: 180 }}>
              {floatConfig.map((config, index) => {
                const pos = getRadialPosition(index, floatConfig.length);
                const isActive = safeActiveIndex === index;

                return (
                  <button
                    key={config.id}
                    onClick={() => handleIconClick(index)}
                    className={`absolute flex items-center justify-center rounded-full transition-transform duration-200 overflow-hidden ${
                      isActive ? 'scale-110' : 'hover:scale-105'
                    }`}
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor:
                        config.type === 'tool' && config.color ? config.color : 'var(--color-primary)',
                      left: '50%',
                      top: '50%',
                      transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${isActive ? 1.1 : 1})`,
                      boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    title={config.name}
                  >
                    <FloatConfigIcon
                      config={config}
                      size={BALL_ICON_SIZE}
                      className="text-white"
                    />
                  </button>
                );
              })}

              <div
                className="absolute flex items-center justify-center rounded-full bg-surface"
                style={{
                  width: 48,
                  height: 48,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                }}
              >
                {floatConfig[safeActiveIndex] && (
                  <span className="text-xs font-medium text-content-primary text-center leading-tight">
                    {floatConfig[safeActiveIndex].name.length > 4
                      ? floatConfig[safeActiveIndex].name.slice(0, 4)
                      : floatConfig[safeActiveIndex].name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：配置编辑 */}
          <div className="flex-1">
            {floatConfig.length === 0 ? (
              <div className="py-4 text-center text-sm text-content-secondary">
                暂无悬浮窗配置项
              </div>
            ) : (
              <FloatConfigEditor
                key={floatConfig[safeActiveIndex].id}
                config={floatConfig[safeActiveIndex]}
                onUpdate={(updated) => onFloatConfigUpdate(safeActiveIndex, updated)}
                onSave={onSaveFloatConfig}
                onReset={onResetFloatConfig}
                quickLaunchApps={quickLaunchApps}
              />
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-content pt-2">
          <div className="px-4 py-2 text-xs font-medium text-content-secondary">进阶功能</div>

          {/* 剪贴板智能提示 — 单独渲染，带数值配置 */}
          <div className="px-4 py-2 hover:bg-menu-hover">
            <div className="flex items-center justify-between">
              <div className="text-sm text-content-primary">剪贴板智能提示</div>
              <ToggleSwitch
                checked={featureValues['floatClipboardHintEnabled'] === 1}
                onChange={(enabled) => updateFeature('floatClipboardHintEnabled', enabled ? 1 : 0)}
              />
            </div>
            <div className="px-0 pb-2 pt-1 text-xs leading-relaxed text-content-tertiary">
              复制文本后气泡推荐操作；仅本机内存处理，不点击不发请求
            </div>
            {featureValues['floatClipboardHintEnabled'] === 1 && (
              <div className="space-y-1">
                <SettingRow label="触发下限（字符）">
                  <input
                    type="number"
                    min={5}
                    max={Math.max(200, (featureValues['floatClipboardHintMaxLen'] || 2000))}
                    value={featureValues['floatClipboardHintMinLen'] ?? 10}
                    onChange={(e) => updateClipboardNumber(
                      'floatClipboardHintMinLen',
                      e.target.value,
                      5,
                      Math.max(200, (featureValues['floatClipboardHintMaxLen'] || 2000)),
                      10,
                    )}
                    className="w-24 px-2 py-1 text-sm border border-content rounded-md focus:outline-none focus:border-primary bg-surface text-content-primary"
                  />
                </SettingRow>
                <SettingRow label="触发上限（字符）">
                  <input
                    type="number"
                    min={Math.max(10, (featureValues['floatClipboardHintMinLen'] || 10))}
                    max={20000}
                    value={featureValues['floatClipboardHintMaxLen'] ?? 2000}
                    onChange={(e) => updateClipboardNumber(
                      'floatClipboardHintMaxLen',
                      e.target.value,
                      Math.max(10, (featureValues['floatClipboardHintMinLen'] || 10)),
                      20000,
                      2000,
                    )}
                    className="w-24 px-2 py-1 text-sm border border-content rounded-md focus:outline-none focus:border-primary bg-surface text-content-primary"
                  />
                </SettingRow>
                <SettingRow label="冷却时间（毫秒）">
                  <input
                    type="number"
                    min={1000}
                    max={120000}
                    step={1000}
                    value={featureValues['floatClipboardHintCooldownMs'] ?? 8000}
                    onChange={(e) => updateClipboardNumber(
                      'floatClipboardHintCooldownMs',
                      e.target.value,
                      1000,
                      120000,
                      8000,
                    )}
                    className="w-24 px-2 py-1 text-sm border border-content rounded-md focus:outline-none focus:border-primary bg-surface text-content-primary"
                  />
                </SettingRow>
              </div>
            )}
          </div>

          {FLOAT_FEATURE_SWITCHES.map((item) => {
            // 动态拼接快捷键后缀：从 shortcuts.json 读当前用户配置的 cmd，改了也能同步
            const shortcut = item.shortcutName ? shortcutCmds[item.shortcutName] : '';
            const displayLabel = shortcut ? `${item.label}（${shortcut}）` : item.label;
            return (
              <div key={item.name}>
                <SettingRow label={displayLabel}>
                  <ToggleSwitch
                    checked={featureValues[item.name] === 1}
                    onChange={(enabled) => updateFeature(item.name, enabled ? 1 : 0)}
                  />
                </SettingRow>
                {item.desc && (
                  <div className="px-4 pb-2 text-xs leading-relaxed text-content-tertiary">{item.desc}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </SettingCard>
  );
};

export default FloatWindowTab;
