const { loadSettings } = require('../lib/config.cjs');

const LOCK_DEEP_SLEEP_DELAY_MS = 5 * 60 * 1000;
const LOCK_SLEEP_CHECK_TIMEOUT_MS = 3000;

let lockCycleId = 0;
let sleepTimer = null;
let sleepSnapshot = null;
let deepSleeping = false;

const clearSleepTimer = () => {
  if (!sleepTimer) return;
  clearTimeout(sleepTimer);
  sleepTimer = null;
};

const isWindowAlive = (win) => Boolean(win && !win.isDestroyed());
const isLockCycleActive = (cycleId) => (
  cycleId === lockCycleId && loadSettings().isLockEnabled === 1
);

const getProtectedStateReason = () => {
  if (require('../window/quickLoginWindow.cjs').getQuickLoginWindow()) return '快速登录窗口仍存在';
  if (require('../window/floatPanelWindow.cjs').getPanelWindow()) return '悬浮面板仍存在';
  if (require('./notesWatcherService.cjs').isWatching()) return '笔记文件监听正在运行';
  if (require('../ipc/aiIpc.cjs').hasActiveChatRequests()) return 'AI 请求尚未结束';
  return '';
};

const checkWallWithTimeout = async (wallWindow) => {
  if (!isWindowAlive(wallWindow)) return true;
  let timeout = null;
  try {
    return await Promise.race([
      require('../window/stickyNoteWallWindow.cjs').canSleepWall(),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(false), LOCK_SLEEP_CHECK_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const captureSleepSnapshot = async (candidates) => {
  const mainWindowModule = require('../window/mainWindow.cjs');
  if (mainWindowModule.getMainWindow() !== candidates.mainWindow) return null;
  if (getProtectedStateReason()) return null;

  const mainSnapshot = mainWindowModule.getLockSleepSnapshot();
  if (!mainSnapshot || !(await checkWallWithTimeout(candidates.wallWindow))) return null;

  return {
    mainHash: mainSnapshot.hash,
    restoreFloat: Boolean(candidates.floatWindow),
    restoreWall: Boolean(candidates.wallWindow),
  };
};

const destroyAuxiliaryWindows = (snapshot, candidates) => {
  if (snapshot.restoreFloat) {
    require('../window/floatWindow.cjs').destroyForLockSleep(candidates.floatWindow);
  }
  if (snapshot.restoreWall && isWindowAlive(candidates.wallWindow)) {
    require('../window/stickyNoteWallWindow.cjs').destroyWall();
  }
};

const performDeepSleep = async (cycleId, candidates) => {
  const snapshot = await captureSleepSnapshot(candidates);
  if (!snapshot || !isLockCycleActive(cycleId)) return;

  const mainWindowModule = require('../window/mainWindow.cjs');
  const latestMainSnapshot = mainWindowModule.getLockSleepSnapshot();
  if (!latestMainSnapshot || getProtectedStateReason()) return;
  snapshot.mainHash = latestMainSnapshot.hash;

  try {
    if (!mainWindowModule.destroyForLockSleep(candidates.mainWindow)) return;
    deepSleeping = true;
    sleepSnapshot = snapshot;
    destroyAuxiliaryWindows(snapshot, candidates);
  } catch (error) {
    deepSleeping = !mainWindowModule.getMainWindow();
    sleepSnapshot = deepSleeping ? snapshot : null;
    console.error('[LockSleep] 深度休眠失败，已保留可恢复状态:', error.message);
  }
};

const startLockCycle = (candidates) => {
  clearSleepTimer();
  const cycleId = ++lockCycleId;
  deepSleeping = false;
  sleepSnapshot = null;
  if (!isWindowAlive(candidates.mainWindow)) return;

  sleepTimer = setTimeout(() => {
    sleepTimer = null;
    void performDeepSleep(cycleId, candidates);
  }, LOCK_DEEP_SLEEP_DELAY_MS);
  if (typeof sleepTimer.unref === 'function') sleepTimer.unref();
};

const beginUnlock = () => {
  clearSleepTimer();
  const restoreState = {
    cycleId: ++lockCycleId,
    deepSleep: deepSleeping && Boolean(sleepSnapshot),
    snapshot: sleepSnapshot,
  };
  deepSleeping = false;
  sleepSnapshot = null;
  return restoreState;
};

const retainDeepSleep = (snapshot) => {
  deepSleeping = Boolean(snapshot);
  sleepSnapshot = snapshot || null;
};

const dispose = () => {
  clearSleepTimer();
  lockCycleId++;
  deepSleeping = false;
  sleepSnapshot = null;
};

module.exports = {
  startLockCycle,
  beginUnlock,
  retainDeepSleep,
  isRestoreCycleActive: (cycleId) => cycleId === lockCycleId,
  dispose,
};
