import { PluginInfo, InstalledPlugin } from '../types/plugin';

interface PluginEntry {
  plugin: InstalledPlugin;
  instance?: any;
}

class PluginRegistry {
  private plugins: Map<string, PluginEntry> = new Map();

  register(plugin: InstalledPlugin): void {
    if (!plugin.enabled) return;
    this.plugins.set(plugin.id, { plugin });
  }

  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
  }

  get(pluginId: string): PluginEntry | undefined {
    return this.plugins.get(pluginId);
  }

  getAll(): PluginEntry[] {
    return Array.from(this.plugins.values());
  }

  getAllEnabled(): PluginInfo[] {
    return Array.from(this.plugins.values())
      .filter((entry) => entry.plugin.enabled)
      .map((entry) => entry.plugin);
  }

  isRegistered(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  update(plugin: InstalledPlugin): void {
    const existing = this.plugins.get(plugin.id);
    if (existing) {
      this.plugins.set(plugin.id, { ...existing, plugin });
    }
  }

  clear(): void {
    this.plugins.clear();
  }

  loadPlugins(plugins: InstalledPlugin[]): void {
    this.clear();
    plugins.forEach((plugin) => {
      if (plugin.enabled) {
        this.register(plugin);
      }
    });
  }
}

export const pluginRegistry = new PluginRegistry();