import React, { useState, useEffect, useCallback } from 'react';
import { Network, RefreshCw, Check, X, Loader2, Database, Key, Package, Download, Save } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import { logError, logInfo } from '../../services/loggerService';
import { reinitSupabase } from '../../services/supabase';
import { setEncryptionKey, validateEncryptionKey } from '../../utils/crypto';
import SettingCard from './SettingCard';
import ConfirmDialog from '../ui/ConfirmDialog';
import type { NetworkConfig, NetworkTestResult } from '../../types/network';

// 默认值用于占位符显示，不预填表单
const DEFAULT_CONFIG: NetworkConfig = {
  appUpdate: {
    checkUrl: 'https://api.github.com/repos/fqyjfb/ToolBox/releases/latest',
    repoUrl: 'https://github.com/fqyjfb/ToolBox',
    requestTimeout: 10000,
  },
  hotNews: {
    primaryUrl: 'https://60s.viki.moe/v2',
    fallbackUrl: 'https://60s.mizhoubaobei.top/v2',
    requestTimeout: 15000,
  },
  pluginStore: {
    registryUrls: [
      'https://raw.githubusercontent.com/fqyjfb/toolbox-plugins-registry/main/registry.json',
      'https://raw.fastgit.org/fqyjfb/toolbox-plugins-registry/main/registry.json',
      'https://raw.gitmirror.com/fqyjfb/toolbox-plugins-registry/main/registry.json',
    ],
    githubRawMirrors: [
      'https://raw.githubusercontent.com',
      'https://raw.fastgit.org',
      'https://raw.gitmirror.com',
    ],
    githubApiMirrors: ['https://api.github.com'],
    requestTimeout: 15000,
  },
  iconCache: {
    ttl: 604800000,
    maxItems: 500,
    requestTimeout: 10000,
  },
};

const createEmptyForm = (): NetworkConfig => ({
  appUpdate: { checkUrl: '', repoUrl: '', requestTimeout: 0 },
  hotNews: { primaryUrl: '', fallbackUrl: '', requestTimeout: 0 },
  pluginStore: { registryUrls: [], githubRawMirrors: [], githubApiMirrors: [], requestTimeout: 0 },
  iconCache: { ttl: 0, maxItems: 0, requestTimeout: 0 },
});

const isValidUrl = (url: string): boolean => /^https?:\/\/.+/.test(url.trim());

const NetworkTab: React.FC = () => {
  const addToast = useToastStore(state => state.addToast);
  const [form, setForm] = useState(createEmptyForm());
  const [supabaseForm, setSupabaseForm] = useState({ url: '', anonKey: '' });
  const [encryptionKeyInput, setEncryptionKeyInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testStates, setTestStates] = useState<Record<string, 'loading' | NetworkTestResult | null>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        if (window.electron) {
          const settings = await window.electron.getSettings();
          const nc = settings.find(s => s.name === 'networkConfig')?.value as Partial<NetworkConfig> | undefined;
          if (nc) {
            setForm({
              appUpdate: {
                checkUrl: nc.appUpdate?.checkUrl && nc.appUpdate.checkUrl !== DEFAULT_CONFIG.appUpdate.checkUrl ? nc.appUpdate.checkUrl : '',
                repoUrl: nc.appUpdate?.repoUrl && nc.appUpdate.repoUrl !== DEFAULT_CONFIG.appUpdate.repoUrl ? nc.appUpdate.repoUrl : '',
                requestTimeout: nc.appUpdate?.requestTimeout && nc.appUpdate.requestTimeout !== DEFAULT_CONFIG.appUpdate.requestTimeout ? nc.appUpdate.requestTimeout : 0,
              },
              hotNews: {
                primaryUrl: nc.hotNews?.primaryUrl && nc.hotNews.primaryUrl !== DEFAULT_CONFIG.hotNews.primaryUrl ? nc.hotNews.primaryUrl : '',
                fallbackUrl: nc.hotNews?.fallbackUrl && nc.hotNews.fallbackUrl !== DEFAULT_CONFIG.hotNews.fallbackUrl ? nc.hotNews.fallbackUrl : '',
                requestTimeout: nc.hotNews?.requestTimeout && nc.hotNews.requestTimeout !== DEFAULT_CONFIG.hotNews.requestTimeout ? nc.hotNews.requestTimeout : 0,
              },
              pluginStore: {
                registryUrls: nc.pluginStore?.registryUrls && JSON.stringify(nc.pluginStore.registryUrls) !== JSON.stringify(DEFAULT_CONFIG.pluginStore.registryUrls) ? nc.pluginStore.registryUrls : [],
                githubRawMirrors: nc.pluginStore?.githubRawMirrors && JSON.stringify(nc.pluginStore.githubRawMirrors) !== JSON.stringify(DEFAULT_CONFIG.pluginStore.githubRawMirrors) ? nc.pluginStore.githubRawMirrors : [],
                githubApiMirrors: nc.pluginStore?.githubApiMirrors && JSON.stringify(nc.pluginStore.githubApiMirrors) !== JSON.stringify(DEFAULT_CONFIG.pluginStore.githubApiMirrors) ? nc.pluginStore.githubApiMirrors : [],
                requestTimeout: nc.pluginStore?.requestTimeout && nc.pluginStore.requestTimeout !== DEFAULT_CONFIG.pluginStore.requestTimeout ? nc.pluginStore.requestTimeout : 0,
              },
              iconCache: {
                ttl: nc.iconCache?.ttl && nc.iconCache.ttl !== DEFAULT_CONFIG.iconCache.ttl ? nc.iconCache.ttl : 0,
                maxItems: nc.iconCache?.maxItems && nc.iconCache.maxItems !== DEFAULT_CONFIG.iconCache.maxItems ? nc.iconCache.maxItems : 0,
                requestTimeout: nc.iconCache?.requestTimeout && nc.iconCache.requestTimeout !== DEFAULT_CONFIG.iconCache.requestTimeout ? nc.iconCache.requestTimeout : 0,
              },
            });
          }
          // 加载 Supabase 自定义配置
          const sc = settings.find(s => s.name === 'supabaseConfig')?.value as { url?: string; anonKey?: string } | undefined;
          if (sc?.url) setSupabaseForm({ url: sc.url, anonKey: sc.anonKey || '' });
          // 加载加密密钥自定义配置
          const ek = settings.find(s => s.name === 'encryptionKey')?.value as string | undefined;
          if (ek) setEncryptionKeyInput(ek);
        }
      } catch (error) {
        logError('Failed to load network config', 'NetworkTab', error as Error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleTest = useCallback(async (key: string, url: string) => {
    if (!url.trim()) {
      addToast({ type: 'warning', message: '请先填写 URL' });
      return;
    }
    if (!isValidUrl(url)) {
      addToast({ type: 'error', message: 'URL 必须以 http:// 或 https:// 开头' });
      return;
    }
    setTestStates(prev => ({ ...prev, [key]: 'loading' }));
    try {
      const result = window.electron
        ? await window.electron.networkTest({ url: url.trim(), timeout: 8000 })
        : { ok: false, statusCode: 0, latencyMs: 0, error: 'Electron 不可用' };
      setTestStates(prev => ({ ...prev, [key]: result }));
    } catch (error) {
      setTestStates(prev => ({ ...prev, [key]: { ok: false, statusCode: 0, latencyMs: 0, error: (error as Error).message } }));
    }
  }, [addToast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (window.electron) {
        await window.electron.updateSetting({ name: 'networkConfig', value: form });
        // 保存 Supabase 配置（空值表示使用打包时的环境变量）
        await window.electron.updateSetting({ name: 'supabaseConfig', value: supabaseForm });
        // 保存加密密钥（空值表示使用打包时的环境变量）
        await window.electron.updateSetting({ name: 'encryptionKey', value: encryptionKeyInput });

        // 运行时应用 Supabase 和加密密钥
        if (supabaseForm.url && supabaseForm.anonKey) {
          reinitSupabase(supabaseForm.url, supabaseForm.anonKey);
        }
        if (encryptionKeyInput) {
          setEncryptionKey(encryptionKeyInput);
        }

        if (validateEncryptionKey()) {
          logInfo('加密密钥已应用', 'NetworkTab');
        }

        addToast({ type: 'success', message: '网络配置已保存' });
      }
    } catch (error) {
      logError('Failed to save network config', 'NetworkTab', error as Error);
      addToast({ type: 'error', message: '保存失败，请重试' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAll = () => {
    setForm(createEmptyForm());
    setSupabaseForm({ url: '', anonKey: '' });
    setEncryptionKeyInput('');
    setTestStates({});
    setShowResetConfirm(false);
    addToast({ type: 'success', message: '已恢复默认，请点击保存生效' });
  };

  const updateField = <K extends keyof typeof form, F extends keyof typeof form[K]>(
    section: K, field: F, value: typeof form[K][F]
  ) => {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const urlsToText = (urls: string[]) => urls.join('\n');
  const textToUrls = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);

  const renderTestButton = (key: string, url: string) => {
    const state = testStates[key];
    return (
      <button
        onClick={() => handleTest(key, url)}
        disabled={state === 'loading'}
        className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        title="测试连接"
      >
        {state === 'loading' ? <Loader2 size={14} className="animate-spin" /> : '测试'}
      </button>
    );
  };

  const renderTestResult = (key: string) => {
    const state = testStates[key];
    if (!state || state === 'loading') return null;
    return (
      <span className={`ml-2 text-xs flex items-center gap-1 ${state.ok ? 'text-green-600' : 'text-red-500'}`}>
        {state.ok ? <Check size={12} /> : <X size={12} />}
        {state.ok ? `${state.latencyMs}ms` : state.error || `HTTP ${state.statusCode}`}
      </span>
    );
  };

  const renderDefaultButton = (onClick: () => void) => (
    <button
      onClick={onClick}
      className="px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      title="清空（使用默认值）"
    >
      默认
    </button>
  );

  const inputCls = "w-64 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200";
  const numInputCls = "w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200";
  const textareaCls = "w-64 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-mono";
  const labelCls = "text-sm text-gray-700 dark:text-gray-300";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network size={20} className="text-blue-600" />
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">网络配置</h2>
        </div>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <RefreshCw size={14} />
          全部恢复默认
        </button>
      </div>

      <SettingCard>
        {/* 应用更新 */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center text-blue-600">
                <Network size={16} />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">应用更新</h3>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className={labelCls}>检查更新 API</span>
              <div className="flex items-center gap-2">
                <input type="text" value={form.appUpdate.checkUrl} onChange={e => updateField('appUpdate', 'checkUrl', e.target.value)} placeholder={DEFAULT_CONFIG.appUpdate.checkUrl} className={inputCls} />
                {renderTestButton('appUpdate.checkUrl', form.appUpdate.checkUrl)}
                {renderTestResult('appUpdate.checkUrl')}
                {renderDefaultButton(() => updateField('appUpdate', 'checkUrl', ''))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={labelCls}>仓库主页</span>
              <div className="flex items-center gap-2">
                <input type="text" value={form.appUpdate.repoUrl} onChange={e => updateField('appUpdate', 'repoUrl', e.target.value)} placeholder={DEFAULT_CONFIG.appUpdate.repoUrl} className={inputCls} />
                {renderDefaultButton(() => updateField('appUpdate', 'repoUrl', ''))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={labelCls}>请求超时 (ms)</span>
              <input type="number" value={form.appUpdate.requestTimeout || ''} onChange={e => updateField('appUpdate', 'requestTimeout', Number(e.target.value) || 0)} placeholder={String(DEFAULT_CONFIG.appUpdate.requestTimeout)} className={numInputCls} />
            </div>
          </div>
        </div>

        {/* 60s 新闻 API */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center text-blue-600">
                <Network size={16} />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">60s 新闻 API</h3>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className={labelCls}>主源</span>
              <div className="flex items-center gap-2">
                <input type="text" value={form.hotNews.primaryUrl} onChange={e => updateField('hotNews', 'primaryUrl', e.target.value)} placeholder={DEFAULT_CONFIG.hotNews.primaryUrl} className={inputCls} />
                {renderTestButton('hotNews.primaryUrl', form.hotNews.primaryUrl)}
                {renderTestResult('hotNews.primaryUrl')}
                {renderDefaultButton(() => updateField('hotNews', 'primaryUrl', ''))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={labelCls}>备源</span>
              <div className="flex items-center gap-2">
                <input type="text" value={form.hotNews.fallbackUrl} onChange={e => updateField('hotNews', 'fallbackUrl', e.target.value)} placeholder={DEFAULT_CONFIG.hotNews.fallbackUrl} className={inputCls} />
                {renderTestButton('hotNews.fallbackUrl', form.hotNews.fallbackUrl)}
                {renderTestResult('hotNews.fallbackUrl')}
                {renderDefaultButton(() => updateField('hotNews', 'fallbackUrl', ''))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={labelCls}>请求超时 (ms)</span>
              <input type="number" value={form.hotNews.requestTimeout || ''} onChange={e => updateField('hotNews', 'requestTimeout', Number(e.target.value) || 0)} placeholder={String(DEFAULT_CONFIG.hotNews.requestTimeout)} className={numInputCls} />
            </div>
          </div>
        </div>

        {/* 插件商店镜像 */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center text-blue-600">
                <Package size={16} />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">插件商店镜像</h3>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <span className={labelCls}>注册表镜像</span>
              <div className="flex items-center gap-2">
                <textarea rows={4} value={urlsToText(form.pluginStore.registryUrls)} onChange={e => updateField('pluginStore', 'registryUrls', textToUrls(e.target.value))} placeholder={DEFAULT_CONFIG.pluginStore.registryUrls.join('\n')} className={textareaCls} />
                {renderDefaultButton(() => updateField('pluginStore', 'registryUrls', []))}
              </div>
            </div>
            <div className="flex items-start justify-between">
              <span className={labelCls}>GitHub Raw</span>
              <div className="flex items-center gap-2">
                <textarea rows={4} value={urlsToText(form.pluginStore.githubRawMirrors)} onChange={e => updateField('pluginStore', 'githubRawMirrors', textToUrls(e.target.value))} placeholder={DEFAULT_CONFIG.pluginStore.githubRawMirrors.join('\n')} className={textareaCls} />
                {renderDefaultButton(() => updateField('pluginStore', 'githubRawMirrors', []))}
              </div>
            </div>
            <div className="flex items-start justify-between">
              <span className={labelCls}>GitHub API</span>
              <div className="flex items-center gap-2">
                <textarea rows={3} value={urlsToText(form.pluginStore.githubApiMirrors)} onChange={e => updateField('pluginStore', 'githubApiMirrors', textToUrls(e.target.value))} placeholder={DEFAULT_CONFIG.pluginStore.githubApiMirrors.join('\n')} className={textareaCls} />
                {renderDefaultButton(() => updateField('pluginStore', 'githubApiMirrors', []))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={labelCls}>请求超时 (ms)</span>
              <input type="number" value={form.pluginStore.requestTimeout || ''} onChange={e => updateField('pluginStore', 'requestTimeout', Number(e.target.value) || 0)} placeholder={String(DEFAULT_CONFIG.pluginStore.requestTimeout)} className={numInputCls} />
            </div>
          </div>
        </div>

        {/* 图标下载缓存 */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center text-blue-600">
                <Download size={16} />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">图标下载缓存</h3>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className={labelCls}>缓存有效期 (ms)</span>
              <input type="number" value={form.iconCache.ttl || ''} onChange={e => updateField('iconCache', 'ttl', Number(e.target.value) || 0)} placeholder={String(DEFAULT_CONFIG.iconCache.ttl)} className={numInputCls} />
            </div>
            <div className="flex items-center justify-between">
              <span className={labelCls}>最大条目</span>
              <input type="number" value={form.iconCache.maxItems || ''} onChange={e => updateField('iconCache', 'maxItems', Number(e.target.value) || 0)} placeholder={String(DEFAULT_CONFIG.iconCache.maxItems)} className={numInputCls} />
            </div>
            <div className="flex items-center justify-between">
              <span className={labelCls}>下载超时 (ms)</span>
              <input type="number" value={form.iconCache.requestTimeout || ''} onChange={e => updateField('iconCache', 'requestTimeout', Number(e.target.value) || 0)} placeholder={String(DEFAULT_CONFIG.iconCache.requestTimeout)} className={numInputCls} />
            </div>
          </div>
        </div>

        {/* Supabase 配置 */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center text-blue-600">
                <Database size={16} />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Supabase 配置</h3>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">留空表示使用打包时的默认配置。配置后无需重启即可生效。</p>
            <div className="flex items-center justify-between">
              <span className={labelCls}>Supabase URL</span>
              <div className="flex items-center gap-2">
                <input type="text" value={supabaseForm.url} onChange={e => setSupabaseForm(prev => ({ ...prev, url: e.target.value }))} placeholder="https://xxxx.supabase.co" className={inputCls} />
                {renderDefaultButton(() => setSupabaseForm(prev => ({ ...prev, url: '' })))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={labelCls}>Anon Key</span>
              <div className="flex items-center gap-2">
                <input type="text" value={supabaseForm.anonKey} onChange={e => setSupabaseForm(prev => ({ ...prev, anonKey: e.target.value }))} placeholder="eyJhbGciOiJIUzI1NiIs..." className={inputCls} />
                {renderDefaultButton(() => setSupabaseForm(prev => ({ ...prev, anonKey: '' })))}
              </div>
            </div>
          </div>
        </div>

        {/* 加密密钥配置 */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center text-blue-600">
                <Key size={16} />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">加密密钥</h3>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">用于本地敏感数据加密。留空表示使用打包时的默认配置。修改后新数据将使用新密钥，旧数据需用旧密钥解密。</p>
            <div className="flex items-center justify-between">
              <span className={labelCls}>加密密钥</span>
              <div className="flex items-center gap-2">
                <input type="text" value={encryptionKeyInput} onChange={e => setEncryptionKeyInput(e.target.value)} placeholder="留空使用默认" className={inputCls} />
                {renderDefaultButton(() => setEncryptionKeyInput(''))}
              </div>
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button onClick={() => { setForm(createEmptyForm()); setSupabaseForm({ url: '', anonKey: '' }); setEncryptionKeyInput(''); }} className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">取消</button>
          <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-gray-800 dark:bg-gray-700 rounded-md hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors disabled:opacity-50">
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            <Save size={14} />
            保存配置
          </button>
        </div>
      </SettingCard>

      <ConfirmDialog isOpen={showResetConfirm} title="全部恢复默认" message="将清空所有网络配置字段（仅清空表单，不影响已保存配置）。确认继续？" onConfirm={handleResetAll} onClose={() => setShowResetConfirm(false)} />
    </div>
  );
};

export default NetworkTab;
