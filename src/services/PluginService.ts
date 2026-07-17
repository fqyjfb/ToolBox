import { logError, logInfo } from './loggerService';
import { PluginInfo, InstalledPlugin, PluginServiceResponse } from '../types/plugin';

const PLUGIN_REGISTRY_URL = 'https://raw.githubusercontent.com/fqyjfb/toolbox-plugins-registry/main/registry.json';
const PLUGIN_REGISTRY_MIRROR_URL = 'https://raw.fastgit.org/fqyjfb/toolbox-plugins-registry/main/registry.json';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = 15000): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('请求超时'));
    }, timeout);

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

export default class PluginService {
  async fetchAvailablePlugins(): Promise<PluginInfo[]> {
    const urls = [PLUGIN_REGISTRY_URL, PLUGIN_REGISTRY_MIRROR_URL];
    
    for (const url of urls) {
      try {
        const res = await fetchWithTimeout(`${url}?t=${new Date().getTime()}`, {}, 15000);
        if (res.ok) {
          const data = await res.json();
          return (Array.isArray(data) ? data : []).map((ext: any) => ({
            id: ext.id,
            name: ext.name,
            description: ext.description || '',
            iconName: ext.icon || 'Package',
            iconUrl: ext.iconUrl,
            image: ext.image,
            color: ext.color || '#3b82f6',
            textColor: ext.textColor || '#ffffff',
            version: ext.version || '1.0.0',
            author: ext.author || 'Unknown',
            categories: ext.categories || [],
            path: `/tools/${ext.id}`,
            tags: ext.tags || [],
            githubRepo: ext.githubRepo,
            entry: ext.entry,
            isBeta: ext.isBeta === true,
          }));
        }
      } catch (error) {
        logError(`从 ${url} 获取插件列表失败`, 'PluginService', error as Error);
      }
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
      return plugins.map((plugin: any) => ({
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

  async installPlugin(pluginId: string, repo?: string): Promise<PluginServiceResponse> {
    try {
      if (!window.electron?.plugin?.install) {
        return { success: false, error: '插件安装功能不可用' };
      }
      const result = await window.electron.plugin.install(pluginId, repo);
      if (result.success) {
        logInfo(`插件安装成功: ${pluginId}`, 'PluginService');
      }
      return result;
    } catch (error) {
      logError(`插件安装失败: ${pluginId}`, 'PluginService', error as Error);
      return { success: false, error: (error as Error).message };
    }
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

  async togglePluginEnabled(pluginId: string, enabled: boolean): Promise<PluginServiceResponse> {
    try {
      if (!window.electron?.plugin?.toggleEnabled) {
        return { success: false, error: '插件启用/禁用功能不可用' };
      }
      const result = await window.electron.plugin.toggleEnabled(pluginId, enabled);
      return result;
    } catch (error) {
      logError(`插件状态切换失败: ${pluginId}`, 'PluginService', error as Error);
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
