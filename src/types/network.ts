// 网络配置类型定义
// 与主进程 config.cjs 中 defaultNetworkConfig 结构一致

export interface AppUpdateConfig {
  checkUrl: string;
  repoUrl: string;
  requestTimeout: number;
}

export interface HotNewsConfig {
  primaryUrl: string;
  fallbackUrl: string;
  requestTimeout: number;
}

export interface PluginStoreConfig {
  registryUrls: string[];
  githubRawMirrors: string[];
  githubApiMirrors: string[];
  requestTimeout: number;
}

export interface IconCacheConfig {
  ttl: number;
  maxItems: number;
  requestTimeout: number;
}

export interface NetworkConfig {
  appUpdate: AppUpdateConfig;
  hotNews: HotNewsConfig;
  pluginStore: PluginStoreConfig;
  iconCache: IconCacheConfig;
}

export interface NetworkTestResult {
  ok: boolean;
  statusCode: number;
  latencyMs: number;
  error: string | null;
}
