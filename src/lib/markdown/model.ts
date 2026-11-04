/**
 * 最小数据模型类型。
 *
 * 笔记是磁盘上的普通 Markdown 文件，资产是相对路径引用；
 * 这里只保留事务层与 store 层仍在使用的类型占位，不含存档编解码逻辑。
 */

/** 资产引用。ToolBox 不使用资产存档，store 侧恒为空数组。 */
export interface MarkdownAsset {
  id: string;
  mimeType?: string;
  data?: string;
}

/** 校验发现项。`format/assets.ts` 的校验已切断，仅保留类型以维持事务结果结构。 */
export interface ValidationFinding {
  code: string;
  message?: string;
  severity: "error" | "warning";
}
