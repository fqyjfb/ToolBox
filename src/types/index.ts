export interface NewsItem {
  id: string;
  title: string;
  description: string;
  link: string;
  timestamp: number;
}

export interface HistoryItem {
  id: string;
  year: number;
  title: string;
  description: string;
  link: string;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  ico_url?: string;
}

export interface RouteConfig {
  path: string;
  element: React.ReactNode;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
}

export interface ToolItem {
  id: string;
  name: string;
  iconName: string;
  path: string;
  color: string;
  textColor: string;
}

export interface QuickLaunchItem {
  id: string;
  name: string;
  path: string;
  icon?: string;
}

export interface SearchType {
  id: string;
  name: string;
  url: string;
  placeholder: string;
}