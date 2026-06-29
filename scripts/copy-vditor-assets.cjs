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
        copyDir(srcPath, destPath);
      } else {
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