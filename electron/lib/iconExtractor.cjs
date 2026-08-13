const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const iconCacheFolder = path.join(app.getPath('userData'), 'icon-cache');
if (!fs.existsSync(iconCacheFolder)) {
  fs.mkdirSync(iconCacheFolder, { recursive: true });
}

const generateCacheFileName = (filePath) => {
  return crypto.createHash('sha1').update(filePath).digest('hex');
};

const getCacheFilePath = (filePath) => {
  return path.join(iconCacheFolder, `${generateCacheFileName(filePath)}.png`);
};

const isSupportedFileType = (filePath) => {
  const extensions = ['.lnk', '.url', '.appref-ms', '.exe'];
  return extensions.some(ext => filePath.toLowerCase().endsWith(ext));
};

const getShortcutTarget = (shortcutPath) => {
  return new Promise((resolve) => {
    const escapedPath = shortcutPath.replace(/\\/g, '\\\\').replace(/"/g, '`"');
    const psScript = `
        $Shell = New-Object -ComObject WScript.Shell
        try {
          $Shortcut = $Shell.CreateShortcut("${escapedPath}")
          $TargetPath = $Shortcut.TargetPath
          if ($TargetPath -and (Test-Path -Path $TargetPath -PathType Leaf)) {
            Write-Output $TargetPath
          } else {
            Write-Output "${escapedPath}"
          }
        } catch {
          Write-Output "${escapedPath}"
        }
    `;
    execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-Command', psScript], { timeout: 5000 }, (error, stdout) => {
      if (stdout?.trim()) {
        resolve(stdout.trim());
      } else {
        resolve(shortcutPath);
      }
    });
  });
};

const getFileIcon = async (filePath) => {
  if (!filePath) return null;
  const cacheFilePath = getCacheFilePath(filePath);
  
  if (fs.existsSync(cacheFilePath)) {
    try {
      const buffer = fs.readFileSync(cacheFilePath);
      return buffer.toString('base64');
    } catch (e) {}
  }
  
  if (!isSupportedFileType(filePath)) return null;
  
  return new Promise((resolve) => {
    const escapedPath = filePath.replace(/\\/g, '\\\\').replace(/"/g, '`"');
    const psScript = `
function Get-Shortcut-Target {
    param([string]$ShortcutFilePath)
    try {
        $Shell = New-Object -ComObject WScript.Shell
        $Shortcut = $Shell.CreateShortcut("${escapedPath}")
        $TargetPath = $Shortcut.TargetPath
        $IconLocation = $Shortcut.IconLocation
        $lastComma = $IconLocation.LastIndexOf(",")
        if ($lastComma -gt -1) {
            $IconPath = $IconLocation.Substring(0, $lastComma).Trim()
        } else {
            $IconPath = $IconLocation.Trim()
        }
        if ($IconPath -and (Test-Path -Path $IconPath -PathType Leaf)) {
            return $IconPath
        }
        if (Test-Path -Path $TargetPath -PathType Leaf) {
            return $TargetPath
        } else {
            return $ShortcutFilePath
        }
    } catch {
        return $ShortcutFilePath
    }
}
function Get-Associated-Icon {
    param([string]$InFilePath, [string]$OutFilePath)
    $ErrorActionPreference = "SilentlyContinue"
    Add-Type -AssemblyName System.Drawing
    if ($InFilePath.EndsWith(".lnk")) {
        $InFilePath = Get-Shortcut-Target -ShortcutFilePath $InFilePath
    }
    $Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($InFilePath)
    if ($null -ne $Icon) {
        $Icon.ToBitmap().Save($OutFilePath, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Output 'success'
    }
}
Get-Associated-Icon -InFilePath "${escapedPath}" -OutFilePath "${cacheFilePath.replace(/\\/g, '\\\\').replace(/"/g, '`"')}"
    `;
    
    execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-Command', psScript], { timeout: 15000 }, (error, stdout) => {
      if (stdout?.trim() === 'success' && fs.existsSync(cacheFilePath)) {
        try {
          const buffer = fs.readFileSync(cacheFilePath);
          resolve(buffer.toString('base64'));
          return;
        } catch (e) {}
      }
      resolve(null);
    });
  });
};

module.exports = { getFileIcon, isSupportedFileType, getShortcutTarget, getCacheFilePath };