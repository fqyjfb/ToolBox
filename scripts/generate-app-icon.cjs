// 由 public/favicon.png 生成 Windows 多尺寸图标 public/favicon.ico。
//
// 为什么需要单独的 .ico：
// 1) electron-builder 的 win.icon 收 png 时会自己转一次，但项目里所有 BrowserWindow 的 icon
//    都在找 favicon.ico，打包后拿不到就退回 Electron 默认图标（任务栏表现为默认图标）。
//    让构建产物与代码查找的是同一个文件，消除这层不一致。
// 2) ico 会被 asarUnpack 解包成真实文件，native 层（Chromium 图片解码器）能直接读到；
//    asar 内的路径读不到，同样会退回默认图标。
//
// 源图说明：favicon.png 是 favicon.svg 的 256x256 导出（两者图案一致）。
// SVG 改版后请先重新导出 favicon.png，再执行本脚本。

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public', 'favicon.png');
const OUT = path.join(ROOT, 'public', 'favicon.ico');

// Windows 图标常用尺寸；256 必须保留（ICO 里用 0 表示 256）
const SIZES = [16, 24, 32, 48, 64, 128, 256];

// 面积平均重采样：先预乘 alpha 再平均，避免透明边缘出现暗边
function resample(src, size) {
  const out = Buffer.alloc(size * size * 4);
  const xRatio = src.width / size;
  const yRatio = src.height / size;

  for (let y = 0; y < size; y += 1) {
    const y0 = Math.floor(y * yRatio);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * yRatio));
    for (let x = 0; x < size; x += 1) {
      const x0 = Math.floor(x * xRatio);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * xRatio));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1 && sy < src.height; sy += 1) {
        for (let sx = x0; sx < x1 && sx < src.width; sx += 1) {
          const i = (sy * src.width + sx) * 4;
          const alpha = src.data[i + 3] / 255;
          r += src.data[i] * alpha;
          g += src.data[i + 1] * alpha;
          b += src.data[i + 2] * alpha;
          a += src.data[i + 3];
          n += 1;
        }
      }

      const o = (y * size + x) * 4;
      if (n === 0 || a === 0) {
        out[o] = 0;
        out[o + 1] = 0;
        out[o + 2] = 0;
        out[o + 3] = 0;
        continue;
      }
      // r/g/b 是预乘后的累加值，反预乘需乘回 255（a 为 alpha 累加值，取值 0..255）
      out[o] = Math.min(255, Math.round((r * 255) / a));
      out[o + 1] = Math.min(255, Math.round((g * 255) / a));
      out[o + 2] = Math.min(255, Math.round((b * 255) / a));
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

function toPngBuffer(rgba, size) {
  const png = new PNG({ width: size, height: size });
  rgba.copy(png.data);
  return PNG.sync.write(png);
}

function buildIco(entries) {
  // entries: [{ size, png }]
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(entries.length, 4);

  const dirSize = entries.length * 16;
  const dir = Buffer.alloc(dirSize);
  let offset = header.length + dirSize;

  entries.forEach((entry, i) => {
    const at = i * 16;
    dir[at] = entry.size === 256 ? 0 : entry.size; // 宽（0 表示 256）
    dir[at + 1] = entry.size === 256 ? 0 : entry.size; // 高
    dir[at + 2] = 0; // colorCount
    dir[at + 3] = 0; // reserved
    dir.writeUInt16LE(1, at + 4); // planes
    dir.writeUInt16LE(32, at + 6); // bitCount
    dir.writeUInt32LE(entry.png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += entry.png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[generate-app-icon] 源图不存在: ${SRC}`);
    process.exit(1);
  }

  const src = PNG.sync.read(fs.readFileSync(SRC));
  if (src.width !== src.height) {
    console.error(`[generate-app-icon] 源图必须为正方形，当前 ${src.width}x${src.height}`);
    process.exit(1);
  }

  const entries = SIZES.map((size) => ({
    size,
    png: toPngBuffer(resample(src, size), size),
  }));

  fs.writeFileSync(OUT, buildIco(entries));
  console.log(
    `[generate-app-icon] 已生成 ${path.relative(ROOT, OUT)} `
    + `(${SIZES.join('/')}，${fs.statSync(OUT).size} 字节)`
  );
}

main();
