import React, { useCallback, useEffect, useState } from 'react';
import { History, Languages, ScanText, SlidersHorizontal, Keyboard } from 'lucide-react';
import SettingCard from './SettingCard';
import SettingSection from './SettingSection';
import SettingRow from './SettingRow';
import ToggleSwitch from './ToggleSwitch';
import ShortcutRow from './ShortcutRow';
import Select from '../ui/Select';
import { useToastStore } from '../../store/toastStore';
import { useTranslateConfigStore } from '../../store/translateConfigStore';
import { useAIConfigStore } from '../../store/aiConfigStore';
import { LANGUAGES } from '../../constants/languages';
import type { ShortcutItem } from '../../types/settings';
import { PROVIDER_LABELS, type TranslateProviderId } from '../../types/translate';

type SettingValue = string | number | boolean;

const SETTING_DEFAULTS: Record<string, SettingValue> = {
  translateEnabled: 1,
  translateChoiceDelay: 600,
  translatePositionType: 'mouse',
  translatePopupWidth: 460,
  translatePopupHideOnBlur: 1,
  translatePopupAlwaysOnTop: 0,
  translateOcrWriteClipboard: 0,
  translateOcrWrapReplaceSpace: 0,
  translateOcrWrapRemove: 0,
  translateHistoryEnabled: 1,
  translateHistoryLimit: 30,
};

const POSITION_OPTIONS = [
  { value: 'mouse', label: '跟随鼠标' },
  { value: 'center', label: '屏幕居中偏上' },
  { value: 'last', label: '上次位置' },
];

const inputClass =
  'rounded-md border border-content bg-surface px-2 py-1.5 text-xs text-content-primary placeholder-text-content-tertiary outline-none focus:border-primary';

/** 统一 Select 触发按钮的边框样式（下拉列表自带全局 scrollbar-5px） */
const selectClass = 'border border-content bg-surface text-content-primary focus:border-primary';
const toggleRowClass = 'flex items-center justify-between px-4 py-2 hover:bg-menu-hover';

const toDraft = (source: Record<string, SettingValue>): Record<string, string> =>
  Object.fromEntries(Object.entries(source).map(([key, value]) => [key, String(value)]));

const TranslateTab: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const config = useTranslateConfigStore((state) => state.config);
  const updateConfig = useTranslateConfigStore((state) => state.update);
  const setProviderEnabled = useTranslateConfigStore((state) => state.setProviderEnabled);
  const models = useAIConfigStore((state) => state.config.models);

  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(SETTING_DEFAULTS));
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);
  const [promptDraft, setPromptDraft] = useState(config.ai_system_prompt);
  const [runtime, setRuntime] = useState<{ source: string; dir: string; available: boolean; ready: boolean } | null>(null);

  useEffect(() => {
    setPromptDraft(config.ai_system_prompt);
  }, [config.ai_system_prompt]);

  const save = useCallback(async (name: string, value: SettingValue) => {
    try {
      const result = await window.electron?.updateSetting({ name, value });
      if (result && result.code !== 0) addToast({ type: 'error', message: result.msg });
    } catch {
      addToast({ type: 'error', message: '设置保存失败，请重试' });
    }
  }, [addToast]);

  const updateDraft = (name: string, value: string) => {
    setDraft((previous) => ({ ...previous, [name]: value }));
  };

  const setToggle = (name: string, enabled: boolean) => {
    updateDraft(name, enabled ? '1' : '0');
    void save(name, enabled ? 1 : 0);
  };

  const commitNumber = (name: string, min: number, max: number) => {
    const parsed = Math.trunc(Number(draft[name]));
    if (!Number.isFinite(parsed)) {
      updateDraft(name, String(SETTING_DEFAULTS[name]));
      return;
    }
    const clamped = Math.min(Math.max(parsed, min), max);
    if (draft[name] === String(clamped)) return;
    updateDraft(name, String(clamped));
    void save(name, clamped);
  };

  const loadShortcuts = useCallback(async () => {
    if (!window.electron) return;
    try {
      const list = await window.electron.getShortcuts();
      const filtered = list.filter(
        (item) =>
          item.name === 'translateSelection' ||
          item.name === 'translateScreenshot' ||
          item.name === 'translatePopup' ||
          item.tag === '划词翻译' ||
          item.tag === '截图翻译' ||
          item.tag === '打开翻译弹窗',
      );
      // 打开翻译弹窗快捷键置于区域最上方
      const popup = filtered.find((item) => item.name === 'translatePopup');
      setShortcuts(
        popup ? [popup, ...filtered.filter((item) => item.name !== 'translatePopup')] : filtered,
      );
    } catch {
      setShortcuts([]);
    }
  }, []);

  const handleResetShortcuts = async () => {
    if (!window.electron) return;
    try {
      const result = await window.electron.resetShortcuts();
      if (result.code === 0) {
        addToast({ type: 'success', message: result.msg });
        void loadShortcuts();
      } else {
        addToast({ type: 'error', message: result.msg });
      }
    } catch {
      addToast({ type: 'error', message: '恢复默认快捷键失败' });
    }
  };

  useEffect(() => {
    if (!window.electron) return;
    void (async () => {
      try {
        const items = await window.electron!.getSettings();
        setDraft((previous) => {
          const next = { ...previous };
          items.forEach((item) => {
            if (!(item.name in next)) return;
            if (typeof item.value === 'object' && item.value !== null) return;
            next[item.name] = String(item.value);
          });
          return next;
        });
      } catch {
        // 读取失败时保留默认值，不影响页面渲染
      }
    })();
    void loadShortcuts();
  }, [loadShortcuts]);

  const handleUpdateShortcut = async (shortcut: ShortcutItem) => {
    if (!window.electron) return;
    try {
      const result = await window.electron.updateShortcut({ ...shortcut, flag: true });
      if (result.code === 0) {
        setShortcuts((previous) => previous.map((item) => (item.id === shortcut.id ? shortcut : item)));
        addToast({ type: 'success', message: result.msg });
      } else {
        addToast({ type: 'error', message: result.msg });
        void loadShortcuts();
      }
    } catch {
      addToast({ type: 'error', message: '更新快捷键失败' });
    }
  };

  /** 刷新 OCR 运行时信息与状态（设置页状态行） */
  const loadRuntime = useCallback(async () => {
    if (!window.electron) return;
    try {
      const info = await window.electron.ocr.runtimeInfo();
      setRuntime(info);
    } catch {
      // 读取失败时保持现状，不影响页面渲染
    }
  }, []);

  useEffect(() => {
    void loadRuntime();
  }, [loadRuntime]);

  const handleStartStop = async () => {
    if (runtime?.ready) {
      await window.electron?.ocr.stop();
    } else {
      await window.electron?.ocr.start();
    }
    await loadRuntime();
  };

  const onlineEnabled = config.providers.find((provider) => provider.id === 'online')?.enabled ?? false;
  const aiEnabled = config.providers.find((provider) => provider.id === 'ai')?.enabled ?? false;

  return (
    <SettingCard>
      <div className="flex items-center gap-2 p-4 settings-section-header">
        <div className="flex h-5 w-5 items-center justify-center text-primary">
          <Languages size={16} />
        </div>
        <h2 className="text-sm font-semibold text-content-primary">翻译设置</h2>
      </div>

      <div className="flex items-center justify-between border-b border-content-light px-4 py-2">
        <div>
          <span className="text-sm text-content-primary">启用翻译功能</span>
        </div>
        <ToggleSwitch
          checked={draft.translateEnabled === '1'}
          onChange={(value) => setToggle('translateEnabled', value)}
        />
      </div>

      <SettingSection title="翻译源" subtitle="划词浮层与截图翻译共用" icon={<Languages size={14} />}>
        <div className={toggleRowClass}>
          <span className="text-sm text-content-primary">启用在线翻译</span>
          <ToggleSwitch checked={onlineEnabled} onChange={(value) => setProviderEnabled('online', value)} />
        </div>
        <div className={toggleRowClass}>
          <span className="text-sm text-content-primary">启用 AI 翻译</span>
          <ToggleSwitch checked={aiEnabled} onChange={(value) => setProviderEnabled('ai', value)} />
        </div>
        <SettingRow label="主翻译源">
          <div className="w-40">
            <Select
              value={config.primary_provider}
              onChange={(value) => updateConfig({ primary_provider: value as TranslateProviderId })}
              options={config.providers.map((provider) => ({ value: provider.id, label: PROVIDER_LABELS[provider.id] }))}
              dense
              className={selectClass}
            />
          </div>
        </SettingRow>
        <div className={toggleRowClass}>
          <span className="text-sm text-content-primary">同时显示全部已启用源</span>
          <ToggleSwitch checked={config.show_all_providers} onChange={(value) => updateConfig({ show_all_providers: value })} />
        </div>
        <SettingRow label="AI 模型">
          <div className="w-40">
            <Select
              value={config.ai_model_id ?? ''}
              onChange={(value) => updateConfig({ ai_model_id: value || null })}
              options={[
                { value: '', label: '跟随 AI 设置默认模型' },
                ...models.map((model) => ({ value: model.id, label: model.display_name || model.model_id })),
              ]}
              dense
              className={selectClass}
            />
          </div>
        </SettingRow>
        <SettingRow label="默认语言">
          <div className="flex items-center gap-2">
            <div className="w-32">
              <Select
                value={config.source_lang}
                onChange={(value) => updateConfig({ source_lang: value })}
                options={LANGUAGES.map((language) => ({ value: language.code, label: language.label }))}
                dense
                className={selectClass}
              />
            </div>
            <span className="text-xs text-content-tertiary">→</span>
            <div className="w-32">
              <Select
                value={config.target_lang}
                onChange={(value) => updateConfig({ target_lang: value })}
                options={LANGUAGES.map((language) => ({ value: language.code, label: language.label }))}
                dense
                className={selectClass}
              />
            </div>
          </div>
        </SettingRow>
        <div className={toggleRowClass}>
          <span className="text-sm text-content-primary">输入时自动翻译</span>
          <ToggleSwitch
            checked={config.auto_translate_on_input}
            onChange={(value) => updateConfig({ auto_translate_on_input: value })}
          />
        </div>
        <div className="px-4 py-2">
          <p className="mb-1 text-xs text-content-secondary">AI 系统提示词（留空使用内置提示词）</p>
          <textarea
            className={`${inputClass} w-full modal-detail-scroll min-h-16 resize-y`}
            value={promptDraft}
            placeholder="例如：请把文本翻译为简体中文，只输出译文"
            onChange={(event) => {
              setPromptDraft(event.target.value);
              updateConfig({ ai_system_prompt: event.target.value });
            }}
          />
        </div>
      </SettingSection>

      <SettingSection title="文字识别（截图翻译）" subtitle="原生引擎" icon={<ScanText size={14} />}>
        <div className="border-b border-content-light px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${runtime?.ready ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-content-secondary'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${runtime?.ready ? 'bg-green-500' : 'bg-gray-400'}`} />
              {runtime?.ready ? '引擎就绪' : '未启动'}
            </span>
            <span className="text-xs text-content-tertiary">{runtime?.dir ?? ''}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleStartStop()}
              className="rounded-md border border-content px-2 py-1.5 text-xs text-content-primary transition-colors hover:bg-menu-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {runtime?.ready ? '停止引擎' : '启动引擎'}
            </button>
          </div>
        </div>
        <div className={toggleRowClass}>
          <span className="text-sm text-content-primary">识别结果写入剪贴板</span>
          <ToggleSwitch
            checked={draft.translateOcrWriteClipboard === '1'}
            onChange={(value) => setToggle('translateOcrWriteClipboard', value)}
          />
        </div>
        <div className={toggleRowClass}>
          <span className="text-sm text-content-primary">换行替换为空格</span>
          <ToggleSwitch
            checked={draft.translateOcrWrapReplaceSpace === '1'}
            onChange={(value) => {
              setToggle('translateOcrWrapReplaceSpace', value);
              if (value) setToggle('translateOcrWrapRemove', false);
            }}
          />
        </div>
        <div className={toggleRowClass}>
          <span className="text-sm text-content-primary">移除换行</span>
          <ToggleSwitch
            checked={draft.translateOcrWrapRemove === '1'}
            onChange={(value) => {
              setToggle('translateOcrWrapRemove', value);
              if (value) setToggle('translateOcrWrapReplaceSpace', false);
            }}
          />
        </div>
      </SettingSection>

      <SettingSection title="取词与浮层" icon={<SlidersHorizontal size={14} />}>
        <SettingRow label="取词延迟（毫秒）">
          <input
            type="number"
            min={100}
            max={3000}
            className={`${inputClass} w-24`}
            value={draft.translateChoiceDelay}
            onChange={(event) => updateDraft('translateChoiceDelay', event.target.value)}
            onBlur={() => commitNumber('translateChoiceDelay', 100, 3000)}
          />
        </SettingRow>
        <SettingRow label="浮层宽度（像素）">
          <input
            type="number"
            min={360}
            max={720}
            className={`${inputClass} w-24`}
            value={draft.translatePopupWidth}
            onChange={(event) => updateDraft('translatePopupWidth', event.target.value)}
            onBlur={() => commitNumber('translatePopupWidth', 360, 720)}
          />
        </SettingRow>
        <SettingRow label="浮层位置">
          <div className="w-40">
            <Select
              value={draft.translatePositionType}
              onChange={(value) => {
                updateDraft('translatePositionType', value);
                void save('translatePositionType', value);
              }}
              options={POSITION_OPTIONS}
              dense
              className={selectClass}
            />
          </div>
        </SettingRow>
        <div className={toggleRowClass}>
          <span className="text-sm text-content-primary">失焦自动隐藏</span>
          <ToggleSwitch
            checked={draft.translatePopupHideOnBlur === '1'}
            onChange={(value) => setToggle('translatePopupHideOnBlur', value)}
          />
        </div>
        <div className={toggleRowClass}>
          <span className="text-sm text-content-primary">浮层始终置顶</span>
          <ToggleSwitch
            checked={draft.translatePopupAlwaysOnTop === '1'}
            onChange={(value) => setToggle('translatePopupAlwaysOnTop', value)}
          />
        </div>
      </SettingSection>

      <SettingSection title="翻译记录" subtitle="记录列表在翻译浮层中查看（浮层右上角历史按钮）" icon={<History size={14} />}>
        <div className={toggleRowClass}>
          <span className="text-sm text-content-primary">保存翻译记录</span>
          <ToggleSwitch
            checked={draft.translateHistoryEnabled === '1'}
            onChange={(value) => setToggle('translateHistoryEnabled', value)}
          />
        </div>
        <SettingRow label="记录上限（条）">
          <input
            type="number"
            min={5}
            max={200}
            className={`${inputClass} w-24`}
            value={draft.translateHistoryLimit}
            onChange={(event) => updateDraft('translateHistoryLimit', event.target.value)}
            onBlur={() => commitNumber('translateHistoryLimit', 5, 200)}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="快捷键" icon={<Keyboard size={14} />}>
        <div className="flex items-center justify-between border-b border-content-light px-4 py-2">
          <span className="text-xs text-content-tertiary">全局快捷键</span>
          <button
            type="button"
            onClick={() => void handleResetShortcuts()}
            className="rounded-md border border-content px-2 py-1 text-xs text-content-primary transition-colors hover:bg-menu-hover"
          >
            恢复默认
          </button>
        </div>
        {shortcuts.length === 0 ? (
          <p className="px-4 py-3 text-xs text-content-tertiary">未找到翻译快捷键配置。</p>
        ) : (
          shortcuts.map((shortcut) => (
            <ShortcutRow
              key={shortcut.id}
              shortcut={shortcut}
              allShortcuts={shortcuts}
              onUpdate={(next) => void handleUpdateShortcut(next)}
            />
          ))
        )}
      </SettingSection>
    </SettingCard>
  );
};

export default TranslateTab;
