export interface RGB { r: number; g: number; b: number; }
export interface HSL { h: number; s: number; l: number; }
export interface HSV { h: number; s: number; v: number; }

export interface ColorScheme {
  id: string;
  name: string;
  description: string;
  colors: string[];
}

export function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(x => Math.round(x).toString(16).padStart(2, '0'))
    .join('');
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  h /= 360; s /= 100; v /= 100;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return {
    r: Math.round((r || 0) * 255),
    g: Math.round((g || 0) * 255),
    b: Math.round((b || 0) * 255)
  };
}

export function isValidHex(hex: string): boolean {
  return /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.test(hex);
}

const toHex = (h: number, s: number, l: number): string => {
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
};

const uniqueColors = (colors: string[]): string[] => {
  return [...new Set(colors)];
};

const getEffectiveHue = (hsl: HSL, fallbackHue: number = 220): number => {
  return hsl.s > 5 ? hsl.h : fallbackHue;
};

const getEffectiveSaturation = (hsl: HSL, defaultSat: number = 70): number => {
  return hsl.s > 5 ? hsl.s : defaultSat;
};

export const colorSchemeGenerators: Record<string, (hsl: HSL) => string[]> = {
  'generic-gradient': (hsl) => {
    const steps = [15, 30, 50, 70, 85];
    return uniqueColors(steps.map(l => toHex(hsl.h, hsl.s, l)));
  },

  'matching-gradient': (hsl) => {
    const baseL = hsl.l;
    const steps = [-35, -18, 0, 18, 35].map(d => Math.max(10, Math.min(90, baseL + d)));
    return uniqueColors(steps.map(l => toHex(hsl.h, hsl.s, l)));
  },

  'spot-palette': (hsl) => {
    const h = getEffectiveHue(hsl, 260);
    const s = getEffectiveSaturation(hsl, 75);
    const complementH = (h + 180) % 360;
    return uniqueColors([
      toHex(h, s, hsl.l),
      toHex((h + 30) % 360, s * 0.9, hsl.l),
      toHex((h + 60) % 360, s * 0.8, hsl.l),
      toHex(complementH, s, hsl.l),
      toHex((complementH + 30) % 360, s * 0.9, hsl.l),
    ]);
  },

  'twisted-spot-palette': (hsl) => {
    const h = getEffectiveHue(hsl, 180);
    const s = getEffectiveSaturation(hsl, 70);
    const complementH = (h + 180) % 360;
    return uniqueColors([
      toHex(h, s, hsl.l),
      toHex((h + 45) % 360, s * 0.8, hsl.l + 10),
      toHex((h + 90) % 360, s * 0.6, hsl.l - 10),
      toHex(complementH, s, hsl.l),
      toHex((complementH + 45) % 360, s * 0.8, hsl.l + 15),
    ]);
  },

  'classy-palette': (hsl) => {
    return uniqueColors([
      toHex(hsl.h, hsl.s * 0.5, 25),
      toHex(hsl.h, hsl.s * 0.7, 45),
      toHex(hsl.h, hsl.s, 60),
      toHex(hsl.h, hsl.s * 0.7, 75),
      toHex(hsl.h, hsl.s * 0.5, 90),
    ]);
  },

  'cube-palette': (hsl) => {
    const h = getEffectiveHue(hsl, 210);
    const s = getEffectiveSaturation(hsl, 70);
    const offsets = [0, 60, 120, 180, 240];
    const lightnessVariation = hsl.s < 5 ? [30, 45, 50, 55, 70] : [hsl.l, hsl.l, hsl.l, hsl.l, hsl.l];
    return uniqueColors(offsets.map((offset, i) => toHex((h + offset) % 360, s, lightnessVariation[i])));
  },

  'switch-palette': (hsl) => {
    const complementH = (hsl.h + 180) % 360;
    return uniqueColors([
      toHex(hsl.h, hsl.s, hsl.l),
      toHex(hsl.h, hsl.s, Math.min(85, hsl.l + 25)),
      toHex(complementH, hsl.s, hsl.l),
      toHex(complementH, hsl.s, Math.min(85, hsl.l + 25)),
      toHex(hsl.h, hsl.s * 0.4, 50),
    ]);
  },

  'small-switch-palette': (hsl) => {
    const complementH = (hsl.h + 180) % 360;
    return uniqueColors([
      toHex(hsl.h, hsl.s, hsl.l),
      toHex(complementH, hsl.s, hsl.l),
      toHex(hsl.h, hsl.s * 0.6, hsl.l),
      toHex(complementH, hsl.s * 0.6, hsl.l),
      '#f0f0f0',
    ]);
  },

  'skip-gradient': (hsl) => {
    const steps = [12, 32, 52, 72, 92];
    return uniqueColors(steps.map(l => toHex(hsl.h, hsl.s, l)));
  },

  'natural-palette': (hsl) => {
    return uniqueColors([
      toHex(hsl.h, hsl.s * 0.6, 28),
      toHex(hsl.h, hsl.s * 0.75, 48),
      toHex(hsl.h, hsl.s, 65),
      toHex((hsl.h + 15) % 360, hsl.s * 0.5, 55),
      toHex((hsl.h - 15 + 360) % 360, hsl.s * 0.5, 55),
    ]);
  },

  'matching-palette': (hsl) => {
    const h = getEffectiveHue(hsl, 200);
    const s = getEffectiveSaturation(hsl, 65);
    const offsets = [0, 30, 60, 180, 210];
    return uniqueColors(offsets.map(offset => toHex((h + offset) % 360, s, hsl.l)));
  },

  'squash-palette': (hsl) => {
    const steps = [28, 42, 56, 70, 84];
    return uniqueColors(steps.map(l => toHex(hsl.h, hsl.s * 0.75, l)));
  },

  'grey-friends': (hsl) => {
    return uniqueColors([
      toHex(hsl.h, hsl.s, hsl.l),
      '#1a1a1a',
      '#333333',
      '#666666',
      '#cccccc',
    ]);
  },

  'dotting-palette': (hsl) => {
    const h = getEffectiveHue(hsl, 240);
    const s = getEffectiveSaturation(hsl, 70);
    const offset1 = (h + 60) % 360;
    const offset2 = (h + 120) % 360;
    return uniqueColors([
      toHex(h, s, hsl.l),
      toHex(offset1, s * 0.65, hsl.l),
      toHex(offset2, s * 0.65, hsl.l),
      toHex((h + 180) % 360, s * 0.4, 50),
      '#fafafa',
    ]);
  },

  'skip-shade-gradient': (hsl) => {
    const steps = [8, 28, 48, 68, 88];
    return uniqueColors(steps.map(l => toHex(hsl.h, hsl.s, l)));
  },

  'threedom': (hsl) => {
    const h = getEffectiveHue(hsl, 240);
    const s = getEffectiveSaturation(hsl, 75);
    if (hsl.s < 5) {
      return uniqueColors([
        toHex(h, s, 60),
        toHex((h + 120) % 360, s, 60),
        toHex((h + 240) % 360, s, 60),
        '#ffffff',
        '#000000',
      ]);
    }
    return uniqueColors([
      toHex(h, s, hsl.l),
      toHex((h + 120) % 360, s, hsl.l),
      toHex((h + 240) % 360, s, hsl.l),
      '#ffffff',
      '#000000',
    ]);
  },

  'highlight-palette': (hsl) => {
    return uniqueColors([
      toHex(hsl.h, hsl.s, hsl.l),
      toHex(hsl.h, hsl.s, Math.min(92, hsl.l + 35)),
      toHex(hsl.h, hsl.s, Math.max(15, hsl.l - 35)),
      toHex((hsl.h + 180) % 360, hsl.s * 0.6, 85),
      '#111111',
    ]);
  },

  'neighbor-palette': (hsl) => {
    const h = getEffectiveHue(hsl, 200);
    const s = getEffectiveSaturation(hsl, 70);
    const offsets = [-30, -15, 0, 15, 30];
    const lightnessVariation = hsl.s < 5 ? [55, 50, hsl.l, 50, 55] : [hsl.l, hsl.l, hsl.l, hsl.l, hsl.l];
    return uniqueColors(offsets.map((offset, i) => toHex((h + offset + 360) % 360, s, lightnessVariation[i])));
  },

  'discreet-palette': (hsl) => {
    return uniqueColors([
      toHex(hsl.h, hsl.s * 0.35, 32),
      toHex(hsl.h, hsl.s * 0.45, 50),
      toHex(hsl.h, hsl.s * 0.55, 68),
      toHex((hsl.h + 180) % 360, hsl.s * 0.25, 45),
      '#f5f5f5',
    ]);
  },

  'dust-palette': (hsl) => {
    return uniqueColors([
      toHex(hsl.h, hsl.s * 0.45, 28),
      toHex(hsl.h, hsl.s * 0.35, 48),
      toHex(hsl.h, hsl.s * 0.25, 68),
      toHex(hsl.h, hsl.s * 0.15, 85),
      '#1a1a1a',
    ]);
  },

  'collective': (hsl) => {
    const h = getEffectiveHue(hsl, 220);
    const s = getEffectiveSaturation(hsl, 70);
    const offsets = [0, 90, 180, 270];
    if (hsl.s < 5) {
      return uniqueColors([
        toHex(h, s, 70),
        toHex((h + 90) % 360, s, 60),
        toHex((h + 180) % 360, s, 50),
        toHex((h + 270) % 360, s, 65),
        '#ffffff',
      ]);
    }
    return uniqueColors([...offsets.map(offset => toHex((h + offset) % 360, s, hsl.l)), '#ffffff']);
  },

  'friend-palette': (hsl) => {
    const h = getEffectiveHue(hsl, 180);
    const s = getEffectiveSaturation(hsl, 70);
    const offsets = [0, 45, 90, 135, 180];
    const lightnessVariation = hsl.s < 5 ? [40, 50, 60, 70, 55] : [hsl.l, hsl.l, hsl.l, hsl.l, hsl.l];
    return uniqueColors(offsets.map((offset, i) => toHex((h + offset) % 360, s, lightnessVariation[i])));
  },

  'pin-palette': (hsl) => {
    const complementH = (hsl.h + 180) % 360;
    return uniqueColors([
      toHex(hsl.h, hsl.s, hsl.l),
      toHex(hsl.h, hsl.s, Math.min(88, hsl.l + 20)),
      toHex(hsl.h, hsl.s, Math.max(12, hsl.l - 20)),
      toHex(complementH, hsl.s, 80),
      toHex(complementH, hsl.s, 30),
    ]);
  },

  'shades': (hsl) => {
    const steps = [12, 32, 52, 72, 92];
    return uniqueColors(steps.map(l => toHex(hsl.h, hsl.s, l)));
  },

  'random-shades': (hsl) => {
    const hue1 = Math.floor(Math.random() * 360);
    const hue2 = (hue1 + 60 + Math.floor(Math.random() * 120)) % 360;
    const hue3 = (hue2 + 60 + Math.floor(Math.random() * 120)) % 360;
    const saturation = hsl.s > 5 ? hsl.s : 60 + Math.floor(Math.random() * 20);
    
    const colors = [
      toHex(hue1, saturation, 30 + Math.floor(Math.random() * 20)),
      toHex(hue1, saturation * 0.8, 50 + Math.floor(Math.random() * 10)),
      toHex(hue2, saturation, 40 + Math.floor(Math.random() * 20)),
      toHex(hue3, saturation * 0.7, 60 + Math.floor(Math.random() * 20)),
      toHex(hue2, saturation * 0.9, 70 + Math.floor(Math.random() * 20)),
    ];
    return uniqueColors(colors);
  },
};

export const colorSchemeInfo: Record<string, { name: string; description: string }> = {
  'generic-gradient': { name: '通用渐变', description: '从深到浅的基础渐变' },
  'matching-gradient': { name: '匹配渐变', description: '以基础色为中心的对称渐变' },
  'spot-palette': { name: '点缀调色板', description: '互补色与邻近色组合' },
  'twisted-spot-palette': { name: '扭曲点缀', description: '带有旋转效果的点缀配色' },
  'classy-palette': { name: '优雅调色板', description: '低饱和度的优雅配色' },
  'cube-palette': { name: '立方体调色板', description: '基于六面体的色彩分布' },
  'switch-palette': { name: '切换调色板', description: '主色与互补色交替' },
  'small-switch-palette': { name: '小切换', description: '简化版切换配色' },
  'skip-gradient': { name: '跳跃渐变', description: '间隔较大的渐变效果' },
  'natural-palette': { name: '自然调色板', description: '自然柔和的配色方案' },
  'matching-palette': { name: '匹配调色板', description: '协调的邻近色组合' },
  'squash-palette': { name: '压缩调色板', description: '压缩的亮度范围' },
  'grey-friends': { name: '灰色伙伴', description: '主色与灰色系搭配' },
  'dotting-palette': { name: '点状调色板', description: '分散的色彩点缀' },
  'skip-shade-gradient': { name: '跳跃阴影', description: '带阴影效果的跳跃渐变' },
  'threedom': { name: '三色自由', description: '均匀分布的三色系' },
  'highlight-palette': { name: '高亮调色板', description: '突出高亮效果' },
  'neighbor-palette': { name: '相邻调色板', description: '紧密相邻的色彩' },
  'discreet-palette': { name: '低调调色板', description: '低饱和度的含蓄配色' },
  'dust-palette': { name: '尘埃调色板', description: '柔和朦胧的配色' },
  'collective': { name: '集合调色板', description: '多种色彩的集合' },
  'friend-palette': { name: '朋友调色板', description: '友好和谐的配色' },
  'pin-palette': { name: '图钉调色板', description: '精准定位的色彩' },
  'shades': { name: '色调渐变', description: '标准的明暗渐变' },
  'random-shades': { name: '随机色调', description: '带随机偏移的渐变' },
};

export function generateAllSchemes(hex: string): ColorScheme[] {
  const rgb = hexToRgb(hex);
  if (!rgb) return [];

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  return Object.entries(colorSchemeGenerators).map(([id, generator]) => ({
    id,
    name: colorSchemeInfo[id]?.name || id,
    description: colorSchemeInfo[id]?.description || '',
    colors: generator(hsl),
  }));
}

export const basicColors = [
  { name: '红色', hex: '#e11d48' },
  { name: '粉色', hex: '#f472b6' },
  { name: '橙色', hex: '#fb923c' },
  { name: '黄色', hex: '#facc15' },
  { name: '绿色', hex: '#84cc16' },
  { name: '青色', hex: '#10b981' },
  { name: '天蓝', hex: '#0ea5e9' },
  { name: '蓝色', hex: '#3b82f6' },
  { name: '紫色', hex: '#8b5cf6' },
  { name: '淡紫', hex: '#a78bfa' },
];

export const popularPalettes = [
  { name: '科技蓝', description: '科技产品、企业网站', colors: ['#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e'] },
  { name: '自然绿', description: '环保、健康类应用', colors: ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'] },
  { name: '温暖橙', description: '餐饮、娱乐类应用', colors: ['#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12'] },
  { name: '优雅紫', description: '时尚、创意类应用', colors: ['#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87'] },
  { name: '清新粉', description: '社交、女性向应用', colors: ['#ec4899', '#db2777', '#be185d', '#9d174d', '#831843'] },
  { name: '专业灰', description: '商务、金融类应用', colors: ['#64748b', '#475569', '#334155', '#1e293b', '#0f172a'] },
];