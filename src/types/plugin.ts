export interface PluginInfo {
  id: string;
  name: string;
  description: string;
  iconName: string;
  iconUrl?: string;
  image?: string;
  color: string;
  textColor: string;
  version: string;
  author: string;
  categories: string[];
  path: string;
  tags?: string[];
  githubRepo?: string;
  releaseUrl?: string;
  entry?: string;
  isBeta?: boolean;
  width?: number;
  height?: number;
}

export interface InstalledPlugin extends PluginInfo {
  enabled: boolean;
  installedVersion: string;
  installDate: number;
  isPinned: boolean;
}

export interface PluginServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  canceled?: boolean;
}