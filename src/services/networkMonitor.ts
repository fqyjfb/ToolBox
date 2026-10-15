import { useSyncStore } from '../store/syncStore';
import { logInfo } from './loggerService';

const HEALTH_CHECK_TIMEOUT = 5000; // 探测超时 5s

async function checkSupabaseHealth(): Promise<boolean> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}

function updateOnlineStatus(isOnline: boolean): void {
  useSyncStore.getState().setIsOnline(isOnline);
  if (isOnline) {
    logInfo('网络已恢复', 'networkMonitor');
  } else {
    logInfo('网络已断开', 'networkMonitor');
  }
}

// 真实离线由 navigator.onLine 事件权威判定（见 syncStore）。
// 连通性探测只用于「确认真在线」：探测成功才置为在线；
// 探测失败（端点不可达/超时/CORS 等）时不下探为离线，避免误判导致横幅常驻。
async function probe(): Promise<void> {
  if (!navigator.onLine) {
    updateOnlineStatus(false);
    return;
  }

  const healthy = await checkSupabaseHealth();
  if (healthy) {
    updateOnlineStatus(true);
  }
}

function handleOnline(): void {
  updateOnlineStatus(true);
}

function handleOffline(): void {
  updateOnlineStatus(false);
}

export function startNetworkMonitor(): void {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  // 启动后 1s 探测一次，确认真在线状态（失败不影响在线判定）
  setTimeout(probe, 1000);
}

export function stopNetworkMonitor(): void {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
}
