import { logError, logInfo } from './loggerService';
import { PluginInfo, InstalledPlugin, PluginServiceResponse } from '../types/plugin';
import type { NetworkConfig } from '../types/network';

interface RegistryPlugin {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  iconUrl?: string;
  image?: string;
  color?: string;
  textColor?: string;
  version?: string;
  author?: string;
  categories?: string[];
  tags?: string[];
  githubRepo?: string;
  releaseUrl?: string;
  entry?: string;
  isBeta?: boolean;
}

export interface InstallProgress {
  status: 'starting' | 'downloading' | 'extracting' | 'installing' | 'completed' | 'error';
  message: string;
  progress: number;
  mirror?: string;
}

interface RawInstalledPlugin {
  id?: string;
  name?: string;
  description?: string;
  icon?: string;
  iconName?: string;
  iconUrl?: string;
  image?: string;
  color?: string;
  textColor?: string;
  version?: string;
  author?: string;
  enabled?: boolean;
  entry?: string;
  installedVersion?: string;
  categories?: string[];
  path?: string;
  tags?: string[];
  githubRepo?: string;
  isBeta?: boolean;
  installDate?: number;
  isPinned?: boolean;
}

const DEFAULT_PLUGIN_REGISTRY_URLS = [
  'https://raw.githubusercontent.com/fqyjfb/toolbox-plugins-registry/main/registry.json',
  'https://raw.fastgit.org/fqyjfb/toolbox-plugins-registry/main/registry.json',
  'https://raw.gitmirror.com/fqyjfb/toolbox-plugins-registry/main/registry.json',
];

const DEFAULT_GITHUB_RAW_MIRRORS = [
  'https://raw.githubusercontent.com',
  'https://raw.fastgit.org',
  'https://raw.gitmirror.com',
];

const DEFAULT_GITHUB_API_MIRRORS = [
  'https://api.github.com',
];

// 模块级缓存：首次调用时从主进程读 networkConfig.pluginStore，setting-changed 时置 null
let cachedPluginStore: NetworkConfig['pluginStore'] | null = null;

const loadPluginStoreConfig = async (): Promise<void> => {
  if (cachedPluginStore) return;
  if (window.electron) {
    try {
      const settings = await window.electron.getSettings();
      const nc = settings.find(s => s.name === 'networkConfig')?.value as NetworkConfig | undefined;
      if (nc?.pluginStore) {
        const ps = nc.pluginStore;
        cachedPluginStore = {
          registryUrls: ps.registryUrls && ps.registryUrls.length ? ps.registryUrls : DEFAULT_PLUGIN_REGISTRY_URLS,
          githubRawMirrors: ps.githubRawMirrors && ps.githubRawMirrors.length ? ps.githubRawMirrors : DEFAULT_GITHUB_RAW_MIRRORS,
          githubApiMirrors: ps.githubApiMirrors && ps.githubApiMirrors.length ? ps.githubApiMirrors : DEFAULT_GITHUB_API_MIRRORS,
          requestTimeout: ps.requestTimeout || 15000,
        };
        return;
      }
    } catch { /* 降级到默认 */ }
  }
  cachedPluginStore = {
    registryUrls: DEFAULT_PLUGIN_REGISTRY_URLS,
    githubRawMirrors: DEFAULT_GITHUB_RAW_MIRRORS,
    githubApiMirrors: DEFAULT_GITHUB_API_MIRRORS,
    requestTimeout: 15000,
  };
};

if (window.electron) {
  window.electron.onSettingChanged((setting) => {
    if (setting.name === 'networkConfig') cachedPluginStore = null;
  });
}

const getRegistryUrls = () => cachedPluginStore?.registryUrls || DEFAULT_PLUGIN_REGISTRY_URLS;
const getGithubRawMirrors = () => cachedPluginStore?.githubRawMirrors || DEFAULT_GITHUB_RAW_MIRRORS;
const getGithubApiMirrors = () => cachedPluginStore?.githubApiMirrors || DEFAULT_GITHUB_API_MIRRORS;
const getPluginRequestTimeout = () => cachedPluginStore?.requestTimeout || 15000;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout?: number): Promise<Response> {
  const actualTimeout = timeout ?? getPluginRequestTimeout();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('请求超时'));
    }, actualTimeout);

    fetch(url, options)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function fetchWithMirrors(urls: string[], options: RequestInit = {}, timeout?: number): Promise<Response> {
  let lastError = null;

  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(`${url}?t=${new Date().getTime()}`, options, timeout);
      if (res.ok) {
        return res;
      }
    } catch (error) {
      lastError = error;
      logError(`从 ${url} 获取数据失败`, 'PluginService', error as Error);
    }
  }

  throw lastError || new Error('所有镜像源均无法访问');
}

function getMirrorUrls(originalUrl: string): string[] {
  if (originalUrl.startsWith('https://raw.githubusercontent.com/')) {
    const path = originalUrl.slice('https://raw.githubusercontent.com'.length);
    return getGithubRawMirrors().map(mirror => mirror + path);
  }
  return [originalUrl];
}

const RELEASE_URL_CACHE_KEY = 'plugin_release_url_cache';
const RELEASE_URL_CACHE_TTL = 3600000;

function getCachedReleaseUrl(githubRepo: string): string | undefined {
  try {
    const cacheStr = localStorage.getItem(RELEASE_URL_CACHE_KEY);
    if (!cacheStr) return undefined;
    
    const cache = JSON.parse(cacheStr);
    const entry = cache[githubRepo];
    
    if (entry && Date.now() - entry.timestamp < RELEASE_URL_CACHE_TTL) {
      return entry.url;
    }
  } catch { /* ignore */ }
  
  return undefined;
}

function setCachedReleaseUrl(githubRepo: string, url: string): void {
  try {
    const cacheStr = localStorage.getItem(RELEASE_URL_CACHE_KEY);
    const cache = cacheStr ? JSON.parse(cacheStr) : {};
    
    cache[githubRepo] = {
      url,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(RELEASE_URL_CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

function clearReleaseUrlCache(): void {
  try {
    localStorage.removeItem(RELEASE_URL_CACHE_KEY);
  } catch { /* ignore */ }
}

async function fetchLatestReleaseUrl(githubRepo: string): Promise<string | undefined> {
  if (!githubRepo) return undefined;

  const cachedUrl = getCachedReleaseUrl(githubRepo);
  if (cachedUrl) {
    return cachedUrl;
  }

  await loadPluginStoreConfig();

  const apiPaths = [
    `/repos/${githubRepo}/releases/latest`,
    `/repos/${githubRepo}/releases`,
  ];

  for (const mirror of getGithubApiMirrors()) {
    for (const apiPath of apiPaths) {
      try {
        const url = `${mirror}${apiPath}`;
        const res = await fetchWithTimeout(url, {});
        
        if (!res.ok) continue;
        
        const data = await res.json();
        let release = data;
        
        if (Array.isArray(data)) {
          release = data.find((r: { draft: boolean; prerelease: boolean }) => !r.draft && !r.prerelease) || data[0];
        }
        
        if (!release) continue;
        
        const assets = (release as { assets?: Array<{ name: string; browser_download_url: string }> }).assets || [];
        const zipAsset = assets.find(a => a.name.endsWith('.zip')) || assets[0];
        
        if (zipAsset?.browser_download_url) {
          setCachedReleaseUrl(githubRepo, zipAsset.browser_download_url);
          return zipAsset.browser_download_url;
        }
      } catch {
        continue;
      }
    }
  }
  
  return undefined;
}

export default class PluginService {
  async fetchAvailablePlugins(): Promise<PluginInfo[]> {
    clearReleaseUrlCache();
    await loadPluginStoreConfig();
    try {
      const res = await fetchWithMirrors(getRegistryUrls());
      const data = await res.json();
      const plugins = (Array.isArray(data) ? data : []).map((ext: RegistryPlugin) => ({
        id: ext.id,
        name: ext.name,
        description: ext.description || '',
        iconName: ext.icon || 'Package',
        iconUrl: ext.iconUrl ? getMirrorUrls(ext.iconUrl)[0] : undefined,
        image: ext.image ? getMirrorUrls(ext.image)[0] : undefined,
        color: ext.color || '#3b82f6',
        textColor: ext.textColor || '#ffffff',
        version: ext.version || '1.0.0',
        author: ext.author || 'Unknown',
        categories: ext.categories || [],
        path: `/tools/${ext.id}`,
        tags: ext.tags || [],
        githubRepo: ext.githubRepo,
        releaseUrl: ext.releaseUrl,
        entry: ext.entry,
        isBeta: ext.isBeta === true,
      }));

      const pluginsWithoutReleaseUrl = plugins.filter(p => !p.releaseUrl && p.githubRepo);
      
      if (pluginsWithoutReleaseUrl.length > 0) {
        const releaseUrlPromises = pluginsWithoutReleaseUrl.map(async (plugin) => {
          const releaseUrl = await fetchLatestReleaseUrl(plugin.githubRepo!);
          return { pluginId: plugin.id, releaseUrl };
        });

        const releaseUrlResults = await Promise.all(releaseUrlPromises);
        
        releaseUrlResults.forEach(({ pluginId, releaseUrl }) => {
          const plugin = plugins.find(p => p.id === pluginId);
          if (plugin && releaseUrl) {
            plugin.releaseUrl = releaseUrl;
          }
        });
      }

      return plugins;
    } catch (error) {
      logError('从所有镜像源获取插件列表失败', 'PluginService', error as Error);
    }

    try {
      if (window.electron?.plugin?.getAvailable) {
        const plugins = await window.electron.plugin.getAvailable();
        return plugins || [];
      }
    } catch (error) {
      logError('从本地获取可用插件列表失败', 'PluginService', error as Error);
    }

    return [];
  }

  async getInstalledPlugins(): Promise<InstalledPlugin[]> {
    try {
      if (!window.electron?.plugin?.getInstalled) {
        return [];
      }
      const plugins = await window.electron.plugin.getInstalled();
      if (!plugins || !Array.isArray(plugins)) {
        return [];
      }
      return plugins.map((plugin: RawInstalledPlugin) => ({
        id: plugin.id || '',
        name: plugin.name || plugin.id || '未知插件',
        description: plugin.description || '',
        iconName: plugin.icon || plugin.iconName || 'Package',
        iconUrl: plugin.iconUrl || undefined,
        image: plugin.image || undefined,
        color: plugin.color || '#3b82f6',
        textColor: plugin.textColor || '#ffffff',
        version: plugin.version || '1.0.0',
        installedVersion: plugin.installedVersion || plugin.version || '1.0.0',
        author: plugin.author || 'Unknown',
        categories: plugin.categories || [],
        path: plugin.path || `/tools/${plugin.id}`,
        tags: plugin.tags || [],
        githubRepo: plugin.githubRepo || undefined,
        entry: plugin.entry || 'dist/index.js',
        isBeta: plugin.isBeta === true,
        enabled: plugin.enabled !== false,
        installDate: plugin.installDate || Date.now(),
        isPinned: plugin.isPinned === true,
      }));
    } catch (error) {
      logError('获取已安装插件失败', 'PluginService', error as Error);
      return [];
    }
  }

  async installPlugin(pluginId: string, repo?: string, releaseUrl?: string, onProgress?: (progress: InstallProgress) => void): Promise<PluginServiceResponse> {
    return new Promise((resolve) => {
      const progressHandler = (_event: unknown, data: { pluginId: string; progress: InstallProgress }) => {
        if (data.pluginId === pluginId && onProgress) {
          onProgress(data.progress);
        }
      };

      window.electron?.ipcRenderer?.on('plugin:install-progress', progressHandler);

      window.electron?.plugin?.install(pluginId, repo, releaseUrl)
        .then((result) => {
          if (result?.success) {
            logInfo(`插件安装成功: ${pluginId}`, 'PluginService');
          }
          resolve(result || { success: false, error: '安装失败' });
        })
        .catch((error) => {
          logError(`插件安装失败: ${pluginId}`, 'PluginService', error as Error);
          resolve({ success: false, error: (error as Error).message });
        })
        .finally(() => {
          window.electron?.ipcRenderer?.off('plugin:install-progress', progressHandler);
        });
    });
  }

  async uninstallPlugin(pluginId: string): Promise<PluginServiceResponse> {
    try {
      if (!window.electron?.plugin?.uninstall) {
        return { success: false, error: '插件卸载功能不可用' };
      }
      const result = await window.electron.plugin.uninstall(pluginId);
      if (result.success) {
        logInfo(`插件卸载成功: ${pluginId}`, 'PluginService');
      }
      return result;
    } catch (error) {
      logError(`插件卸载失败: ${pluginId}`, 'PluginService', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  async installFromFile(): Promise<PluginServiceResponse> {
    try {
      if (!window.electron?.plugin?.installFromFile) {
        return { success: false, error: '文件安装功能不可用' };
      }
      const result = await window.electron.plugin.installFromFile();
      return result;
    } catch (error) {
      logError('从文件安装插件失败', 'PluginService', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  async installFromPath(filePath: string): Promise<PluginServiceResponse> {
    try {
      if (!window.electron?.plugin?.installFromPath) {
        return { success: false, error: '路径安装功能不可用' };
      }
      const result = await window.electron.plugin.installFromPath(filePath);
      return result;
    } catch (error) {
      logError(`从路径安装插件失败: ${filePath}`, 'PluginService', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  async installFromGithub(id: string, repo: string): Promise<PluginServiceResponse> {
    try {
      if (!window.electron?.plugin?.installFromGithub) {
        return { success: false, error: 'GitHub安装功能不可用' };
      }
      const result = await window.electron.plugin.installFromGithub(id, repo);
      return result;
    } catch (error) {
      logError(`从GitHub安装插件失败: ${repo}`, 'PluginService', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  searchPlugins(query: string, plugins: PluginInfo[]): PluginInfo[] {
    if (!query) return plugins;
    const lowerQuery = query.toLowerCase();
    return plugins.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery) ||
      p.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      p.categories.some(cat => cat.toLowerCase().includes(lowerQuery))
    );
  }

  compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(p => parseInt(p.replace(/[^0-9]/g, ''), 10));
    const parts2 = v2.split('.').map(p => parseInt(p.replace(/[^0-9]/g, ''), 10));
    const maxLen = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < maxLen; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  hasUpdate(installed: InstalledPlugin, available: PluginInfo): boolean {
    return this.compareVersions(available.version, installed.installedVersion) > 0;
  }
}
