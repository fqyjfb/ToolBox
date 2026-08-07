const path = require('path');

const FILE_TYPE_MAP = {
  '.md': 'md',
  '.txt': 'txt',
  '.html': 'html',
  '.htm': 'html',
  '.json': 'json',
  '.docx': 'docx',
  '.doc': 'docx',
  '.xlsx': 'xlsx',
  '.pdf': 'pdf',
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image',
  '.gif': 'image', '.bmp': 'image', '.svg': 'image',
  '.webp': 'image', '.ico': 'image',
};

const TEXT_FILE_EXTS = new Set(['.md', '.txt', '.html', '.htm', '.json']);
const IMAGE_FILE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico']);

function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return FILE_TYPE_MAP[ext] || null;
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_FILE_EXTS.has(ext);
}

function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_FILE_EXTS.has(ext);
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.md': 'text/markdown', '.txt': 'text/plain',
    '.html': 'text/html', '.htm': 'text/html',
    '.json': 'application/json',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml',
    '.webp': 'image/webp', '.ico': 'image/x-icon',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

module.exports = { getFileType, isTextFile, isImageFile, getMimeType };