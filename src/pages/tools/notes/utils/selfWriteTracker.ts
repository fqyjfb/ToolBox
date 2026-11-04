// selfWriteTracker —— 自我写入抑制：应用自身保存文件后，fs watcher 会回推 change 事件，
// 若此时用户继续输入（dirty 复归 true），会被误判为「外部修改」弹窗。
// 保存成功后记录时间戳，watcher 裁决时落在窗口期内的 change 视为自我写入回声，直接跳过；
// 只有真实的外部冲突才弹窗，任何残留的抑制标记都会把外部修改静默吞掉。

/** 抑制窗口：覆盖主进程 debounce（100ms）+ fs 事件延迟 + 渲染层聚合（300ms） */
const SELF_WRITE_WINDOW_MS = 3000;

const lastWriteAt = new Map<string, number>();

/** 应用自身完成一次文件写入后调用（按绝对路径记录） */
export function markSelfWrite(path: string): void {
  lastWriteAt.set(path, Date.now());
}

/** 该路径当前的 change 事件是否处于自我写入回声窗口内 */
export function isSelfWriteEcho(path: string): boolean {
  const at = lastWriteAt.get(path);
  if (at === undefined) return false;
  if (Date.now() - at < SELF_WRITE_WINDOW_MS) return true;
  lastWriteAt.delete(path);
  return false;
}
