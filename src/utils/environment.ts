export const isElectron = (): boolean => {
  if (typeof window !== 'undefined' && typeof window.electron !== 'undefined') {
    return true;
  }
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')) {
    return true;
  }
  return false;
};

export const isWeb = (): boolean => {
  return !isElectron();
};