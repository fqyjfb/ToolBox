// 自动拆分自 src/vite-env.d.ts（ambient 全局声明，勿加 import/export）
// OCR 识别结果接口

interface OcrBlock {
  text: string;
  confidence: number;
  box: number[][];
}

interface OcrResult {
  success: boolean;
  text: string;
  blocks: OcrBlock[];
  error?: string;
}
