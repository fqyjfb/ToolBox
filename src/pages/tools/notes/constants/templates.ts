// templates —— 内置笔记模板（纯常量，无依赖）：占位符 {{date}} 由 useNotesTemplates.render() 替换，未知占位符原样保留。

import type { NotesTemplate } from '../types';

export type { NotesTemplate };

// 代码块围栏：避免在模板字符串里转义反引号
const FENCE = '```';

const BLANK: NotesTemplate = {
  id: 'blank',
  name: '空白',
  description: '创建一个空的 Markdown 笔记',
  content: '',
};

const DAILY: NotesTemplate = {
  id: 'daily',
  name: '日记',
  description: '每日记录：三件事 + 记录 + 反思',
  content: `# {{date}} {{weekday}}

## 今日三件事
- [ ]
- [ ]
- [ ]

## 记录

## 反思

> 今天最有价值的一件事：
`,
};

const MEETING: NotesTemplate = {
  id: 'meeting',
  name: '会议纪要',
  description: '会议纪要：参会人、议题结论表、待办',
  content: `# 会议纪要 · {{date}}

- 时间：{{datetime}}
- 地点：
- 主持：
- 参会：

## 议题与结论

| 议题 | 结论 | 负责人 | 截止时间 |
| --- | --- | --- | --- |
|  |  |  |  |

## 待办事项
- [ ]
- [ ]

## 待确认问题
- `,
};

const WEEKLY: NotesTemplate = {
  id: 'weekly',
  name: '周报',
  description: '周报：本周进展 / 下周计划 / 风险阻塞',
  content: `# 周报 · {{date}}

## 本周进展
1.
2.

## 下周计划
1.
2.

## 风险与阻塞
-

## 数据概览

| 指标 | 本周 | 上周 | 变化 |
| --- | --- | --- | --- |
|  |  |  |  |`,
};

const READING: NotesTemplate = {
  id: 'reading',
  name: '读书笔记',
  description: '读书笔记：核心观点、金句摘抄、我的思考',
  content: `# 读书笔记 · {{title}}

- 作者：
- 开始日期：{{date}}
- 评分：★★★☆☆

## 核心观点
1.
2.

## 金句摘抄
>

## 我的思考

## 行动清单
- [ ]`,
};

const SNIPPET: NotesTemplate = {
  id: 'snippet',
  name: '代码片段',
  description: '代码片段：说明 + 可直接复用的代码块',
  content: `# 代码片段 · {{title}}

## 说明

## 代码

${FENCE}ts
// {{date}} 记录：数组去重
export function unique<T>(list: readonly T[]): T[] {
  return Array.from(new Set(list));
}
${FENCE}

## 用法

${FENCE}bash
npx ts-node ./unique.ts
${FENCE}

## 备注
-`,
};

const TODO: NotesTemplate = {
  id: 'todo',
  name: '待办清单',
  description: '待办清单：今日 / 稍后 / 已完成',
  content: `# 待办清单 · {{date}}

## 今日
- [ ]
- [ ]

## 稍后
- [ ]
- [ ]

## 已完成
- [x]`,
};

// 内置模板全集（顺序即下拉展示顺序）；用户自定义模板同名时在 all() 中覆盖内置项。
export const NOTE_TEMPLATES: NotesTemplate[] = [
  BLANK,
  DAILY,
  MEETING,
  WEEKLY,
  READING,
  SNIPPET,
  TODO,
];

export const TEMPLATE_WEEKDAYS: readonly string[] = [
  '星期日',
  '星期一',
  '星期二',
  '星期三',
  '星期四',
  '星期五',
  '星期六',
];
