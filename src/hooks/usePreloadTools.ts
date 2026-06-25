import { useEffect } from 'react';

const PRELOAD_MODULES = [
  () => import('../pages/tools/todo'),
  () => import('../pages/tools/notes'),
  () => import('../pages/tools/quick-reply'),
  () => import('../pages/tools/cloud-clipboard'),
];

const PRELOAD_ICONS = [
  () => import('lucide-react').then(m => ({
    Phone: m.Phone,
    RefreshCw: m.RefreshCw,
    MessageSquare: m.MessageSquare,
    Clipboard: m.Clipboard,
    CheckSquare: m.CheckSquare,
    Key: m.Key,
    FileCode: m.FileCode,
    Globe: m.Globe,
    Smile: m.Smile,
    Clock: m.Clock,
    ArrowUpDown: m.ArrowUpDown,
    Hash: m.Hash,
    Copy: m.Copy,
    Table: m.Table,
    Link: m.Link,
    Map: m.Map,
    QrCode: m.QrCode,
    Code: m.Code,
    AtSign: m.AtSign,
    Tag: m.Tag,
    AlignLeft: m.AlignLeft,
    Code2: m.Code2,
    Binary: m.Binary,
    Braces: m.Braces,
    Navigation: m.Navigation,
    Newspaper: m.Newspaper,
    Languages: m.Languages,
    FileText: m.FileText,
  })),
];

export const usePreloadTools = () => {
  useEffect(() => {
    const preload = () => {
      PRELOAD_MODULES.forEach((moduleLoader) => {
        moduleLoader().catch(() => {});
      });
      
      PRELOAD_ICONS.forEach((iconLoader) => {
        iconLoader().catch(() => {});
      });
    };

    if ('requestIdleCallback' in window) {
      const idleCallbackId = window.requestIdleCallback(preload, { timeout: 5000 });
      return () => window.cancelIdleCallback(idleCallbackId);
    } else {
      const timeoutId = setTimeout(preload, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, []);
};

export default usePreloadTools;
