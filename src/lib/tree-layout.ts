import type { TreeNode } from "@/types/tree";
import { getChildren } from "@/lib/tree-utils";

/** 与节点卡片视觉宽度对齐 */
export const LAYOUT_NODE_WIDTH = 260;
/** 估算高度：标签 + 标题 + 摘要 */
export const LAYOUT_NODE_HEIGHT = 118;
export const LAYOUT_H_GAP = 56;
export const LAYOUT_V_GAP = 96;
/** 根节点默认落点（偏上，给底部 Composer 留空） */
export const LAYOUT_ROOT_ORIGIN = { x: 80, y: 40 };

type LayoutNode = {
  id: string;
  children: LayoutNode[];
  /** 子树占位宽度 */
  span: number;
  x: number;
  y: number;
};

function buildLayoutTree(
  nodes: Record<string, TreeNode>,
  id: string
): LayoutNode {
  const kids = getChildren(nodes, id).map((c) => buildLayoutTree(nodes, c.id));
  const kidsSpan =
    kids.length === 0
      ? 0
      : kids.reduce((sum, k) => sum + k.span, 0) +
        (kids.length - 1) * LAYOUT_H_GAP;
  return {
    id,
    children: kids,
    span: Math.max(LAYOUT_NODE_WIDTH, kidsSpan),
    x: 0,
    y: 0,
  };
}

function assignPositions(node: LayoutNode, left: number, depth: number) {
  node.y = depth * (LAYOUT_NODE_HEIGHT + LAYOUT_V_GAP);

  if (node.children.length === 0) {
    node.x = left + (node.span - LAYOUT_NODE_WIDTH) / 2;
    return;
  }

  let cursor = left;
  for (const child of node.children) {
    assignPositions(child, cursor, depth + 1);
    cursor += child.span + LAYOUT_H_GAP;
  }

  const first = node.children[0]!;
  const last = node.children[node.children.length - 1]!;
  const mid =
    (first.x + LAYOUT_NODE_WIDTH / 2 + last.x + LAYOUT_NODE_WIDTH / 2) / 2;
  node.x = mid - LAYOUT_NODE_WIDTH / 2;
}

function collect(
  node: LayoutNode,
  out: Record<string, { x: number; y: number }>
) {
  out[node.id] = { x: node.x, y: node.y };
  for (const child of node.children) collect(child, out);
}

/**
 * 自顶向下 tidy-tree：兄弟水平排布、父子垂直分层、父节点居中于子树。
 * 返回整树相对坐标；调用方可整体平移。
 */
export function computeTreeLayout(
  nodes: Record<string, TreeNode>,
  rootId: string
): Record<string, { x: number; y: number }> {
  const root = nodes[rootId];
  if (!root) return {};

  const tree = buildLayoutTree(nodes, rootId);
  assignPositions(tree, 0, 0);

  const positions: Record<string, { x: number; y: number }> = {};
  collect(tree, positions);

  const origin = LAYOUT_ROOT_ORIGIN;
  const dx = origin.x - (positions[rootId]?.x ?? 0);
  const dy = origin.y - (positions[rootId]?.y ?? 0);

  for (const id of Object.keys(positions)) {
    const p = positions[id]!;
    positions[id] = { x: p.x + dx, y: p.y + dy };
  }

  return positions;
}

/** 仅在父节点下方水平排布子节点（局部；整树请用 computeTreeLayout） */
export function layoutChildren(
  parent: TreeNode,
  childCount: number,
  existingPositions?: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  if (existingPositions && existingPositions.length === childCount) {
    return existingPositions;
  }

  const totalWidth =
    childCount * LAYOUT_NODE_WIDTH + (childCount - 1) * LAYOUT_H_GAP;
  const startX =
    parent.position.x + LAYOUT_NODE_WIDTH / 2 - totalWidth / 2;
  const y = parent.position.y + LAYOUT_NODE_HEIGHT + LAYOUT_V_GAP;

  return Array.from({ length: childCount }, (_, i) => ({
    x: startX + i * (LAYOUT_NODE_WIDTH + LAYOUT_H_GAP),
    y,
  }));
}
