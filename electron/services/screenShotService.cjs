/**
 * 截图服务 - 基于 node-screenshots 原生模块
 * 替代 desktopCapturer，解决纯桌面状态无法截图的问题
 *
 * 采用异步 captureImage() + toPng()，避免同步阻塞主进程事件循环。
 * PNG Buffer 直接以 base64 拼成 data URL，避免 nativeImage 解码后再编码的二次开销。
 */
const { dialog, screen, shell } = require('electron');
const { performance } = require('perf_hooks');

// 加载 node-screenshots 原生模块（N-API，兼容 Node 与 Electron）
let Screenshots = null;
try {
  Screenshots = require('node-screenshots');
} catch (error) {
  if (process.platform === 'win32') {
    const id = dialog.showMessageBoxSync({
      type: 'warning',
      title: '截图库加载失败',
      message: '截屏需要 VS 运行库才能正常使用\n是否需要从微软官网下载？',
      buttons: ['取消', '下载'],
      defaultId: 1,
    });
    if (id === 1) {
      shell.openExternal('https://aka.ms/vs/17/release/vc_redist.' + process.arch + '.exe');
    }
  } else {
    const msg = error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : String(error);
    dialog.showMessageBoxSync({
      type: 'error',
      title: '截屏库加载错误',
      message: '截屏库加载时遇到错误：\n' + msg,
      buttons: ['确定'],
    });
  }
}

/** 计算两个矩形中心点的距离 */
function getCenterDistance(a, b) {
  return Math.sqrt(
    (a.x + a.width / 2 - b.x - b.width / 2) ** 2
    + (a.y + a.height / 2 - b.y - b.height / 2) ** 2
  );
}

const roundMs = (value) => Math.round(value * 100) / 100;

/** 校验 fromPoint 结果与 Electron display 是否对应同一块屏幕（容忍 2px 舍入误差） */
function isMonitorSizeMatched(monitor, display) {
  const expectedWidth = Math.round(display.bounds.width * display.scaleFactor);
  const expectedHeight = Math.round(display.bounds.height * display.scaleFactor);
  return Math.abs(monitor.width() - expectedWidth) <= 2
    && Math.abs(monitor.height() - expectedHeight) <= 2;
}

/**
 * 匹配 Electron display 对应的 node-screenshots Monitor：
 * 1. id 精确匹配；
 * 2. Monitor.fromPoint（display 是 DIP，先经 dipToScreenPoint 转物理像素，并校验尺寸）；
 * 3. 回退到中心距最近，保证优化失败时仍能截到屏。
 */
function resolveMonitor(display, screens) {
  const matchedById = screens.find(s => s.id() === display.id);
  if (matchedById) return matchedById;

  try {
    const center = screen.dipToScreenPoint({
      x: Math.round(display.bounds.x + display.bounds.width / 2),
      y: Math.round(display.bounds.y + display.bounds.height / 2),
    });
    const fromPoint = Screenshots.Monitor.fromPoint(center.x, center.y);
    // 混合 DPI 下 fromPoint 可能命中相邻屏，只有尺寸一致才采纳
    if (fromPoint && isMonitorSizeMatched(fromPoint, display)) return fromPoint;
  } catch { /* 坐标转换/fromPoint 不可用时走中心距回退 */ }

  let nearest = null;
  let minDist = Infinity;
  for (const s of screens) {
    const dist = getCenterDistance(display.bounds, { x: s.x(), y: s.y(), width: s.width(), height: s.height() });
    if (dist < minDist) {
      minDist = dist;
      nearest = s;
    }
  }
  return nearest;
}

/**
 * 使用 node-screenshots 精确截图（单屏）- 异步版本
 * 同步调用会阻塞主进程事件循环，导致遮罩窗口延迟显示、输入路由异常。
 * @returns {Promise<{success:true, pngBuffer:Buffer, timings:object} | {success:false, error:string, code?:string}>}
 */
async function captureWithNodeScreenshots(display) {
  if (!Screenshots) {
    return { success: false, error: 'node-screenshots 未加载', code: 'SHOT_NO_DISPLAY' };
  }
  const screens = Screenshots.Monitor.all();
  if (screens.length === 0) {
    return { success: false, error: '未检测到显示器', code: 'SHOT_NO_DISPLAY' };
  }

  const matchStart = performance.now();
  const monitor = resolveMonitor(display, screens);
  const matchMs = roundMs(performance.now() - matchStart);

  if (!monitor) return { success: false, error: '无法匹配显示器', code: 'SHOT_NO_DISPLAY' };

  // 异步捕获：不阻塞主进程事件循环
  const captureStart = performance.now();
  const image = await new Promise((resolve, reject) => {
    monitor.captureImage()
      .then(resolve)
      .catch(err => {
        const error = new Error('captureImage 失败: ' + (err && err.message || String(err)));
        error.code = 'SHOT_CAPTURE_FAIL';
        reject(error);
      });
  });
  const captureMs = roundMs(performance.now() - captureStart);

  // 异步转 PNG Buffer（异步版本）
  const encodeStart = performance.now();
  const pngBuffer = await new Promise((resolve, reject) => {
    image.toPng()
      .then(resolve)
      .catch(err => {
        const error = new Error('toPng 失败: ' + (err && err.message || String(err)));
        error.code = 'SHOT_ENCODE_FAIL';
        reject(error);
      });
  });
  const encodeMs = roundMs(performance.now() - encodeStart);

  return { success: true, pngBuffer, timings: { matchMs, captureMs, encodeMs } };
}

/** 降级方案：用 desktopCapturer 截图（桌面状态可能失效） */
function captureFallback(displays) {
  const { desktopCapturer } = require('electron');
  const target = displays[0];
  return desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(target.bounds.width * target.scaleFactor),
      height: Math.round(target.bounds.height * target.scaleFactor),
    },
  }).then(sources => {
    const source = sources.find(s => s.display_id === String(target.id)) || sources[0];
    return [{
      displayId: String(target.id),
      bounds: target.bounds,
      scaleFactor: target.scaleFactor,
      dataUrl: source.thumbnail.toDataURL(),
      x: target.bounds.x,
      y: target.bounds.y,
      width: target.bounds.width,
      height: target.bounds.height,
    }];
  });
}

/**
 * 初始化截图服务
 * @returns {Function} 调用后返回 Promise<{success, captures?, error?, code?, timings?}>（timings 仅在 node-screenshots 路径提供）
 *
 * captures 结构（与原来一致，dataUrl 保持向后兼容）：
 *   [{ displayId, bounds, scaleFactor, dataUrl, x, y, width, height }]
 */
function init() {
  return async function dispaly2screen(displays) {
    if (!displays || displays.length === 0) {
      return { success: false, error: '无可用显示器', code: 'SHOT_NO_DISPLAY' };
    }

    // 优先使用 node-screenshots（系统级截图，兼容纯桌面状态）
    if (Screenshots) {
      let result;
      try {
        result = await captureWithNodeScreenshots(displays[0]);
      } catch (error) {
        // 捕获/编码抛错：保持原行为（不回退 desktopCapturer），返回结构化错误码
        return { success: false, error: error.message, code: error.code || 'SHOT_CAPTURE_FAIL' };
      }
      if (result.success) {
        // PNG Buffer 直接转 base64：跳过 nativeImage 解码再编码
        const encodeStart = performance.now();
        const dataUrl = `data:image/png;base64,${result.pngBuffer.toString('base64')}`;
        const base64Ms = roundMs(performance.now() - encodeStart);
        return {
          success: true,
          timings: { ...result.timings, base64Ms },
          captures: [{
            displayId: String(displays[0].id),
            bounds: displays[0].bounds,
            scaleFactor: displays[0].scaleFactor,
            dataUrl,
            x: displays[0].bounds.x,
            y: displays[0].bounds.y,
            width: displays[0].bounds.width,
            height: displays[0].bounds.height,
          }],
        };
      }
    }

    // 降级：desktopCapturer（仅在有活跃应用窗口时可靠）
    try {
      const captureData = await captureFallback(displays);
      return { success: true, captures: captureData };
    } catch (error) {
      return { success: false, error: error.message, code: 'SHOT_CAPTURE_FAIL' };
    }
  };
}

module.exports = { init };
