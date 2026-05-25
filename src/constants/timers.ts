export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const CACHE_DURATION = {
  SHORT: 5 * MINUTE,
  MEDIUM: 30 * MINUTE,
  LONG: 1 * HOUR,
  WEEK: 7 * DAY,
};

export const API_TIMEOUT = {
  DEFAULT: 10 * SECOND,
  LONG: 30 * SECOND,
};

export const POLLING_INTERVAL = {
  STATUS: 5 * SECOND,
  SYNC: 30 * SECOND,
};

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  DELAY: 1 * SECOND,
  BACKOFF_MULTIPLIER: 2,
};

export const STORAGE_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  MAX_IMAGES_PER_REQUEST: 10,
};

export const PAGE_SIZE = {
  DEFAULT: 20,
  SEARCH: 10,
  MAX: 100,
};