// 文件树查找工具（收藏分组使用）：只持有绝对路径，须在 fileTree 里找回节点
// 才能拿到最新文件名，并判断文件是否仍存在（不存在则置灰、点击不跳转）。

import type { FileTreeNode } from '../types';

// 取路径最后一段作为文件名（Windows / POSIX 分隔符都兼容）
export function basenameOfPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

// 在 fileTree 中递归查找 path 对应的节点
export function findInTree(tree: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of tree) {
    if (node.path === path) return node;
    if (node.children && node.children.length > 0) {
      const hit = findInTree(node.children, path);
      if (hit) return hit;
    }
  }
  return null;
}
