export const APP_VERSION = '1.3.5';

export const getVersion = (): string => {
  return APP_VERSION;
};

export const parseVersion = (version: string): { major: number; minor: number; patch: number } => {
  const parts = version.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
};

export const compareVersions = (v1: string, v2: string): number => {
  const v1Parts = v1.split('.').map(Number);
  const v2Parts = v2.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if (v1Parts[i] !== v2Parts[i]) {
      return (v1Parts[i] || 0) - (v2Parts[i] || 0);
    }
  }
  return 0;
};