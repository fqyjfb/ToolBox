/**
 * 截图服务 - 基于 node-screenshots 原生模块
 * 替代 desktopCapturer，解决纯桌面状态无法截图的问题
 *
 * 采用异步 captureImage() + toPng()，避免同步阻塞主进程事件循环。
 * 主进程返回原始 PNG Buffer，由调用方决定是否转为 data URL。
 */
const { dialog, nativeImage, shell } = require('electron');

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

/**
 * 使用 node-screenshots 精确截图（单屏）- 异步版本
 * 同步调用会阻塞主进程事件循环，导致遮罩窗口延迟显示、输入路由异常。
 * @returns {Promise<{success:true, pngBuffer:Buffer} | {success:false, error:string}>}
 */
async function captureWithNodeScreenshots(display) {
  if (!Screenshots) {
    return { success: false, error: 'node-screenshots 未加载' };
  }
  const screens = Screenshots.Monitor.all();
  if (screens.length === 0) {
    return { success: false, error: '未检测到显示器' };
  }

  let monitor;

  // 优先用 display.id 精确匹配（Windows 下 id 体系不同，通常走中心点匹配）
  const matchedById = screens.find(s => s.id() === display.id);
  if (matchedById) {
    monitor = matchedById;
  } else {
    // 回退：按中心点距离找到最近的显示器
    let minDist = Infinity;
    for (const s of screens) {
      const dist = getCenterDistance(display.bounds, { x: s.x(), y: s.y(), width: s.width(), height: s.height() });
      if (dist < minDist) {
        minDist = dist;
        monitor = s;
      }
    }
  }

  if (!monitor) return { success: false, error: '无法匹配显示器' };

  // 异步捕获：不阻塞主进程事件循环
  const image = await new Promise((resolve, reject) => {
    monitor.captureImage()
      .then(resolve)
      .catch(err => reject(new Error('captureImage 失败: ' + (err && err.message || String(err)))));
  });

  // 异步转 PNG Buffer（异步版本）
  const pngBuffer = await new Promise((resolve, reject) => {
    image.toPng()
      .then(resolve)
      .catch(err => reject(new Error('toPng 失败: ' + (err && err.message || String(err)))));
  });

  return { success: true, pngBuffer };
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
 * @returns {Function} 调用后返回 Promise<{success, captures?, error?}>
 *
 * captures 结构（与原来一致，dataUrl 保持向后兼容）：
 *   [{ displayId, bounds, scaleFactor, dataUrl, x, y, width, height }]
 */
function init() {
  return async function dispaly2screen(displays) {
    if (!displays || displays.length === 0) {
      return { success: false, error: '无可用显示器' };
    }

    // 优先使用 node-screenshots（系统级截图，兼容纯桌面状态）
    if (Screenshots) {
      const result = await captureWithNodeScreenshots(displays[0]);
      if (result.success) {
        // 仅在需要 dataUrl 时转换（本调用方实际需要，保留兼容性）
        const dataUrl = nativeImage.createFromBuffer(result.pngBuffer).toDataURL();
        return {
          success: true,
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
    const captureData = await captureFallback(displays);
    return { success: true, captures: captureData };
  };
}

module.exports = { init };
