import type { TreeNode } from "@/types/tree";

const NODE_WIDTH = 280;
const NODE_HEIGHT = 140;
const H_GAP = 48;
const V_GAP = 72;

export function layoutChildren(
  parent: TreeNode,
  childCount: number,
  existingPositions?: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  if (existingPositions && existingPositions.length === childCount) {
    return existingPositions;
  }

  const totalWidth = childCount * NODE_WIDTH + (childCount - 1) * H_GAP;
  const startX = parent.position.x + NODE_WIDTH / 2 - totalWidth / 2;
  const y = parent.position.y + NODE_HEIGHT + V_GAP;

  return Array.from({ length: childCount }, (_, i) => ({
    x: startX + i * (NODE_WIDTH + H_GAP),
    y,
  }));
}

export function getChildren(
  nodes: Record<string, TreeNode>,
  parentId: string
): TreeNode[] {
  return Object.values(nodes)
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getAncestors(
  nodes: Record<string, TreeNode>,
  nodeId: string
): TreeNode[] {
  const chain: TreeNode[] = [];
  let current = nodes[nodeId];
  while (current?.parentId) {
    const parent = nodes[current.parentId];
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

export function getSiblings(
  nodes: Record<string, TreeNode>,
  nodeId: string
): TreeNode[] {
  const node = nodes[nodeId];
  if (!node || node.parentId === null) return [];
  return getChildren(nodes, node.parentId).filter((n) => n.id !== nodeId);
}

export function getDescendantIds(
  nodes: Record<string, TreeNode>,
  nodeId: string
): string[] {
  const result: string[] = [];
  const stack = getChildren(nodes, nodeId).map((n) => n.id);
  while (stack.length) {
    const id = stack.pop()!;
    result.push(id);
    stack.push(...getChildren(nodes, id).map((n) => n.id));
  }
  return result;
}

export function getPathToRoot(
  nodes: Record<string, TreeNode>,
  nodeId: string
): TreeNode[] {
  const node = nodes[nodeId];
  if (!node) return [];
  return [...getAncestors(nodes, nodeId), node];
}

export function toContextNode(node: TreeNode) {
  return {
    id: node.id,
    title: node.title,
    content: node.content,
    kind: node.kind,
  };
}

export { NODE_WIDTH, NODE_HEIGHT };
