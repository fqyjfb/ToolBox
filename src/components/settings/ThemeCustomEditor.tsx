import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, ImageOff, Plus, RotateCcw, Save, Trash2, Upload, X } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import ColorPicker from './ColorPicker';
import SettingCard from './SettingCard';
import ThemePreview from './ThemePreview';
import { useThemeStore } from '../../store/themeStore';
import { useToastStore } from '../../store/toastStore';
import {
  BACKGROUND_POSITION_OPTIONS,
  BACKGROUND_REPEAT_OPTIONS,
  BACKGROUND_SIZE_OPTIONS,
  PAGE_BG_COLOR_DESC,
  THEME_COLOR_GROUPS,
  THEME_PRESETS,
  buildPresetTheme,
  getPresetSwatch,
  sanitizeThemeForPreview,
} from '../../constants/theme';
import {
  BgImageItem,
  CUSTOM_THEME_STORAGE_FULL,
  CustomTheme,
  getDefaultTheme,
  withThemeDefaults,
} from '../../types/theme';
import {
  MAX_BG_IMAGE_BYTES,
  compressImageToDataUrl,
  formatBytesToMB,
  isBgImageSizeSafe,
} from '../../utils/imageCompress';
import { localStorageService, STORAGE_KEYS } from '../../services/localStorageService';
import { toCssUrl } from '../../utils/themeInject';

/** 图库条目 id：同一毫秒连续添加也不会撞 React key */
let bgImageSeq = 0;
const newBgImageId = () => `bg-${Date.now()}-${++bgImageSeq}`;

const SELECT_CLASS =
  'text-xs px-1.5 py-0.5 rounded border border-content bg-surface text-content-primary focus:outline-none focus:border-primary';
const ACTION_CLASS =
  'inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-content bg-surface text-content-primary hover:bg-menu-hover disabled:opacity-50 disabled:cursor-not-allowed';

const GroupTitle: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className="flex items-center gap-2 pt-1">
    <h4 className="text-xs font-semibold text-content-primary">{title}</h4>
    {hint && <span className="text-2xs text-content-tertiary">{hint}</span>}
  </div>
);

const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-2 py-0.5">
    <span className="text-xs text-content-secondary w-20 shrink-0">{label}</span>
    {children}
  </div>
);

const PercentRow: React.FC<{
  label: string;
  value: number;
  hint?: string;
  onChange: (value: number) => void;
}> = ({ label, value, hint, onChange }) => (
  <div className="py-0.5">
    <div className="flex items-center gap-2">
      <span className="text-xs text-content-secondary w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="flex-1"
      />
      <span className="text-xs text-content-tertiary w-9 text-right">{value}%</span>
    </div>
    {hint && <p className="text-2xs text-content-tertiary pl-20">{hint}</p>}
  </div>
);

/**
 * 自定义主题编辑器。
 * 采用草稿机制：所有改动先落在 draft，点击「保存主题」才写入 store 与 localStorage，
 * 避免输入半成品颜色值时页面闪烁。
 */
const ThemeCustomEditor: React.FC = () => {
  const {
    isDark,
    customTheme,
    setCustomTheme,
    setBaseTheme,
    deleteCustomTheme,
    previewCustomTheme,
    restoreSavedTheme,
  } = useThemeStore(
    useShallow((s) => ({
      isDark: s.isDark,
      customTheme: s.customTheme,
      setCustomTheme: s.setCustomTheme,
      setBaseTheme: s.setBaseTheme,
      deleteCustomTheme: s.deleteCustomTheme,
      previewCustomTheme: s.previewCustomTheme,
      restoreSavedTheme: s.restoreSavedTheme,
    }))
  );
  const addToast = useToastStore((s) => s.addToast);

  const [draft, setDraft] = useState<CustomTheme>(() => customTheme ?? getDefaultTheme(isDark));
  // 明暗基色同样进草稿：预览态不得落盘，只有点击保存才同步给 store
  const [draftIsDark, setDraftIsDark] = useState(isDark);
  const [isCompressing, setIsCompressing] = useState(false);
  const [bgImages, setBgImages] = useState<BgImageItem[]>(() =>
    localStorageService.get<BgImageItem[]>(STORAGE_KEYS.CUSTOM_BG_IMAGES, []),
  );
  const [networkUrl, setNetworkUrl] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const imageInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const baseTheme = getDefaultTheme(draftIsDark);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(customTheme) || draftIsDark !== isDark;

  // 草稿 → 全站：预设、取色器、滑块、背景图、导入等所有 draft 变更都由这里统一推送，
  // 因此未保存时全站即可所见即所得，而 localStorage / 主进程不受影响。
  useEffect(() => {
    previewCustomTheme(sanitizeThemeForPreview(draft, draftIsDark), draftIsDark);
  }, [draft, draftIsDark, previewCustomTheme]);

  // 仅在卸载时回滚，避免未保存的预览残留在 --ct-* 与 .dark 上
  useEffect(() => () => restoreSavedTheme(), [restoreSavedTheme]);

  const update = <K extends keyof CustomTheme>(key: K, value: CustomTheme[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    try {
      // 预览、保存、导入共用同一份规范化结果：颜色合法性 / 数值范围 / 枚举都在此收敛
      const themeToSave = withThemeDefaults(draft, draftIsDark);
      // 先写配色：setCustomTheme 唯一可能失败的是首步落盘，失败时基色保持不变；
      // 成功后 setBaseTheme 会按新基色重新注入并同步，最终状态一致。
      setCustomTheme(themeToSave);
      if (draftIsDark !== isDark) setBaseTheme(draftIsDark);
      setDraft(themeToSave);
      addToast({ type: 'success', message: '自定义主题已保存并生效' });
    } catch (error) {
      addToast({
        type: 'warning',
        message:
          error instanceof Error && error.message === CUSTOM_THEME_STORAGE_FULL
            ? '存储空间不足，请移除背景图或改用更小的图片'
            : '自定义主题保存失败',
      });
    }
  };

  /** 恢复默认只重置配色；背景图与透明度属于个人材质设置，原样保留 */
  const handleReset = () => {
    setDraft((prev) => ({
      ...getDefaultTheme(draftIsDark),
      bgImage: prev.bgImage,
      bgOpacity: prev.bgOpacity,
      bgSize: prev.bgSize,
      bgPosition: prev.bgPosition,
      bgRepeat: prev.bgRepeat,
      surfaceOpacity: prev.surfaceOpacity,
    }));
    addToast({ type: 'info', message: '已恢复为当前明暗预设的默认配色，背景图与透明度保留，点击保存后才会保留' });
  };

  /** 放弃草稿：回到最近一次保存的主题（预览也随下一次 effect 复位） */
  const handleDiscard = () => {
    setDraft(customTheme ?? getDefaultTheme(isDark));
    setDraftIsDark(isDark);
    restoreSavedTheme();
  };

  const handleDelete = () => {
    deleteCustomTheme();
    localStorageService.remove(STORAGE_KEYS.CUSTOM_BG_IMAGES);
    setBgImages([]);
    setBrokenIds(new Set());
    addToast({ type: 'info', message: '已删除自定义主题，已切回明暗预设' });
  };

  // 预设模板：基色只进草稿，不直接调 setBaseTheme —— 后者会立即落盘并同步主进程，
  // 而草稿此时尚未保存，会留下「基色已改、配色未改」的残留状态。
  // 预设只负责配色：背景图 / 图片透明度 / 铺放方式 / 表面透明度属于个人设置，切换预设时原样保留，
  // 页面底色是配色的一部分，仍跟随预设。
  const handlePresetClick = (presetId: string) => {
    const preset = THEME_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setDraftIsDark(preset.base === 'dark');
    setDraft((prev) => ({
      ...buildPresetTheme(preset),
      bgImage: prev.bgImage,
      bgOpacity: prev.bgOpacity,
      bgSize: prev.bgSize,
      bgPosition: prev.bgPosition,
      bgRepeat: prev.bgRepeat,
      surfaceOpacity: prev.surfaceOpacity,
    }));
    addToast({
      type: 'info',
      message: `已应用预设「${preset.name}」，背景图与表面透明度保留，点击保存后才会保留`,
    });
  };

  const handleImagePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsCompressing(true);
    try {
      const result = await compressImageToDataUrl(file);
      if (result.dataUrl) {
        update('bgImage', result.dataUrl);
        // 同步入库（去重）
        if (!bgImages.some(item => item.url === result.dataUrl)) {
          const next = [...bgImages, {
            id: newBgImageId(),
            url: result.dataUrl,
            source: 'upload' as const,
            name: file.name,
          }];
          if (persistBgImages(next)) {
            setBgImages(next);
          } else {
            addToast({ type: 'warning', message: '图片库存储空间不足，已应用但无法加入图库' });
          }
        }
        addToast({
          type: 'success',
          message: `背景图已就绪（${formatBytesToMB(result.compressedSize)}）；图片库已保存，当前主题需点击「保存主题」才会保留`,
        });
        return;
      }
      addToast({
        type: 'warning',
        message:
          result.reason === 'oversize'
            ? `图片压缩后仍有 ${formatBytesToMB(result.compressedSize)}，超过 ${formatBytesToMB(MAX_BG_IMAGE_BYTES)} 上限，请换一张更小的图片`
            : '图片读取失败，请换一张图片重试',
      });
    } finally {
      setIsCompressing(false);
    }
  };

  const persistBgImages = (items: BgImageItem[]): boolean => {
    if (!localStorageService.set(STORAGE_KEYS.CUSTOM_BG_IMAGES, items)) {
      addToast({ type: 'warning', message: '图片库存储空间不足，部分操作可能未持久化' });
      return false;
    }
    return true;
  };

  const handleAddNetworkUrl = () => {
    const url = networkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\/.+/.test(url)) {
      addToast({ type: 'warning', message: '请输入有效的图片地址（以 http:// 或 https:// 开头）' });
      return;
    }
    if (bgImages.some(item => item.url === url)) {
      addToast({ type: 'info', message: '该图片地址已在库中' });
      return;
    }
    const next = [...bgImages, {
      id: newBgImageId(),
      url,
      source: 'network' as const,
      name: url.length > 40 ? url.slice(0, 40) + '…' : url,
    }];
    if (persistBgImages(next)) {
      setBgImages(next);
      update('bgImage', url);
      setNetworkUrl('');
      addToast({ type: 'success', message: '图片地址已存入图库并应用，当前主题需点击「保存主题」才会保留' });
    }
  };

  const handleSelectBgImage = (item: BgImageItem) => {
    update('bgImage', item.url);
    addToast({ type: 'info', message: '已切换背景图，点击保存后才会保留' });
  };

  const handleDeleteBgImage = (id: string) => {
    const item = bgImages.find(i => i.id === id);
    if (!item) return;
    const next = bgImages.filter(i => i.id !== id);
    if (persistBgImages(next)) {
      setBgImages(next);
      if (draft.bgImage === item.url) update('bgImage', '');
      setBrokenIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleExport = () => {
    // 带上草稿的明暗基色，导入时不必再猜用户当时用的是哪套预设
    const blob = new Blob([JSON.stringify({ ...draft, isDark: draftIsDark }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'toolbox-theme.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => addToast({ type: 'warning', message: '主题文件读取失败' });
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('INVALID_THEME');
        }
        const data = parsed as Record<string, unknown>;
        // 至少包含一个已知主题字段，避免任意 JSON 静默把用户配色重置为默认值
        if (!Object.keys(getDefaultTheme(draftIsDark)).some((key) => key in data)) {
          throw new Error('INVALID_THEME');
        }
        // 导入前校验背景图体积，避免导入后在保存阶段才触发存储配额错误
        if (typeof data.bgImage === 'string' && data.bgImage && !isBgImageSizeSafe(data.bgImage)) {
          addToast({ type: 'warning', message: '导入的主题背景图过大，请先压缩或移除背景图后再导入' });
          return;
        }
        const importedIsDark = typeof data.isDark === 'boolean' ? data.isDark : draftIsDark;
        setDraftIsDark(importedIsDark);
        // withThemeDefaults 只按已知字段取值，导出附带的 isDark 不会进入主题
        setDraft(withThemeDefaults(data as Partial<CustomTheme>, importedIsDark));
        addToast({ type: 'success', message: '主题配置已导入，点击保存后才会保留' });
      } catch (error) {
        addToast({
          type: 'warning',
          message: error instanceof Error && error.message === 'INVALID_THEME'
            ? '主题文件内容无效，请确认是本页导出的 JSON'
            : '主题文件解析失败，请确认是本页导出的 JSON',
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-2xs text-content-tertiary">调整会实时预览，点击「保存主题」后才会保留</p>
        {isDirty && (
          <span className="text-2xs px-1.5 py-0.5 rounded bg-menu-hover text-content-secondary">
            有未保存的修改
          </span>
        )}
      </div>

      <GroupTitle title="预设模板" hint="一键填充配色，背景图与表面透明度保留" />
      <div className={`flex flex-wrap gap-1.5 ${isCompressing ? 'pointer-events-none opacity-50' : ''}`}>
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handlePresetClick(preset.id)}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded bg-surface text-content-primary hover:bg-menu-hover"
          >
            <span className="flex rounded-sm overflow-hidden ring-1 ring-border" aria-hidden="true">
              {getPresetSwatch(preset).map((color, index) => (
                <span
                  key={`${preset.id}-${index}`}
                  className="w-2 h-3"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
            {preset.name}
          </button>
        ))}
      </div>

      <GroupTitle title="实时预览" />
      <ThemePreview theme={draft} isDark={draftIsDark} />

      <GroupTitle title="背景" />
      <SettingCard className="px-3 py-2 border-0">
        <ColorPicker
          label="页面底色"
          value={draft.bgColor}
          defaultColor={baseTheme.bgColor}
          desc={PAGE_BG_COLOR_DESC}
          onChange={(value) => update('bgColor', value)}
        />
        <FieldRow label="背景图片">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImagePick}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isCompressing}
            className={ACTION_CLASS}
          >
            <Upload size={12} />
            {isCompressing ? '处理中…' : '选择图片'}
          </button>
          {draft.bgImage ? (
            <>
              <span
                className="inline-block w-14 h-8 rounded"
                style={{
                  backgroundImage: toCssUrl(draft.bgImage),
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                title="当前背景图"
              />
              <button
                type="button"
                onClick={() => update('bgImage', '')}
                title="移除背景图"
                aria-label="移除背景图"
                className="text-content-tertiary hover:text-error"
              >
                <Trash2 size={12} />
              </button>
            </>
          ) : (
            <span className="text-2xs text-content-tertiary">未设置，将使用纯色背景</span>
          )}
        </FieldRow>
        <FieldRow label="网络地址">
          <input
            type="text"
            value={networkUrl}
            onChange={(e) => setNetworkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddNetworkUrl(); }}
            placeholder="https://example.com/bg.jpg"
            className="flex-1 min-w-0 text-xs px-2 py-1 rounded border border-content bg-surface text-content-primary focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={handleAddNetworkUrl}
            className={ACTION_CLASS}
          >
            <Plus size={12} /> 添加
          </button>
        </FieldRow>
        {bgImages.length > 0 && (
          <div className="py-1">
            <span className="text-xs text-content-secondary">图片库（点击切换，悬停删除）</span>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {bgImages.map(item => {
                const isBroken = brokenIds.has(item.id);
                const isActive = draft.bgImage === item.url;
                return (
                  <div
                    key={item.id}
                    className="group relative cursor-pointer rounded"
                    onClick={() => !isBroken && handleSelectBgImage(item)}
                    title={item.name}
                  >
                    <div
                      className={`w-full h-12 rounded overflow-hidden flex items-center justify-center ${
                        isActive ? 'ring-1 ring-primary' : ''
                      } ${isBroken ? 'opacity-40' : ''}`}
                    >
                      {isBroken ? (
                        <ImageOff size={16} className="text-content-tertiary" />
                      ) : (
                        <img
                          src={item.url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={() => setBrokenIds(prev => { const s = new Set(prev); s.add(item.id); return s; })}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteBgImage(item.id); }}
                      className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="删除"
                    >
                      <X size={10} />
                    </button>
                    {item.source === 'network' && (
                      <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center text-white bg-black/40 truncate px-0.5 leading-tight py-0.5">
                        网络
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <PercentRow
          label="图片透明度"
          value={draft.bgOpacity}
          onChange={(value) => update('bgOpacity', value)}
        />
        <FieldRow label="铺放方式">
          <select
            value={draft.bgSize}
            onChange={(e) => update('bgSize', e.target.value as CustomTheme['bgSize'])}
            aria-label="背景图尺寸"
            className={SELECT_CLASS}
          >
            {BACKGROUND_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={draft.bgPosition}
            onChange={(e) => update('bgPosition', e.target.value as CustomTheme['bgPosition'])}
            aria-label="背景图位置"
            className={SELECT_CLASS}
          >
            {BACKGROUND_POSITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={draft.bgRepeat}
            onChange={(e) => update('bgRepeat', e.target.value as CustomTheme['bgRepeat'])}
            aria-label="背景图重复"
            className={SELECT_CLASS}
          >
            {BACKGROUND_REPEAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FieldRow>
      </SettingCard>

      <PercentRow
        label="表面透明度"
        value={draft.surfaceOpacity}
        hint="卡片、侧边栏、菜单等表面色与背景的混合比例，越低越透；背景图需调低此值才明显可见"
        onChange={(value) => update('surfaceOpacity', value)}
      />

      {THEME_COLOR_GROUPS.map((group) => {
        const isAdvanced = !!group.advanced;
        const expanded = !isAdvanced || advancedOpen;
        return (
          <div key={group.title}>
            {isAdvanced ? (
              <button
                type="button"
                onClick={() => setAdvancedOpen((o) => !o)}
                className="flex w-full items-center gap-1 text-left"
                aria-expanded={advancedOpen}
              >
                <GroupTitle title={group.title} hint={group.hint} />
                <ChevronDown
                  size={14}
                  className={`text-content-tertiary transition-transform ${advancedOpen ? '' : '-rotate-90'}`}
                />
              </button>
            ) : (
              <GroupTitle title={group.title} hint={group.hint} />
            )}
            {expanded && (
              <SettingCard className="px-3 py-2 border-0">
                {group.fields.map((field) => (
                  <ColorPicker
                    key={field.key}
                    label={field.label}
                    value={draft[field.key]}
                    defaultColor={baseTheme[field.key] ?? ''}
                    desc={field.desc}
                    onChange={(value) => update(field.key, value)}
                  />
                ))}
              </SettingCard>
            )}
          </div>
        );
      })}

      <div className={`flex flex-wrap gap-1.5 pt-3 ${isCompressing ? 'pointer-events-none opacity-50' : ''}`}>
        <button
          type="button"
          onClick={handleSave}
          disabled={isCompressing}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-primary text-button-text hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={12} /> 保存
        </button>
        <button type="button" onClick={handleDiscard} disabled={!isDirty} className={ACTION_CLASS}>
          <X size={12} /> 放弃
        </button>
        <button type="button" onClick={handleReset} className={ACTION_CLASS}>
          <RotateCcw size={12} /> 默认
        </button>
        <button type="button" onClick={handleExport} className={ACTION_CLASS}>
          <Download size={12} /> 导出
        </button>
        <button type="button" onClick={() => importInputRef.current?.click()} className={ACTION_CLASS}>
          <Upload size={12} /> 导入
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          className="hidden"
        />
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-error text-error hover:bg-menu-hover"
        >
          <Trash2 size={12} /> 预设
        </button>
      </div>
    </div>
  );
};

export default ThemeCustomEditor;
