import localStorageService, { STORAGE_KEYS } from './localStorageService';

export const openUrl = (url: string): void => {
  const browserMode = localStorageService.getString(STORAGE_KEYS.BROWSER_MODE) as 'internal' | 'external' || 'internal';

  if (window.electron) {
    if (browserMode === 'external') {
      window.electron.openExternal(url);
    } else {
      window.electron.openInternal(url);
    }
  } else {
    window.open(url, '_blank');
  }
};

export const setBrowserMode = (mode: 'internal' | 'external'): void => {
  localStorageService.setString(STORAGE_KEYS.BROWSER_MODE, mode);
};
