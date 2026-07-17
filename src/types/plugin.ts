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
  entry?: string;
  isBeta?: boolean;
}

export interface InstalledPlugin extends PluginInfo {
  enabled: boolean;
  installedVersion: string;
  installDate: number;
  isPinned: boolean;
}

export interface PluginStoreState {
  availablePlugins: PluginInfo[];
  installedPlugins: InstalledPlugin[];
  isLoading: boolean;
  searchQuery: string;
  selectedCategories: string[];
  installingPluginId: string | null;
  installProgress: number;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon: string;
  image?: string;
  color: string;
  textColor?: string;
  categories: string[];
  tags?: string[];
  githubRepo?: string;
  entry?: string;
  isBeta?: boolean;
}

export interface PluginServiceResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  canceled?: boolean;
}