const { ipcMain, shell, app } = require('electron');
const fs = require('fs');
const path = require('path');

let FAVORITES_FILE;
let TARGET_PATHS_FILE;

function initConfigPaths() {
  FAVORITES_FILE = path.join(app.getPath('userData'), 'fileManagerFavorites.json');
  TARGET_PATHS_FILE = path.join(app.getPath('userData'), 'fileManagerTargetPaths.json');
}

function ensureConfigFiles() {
  if (!fs.existsSync(FAVORITES_FILE)) {
    fs.writeFileSync(FAVORITES_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(TARGET_PATHS_FILE)) {
    fs.writeFileSync(TARGET_PATHS_FILE, JSON.stringify([], null, 2));
  }
}

function getSystemPaths() {
  const systemPaths = [];
  
  try {
    const desktopPath = app.getPath('desktop');
    systemPaths.push({
      name: '桌面',
      path: desktopPath,
      icon: 'desktop',
      isSystem: true
    });
  } catch (error) {
    console.error('获取桌面路径失败:', error);
  }
  
  try {
    const drives = getDrives();
    drives.forEach(drive => {
      systemPaths.push({
        name: drive,
        path: drive,
        icon: 'drive',
        isSystem: true
      });
    });
  } catch (error) {
    console.error('获取驱动器失败:', error);
  }
  
  return systemPaths;
}

function getDrives() {
  const drives = [];
  if (process.platform === 'win32') {
    for (let i = 65; i <= 90; i++) {
      const drive = String.fromCharCode(i) + ':\\';
      try {
        if (fs.existsSync(drive)) {
          drives.push(drive);
        }
      } catch (error) {
        continue;
      }
    }
  }
  return drives;
}

function listFiles(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    
    const items = [];
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    
    files.forEach(file => {
      try {
        const fullPath = path.join(dirPath, file.name);
        const stats = fs.statSync(fullPath);
        
        items.push({
          name: file.name,
          path: fullPath,
          isDirectory: file.isDirectory(),
          size: file.isDirectory() ? undefined : stats.size,
          modifiedTime: stats.mtime
        });
      } catch (error) {
        console.error(`读取文件 ${file.name} 失败:`, error);
      }
    });
    
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return items;
  } catch (error) {
    console.error('列出文件失败:', error);
    return [];
  }
}

function getParentPath(currentPath) {
  const parent = path.dirname(currentPath);
  return parent !== currentPath ? parent : null;
}

function getFavorites() {
  try {
    ensureConfigFiles();
    const data = fs.readFileSync(FAVORITES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('获取收藏失败:', error);
    return [];
  }
}

function addFavorite(favPath, name) {
  try {
    ensureConfigFiles();
    const favorites = getFavorites();
    
    const exists = favorites.some(f => f.path === favPath);
    if (!exists) {
      favorites.push({
        name: name || path.basename(favPath),
        path: favPath,
        icon: 'folder',
        isSystem: false
      });
      fs.writeFileSync(FAVORITES_FILE, JSON.stringify(favorites, null, 2));
    }
    return true;
  } catch (error) {
    console.error('添加收藏失败:', error);
    return false;
  }
}

function removeFavorite(favPath) {
  try {
    ensureConfigFiles();
    const favorites = getFavorites();
    const filtered = favorites.filter(f => f.path !== favPath);
    fs.writeFileSync(FAVORITES_FILE, JSON.stringify(filtered, null, 2));
    return true;
  } catch (error) {
    console.error('移除收藏失败:', error);
    return false;
  }
}

function getTargetPaths() {
  try {
    ensureConfigFiles();
    const data = fs.readFileSync(TARGET_PATHS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('获取目标路径失败:', error);
    return [];
  }
}

function addTargetPath(targetPath, name) {
  try {
    ensureConfigFiles();
    const targets = getTargetPaths();
    
    const exists = targets.some(t => t.path === targetPath);
    if (!exists) {
      targets.push({
        id: Date.now().toString(),
        name: name || path.basename(targetPath),
        path: targetPath,
        createdAt: new Date().toISOString()
      });
      fs.writeFileSync(TARGET_PATHS_FILE, JSON.stringify(targets, null, 2));
    }
    return true;
  } catch (error) {
    console.error('添加目标路径失败:', error);
    return false;
  }
}

function removeTargetPath(targetId) {
  try {
    ensureConfigFiles();
    const targets = getTargetPaths();
    const filtered = targets.filter(t => t.id !== targetId);
    fs.writeFileSync(TARGET_PATHS_FILE, JSON.stringify(filtered, null, 2));
    return true;
  } catch (error) {
    console.error('移除目标路径失败:', error);
    return false;
  }
}

function copyFiles(sourcePaths, destPath) {
  let successCount = 0;
  
  try {
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }
    
    sourcePaths.forEach(sourcePath => {
      try {
        const fileName = path.basename(sourcePath);
        const destFilePath = path.join(destPath, fileName);
        
        if (fs.existsSync(destFilePath)) {
          const ext = path.extname(fileName);
          const baseName = path.basename(fileName, ext);
          let counter = 1;
          let newDestPath = destFilePath;
          
          while (fs.existsSync(newDestPath)) {
            newDestPath = path.join(destPath, `${baseName}_${counter}${ext}`);
            counter++;
          }
          fs.copyFileSync(sourcePath, newDestPath);
        } else {
          fs.copyFileSync(sourcePath, destFilePath);
        }
        successCount++;
      } catch (error) {
        console.error(`复制文件 ${sourcePath} 失败:`, error);
      }
    });
  } catch (error) {
    console.error('复制文件失败:', error);
  }
  
  return successCount;
}

function deleteItem(itemPath) {
  try {
    const stats = fs.statSync(itemPath);
    if (stats.isDirectory()) {
      fs.rmSync(itemPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(itemPath);
    }
    return true;
  } catch (error) {
    console.error('删除失败:', error);
    return false;
  }
}

function registerFileManagerIpc() {
  initConfigPaths();
  ensureConfigFiles();
  
  ipcMain.handle('fileManager:getSystemPaths', () => {
    return getSystemPaths();
  });
  
  ipcMain.handle('fileManager:getPath', async (event, pathType) => {
    try {
      return app.getPath(pathType);
    } catch (error) {
      console.error(`获取路径 ${pathType} 失败:`, error);
      return null;
    }
  });
  
  ipcMain.handle('fileManager:listFiles', async (event, dirPath) => {
    return listFiles(dirPath);
  });
  
  ipcMain.handle('fileManager:getParentPath', async (event, currentPath) => {
    return getParentPath(currentPath);
  });
  
  ipcMain.handle('fileManager:openFile', async (event, filePath) => {
    try {
      shell.openPath(filePath);
      return true;
    } catch (error) {
      console.error('打开文件失败:', error);
      return false;
    }
  });
  
  ipcMain.handle('fileManager:getFavorites', async () => {
    return getFavorites();
  });
  
  ipcMain.handle('fileManager:addFavorite', async (event, favPath, name) => {
    return addFavorite(favPath, name);
  });
  
  ipcMain.handle('fileManager:removeFavorite', async (event, favPath) => {
    return removeFavorite(favPath);
  });
  
  ipcMain.handle('fileManager:getTargetPaths', async () => {
    return getTargetPaths();
  });
  
  ipcMain.handle('fileManager:addTargetPath', async (event, targetPath, name) => {
    return addTargetPath(targetPath, name);
  });
  
  ipcMain.handle('fileManager:removeTargetPath', async (event, targetId) => {
    return removeTargetPath(targetId);
  });
  
  ipcMain.handle('fileManager:copyFiles', async (event, sourcePaths, destPath) => {
    return copyFiles(sourcePaths, destPath);
  });
  
  ipcMain.handle('fileManager:deleteItem', async (event, itemPath) => {
    return deleteItem(itemPath);
  });
}

module.exports = {
  registerFileManagerIpc
};
