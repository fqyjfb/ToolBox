const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../node_modules/vditor/dist');
const targetDir = path.join(__dirname, '../public/vditor/dist');

const copyDir = (src, dest) => {
  try {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const files = fs.readdirSync(src);
    files.forEach((file) => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      if (fs.statSync(srcPath).isDirectory()) {
        // 跳过 TypeScript 类型声明目录
        if (file === 'ts') return;
        copyDir(srcPath, destPath);
      } else {
        // 跳过 .d.ts 类型声明文件
        if (file.endsWith('.d.ts')) return;
        // 字体仅保留 .woff2（有 .woff2 同名时跳过 .ttf/.woff）
        if (/\.(ttf|woff)$/i.test(file)) {
          const woff2Name = file.replace(/\.(ttf|woff)$/i, '.woff2');
          if (fs.existsSync(path.join(src, woff2Name))) return;
        }
        fs.copyFileSync(srcPath, destPath);
      }
    });
  } catch (error) {
    console.warn('Vditor assets copy partially failed:', error.message);
  }
};

if (fs.existsSync(sourceDir)) {
  copyDir(sourceDir, targetDir);
  console.log('Vditor assets copied to public/vditor');
} else {
  console.warn('Vditor source directory not found, skipping copy');
}