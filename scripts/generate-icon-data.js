
const fs = require('fs');
const path = require('path');

// 读取 TypeScript 文件内容
const iconDataTs = fs.readFileSync(path.join(__dirname, '../src/components/icons/iconData.ts'), 'utf-8');

// 提取 iconDataList 数组的内容
const match = iconDataTs.match(/export const iconDataList: IconData\[\] = \[([\s\S]*?)\];/);

if (!match) {
  console.error('无法找到 iconDataList');
  process.exit(1);
}

// 生成 JavaScript 版本 - 同时支持浏览器和 Node.js
const jsContent = `// 自动生成的图标数据 - 请勿手动修改
// 从 src/components/icons/iconData.ts 生成

(function(root) {
  const iconDataList = [${match[1]}];

  const getIconSvgByName = (name) => {
    const icon = iconDataList.find(item => item.name === name);
    return icon?.svg || iconDataList.find(item => item.name === 'Info')?.svg || '';
  };

  // 创建图标对象映射
  const customIcons = {};
  iconDataList.forEach(item => {
    customIcons[item.name] = item.svg;
  });

  // 导出到不同环境
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      iconDataList,
      getIconSvgByName,
      customIcons
    };
  } else {
    // 浏览器环境 - 挂载到 window 对象
    root.IconData = {
      iconDataList,
      getIconSvgByName,
      customIcons
    };
  }
})(typeof window !== 'undefined' ? window : global);
`;

// 写入到 electron 目录
fs.writeFileSync(path.join(__dirname, '../electron/icon-data.js'), jsContent);
console.log('✓ 已生成 electron/icon-data.js');

