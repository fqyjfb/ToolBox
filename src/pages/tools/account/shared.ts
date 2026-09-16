// 账号管理面板模态框统一的表单控件样式
// 统一高度为 35px、文字大小为 text-sm、内外边距一致

// 输入框/下拉框/日期等单行控件（固定 35px 高度）
export const modalControlClass =
  'w-full h-[35px] px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

// 多行文本框（不限制高度，仅统一字体与内外边距）
export const modalTextareaClass =
  'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

// 模态框表单容器的行间距（减少行间距，统一为 8px）
export const modalFormSpacingClass = 'space-y-2';

// 模态框表单两列网格间距
export const modalGridGapClass = 'gap-2';
