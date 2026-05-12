export interface OcrBlock {
  text: string;
  confidence: number;
  box: number[][];
}

export interface OcrHistoryItem {
  id: string;
  imageBase64: string;
  text: string;
  timestamp: number;
}