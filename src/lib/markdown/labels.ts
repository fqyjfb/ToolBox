/**
 * 命令标签。
 *
 * 把「插入内容时用的占位文本」收敛成这个最小接口（只支持中文），
 * 命令的 `label` 字段泛化为 `string`（展示文本），不经过 i18n 查表。
 */

/** 插入新块时写入的默认文本（会出现在文档里，所以是内容而非 UI 文案）。 */
export interface CommandLabels {
  newParagraph: string;
  newSection: string;
  newTask: string;
  newListItem: string;
  newQuote: string;
  newCode: string;
  newTableCell: string;
  newTableColumn: string;
}

/** 中文占位文本（插入新块时写入的默认文字）。 */
export const DEFAULT_COMMAND_LABELS: CommandLabels = {
  newParagraph: "新段落",
  newSection: "新章节",
  newTask: "新任务",
  newListItem: "列表项",
  newQuote: "引用文本",
  newCode: "代码",
  newTableCell: "单元格",
  newTableColumn: "列",
};
