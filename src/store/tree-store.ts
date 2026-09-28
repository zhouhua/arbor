"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
  HistoryEntry,
  HistoryActionType,
  TreeNode,
  TreeNodeKind,
  GeneratedNodeDraft,
  RefineOperation,
} from "@/types/tree";
import {
  getChildren,
  getDescendantIds,
  layoutChildren,
} from "@/lib/tree-utils";

const STORAGE_KEY = "arbor-tree-v1";

interface TreeState {
  nodes: Record<string, TreeNode>;
  rootId: string | null;
  selectedNodeId: string | null;
  historyLog: HistoryEntry[];
  busyNodeId: string | null;
  lastArticle: { title: string; article: string; nodeId: string } | null;

  selectNode: (id: string | null) => void;
  setBusy: (id: string | null) => void;
  createRoot: (title: string, content: string) => string;
  addChildren: (
    parentId: string,
    drafts: GeneratedNodeDraft[],
    prompt?: string,
    historyType?: HistoryActionType,
    historyLabel?: string
  ) => string[];
  applyRefine: (
    parentId: string,
    operations: RefineOperation[],
    prompt: string
  ) => void;
  updateNode: (
    id: string,
    patch: Partial<Pick<TreeNode, "title" | "content" | "kind" | "prompt">>,
    options?: { silent?: boolean }
  ) => void;
  replaceChildren: (
    parentId: string,
    drafts: GeneratedNodeDraft[],
    prompt?: string
  ) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  deleteNode: (id: string) => void;
  setArticle: (article: {
    title: string;
    article: string;
    nodeId: string;
  }) => void;
  clearArticle: () => void;
  resetAll: () => void;
  pushHistory: (entry: Omit<HistoryEntry, "id" | "timestamp">) => void;
}

function makeNode(
  partial: Omit<TreeNode, "createdAt" | "updatedAt" | "id"> & { id?: string }
): TreeNode {
  const now = Date.now();
  return {
    id: partial.id ?? nanoid(10),
    parentId: partial.parentId,
    title: partial.title,
    content: partial.content,
    kind: partial.kind,
    prompt: partial.prompt,
    position: partial.position,
    createdAt: now,
    updatedAt: now,
  };
}

function pushLog(
  state: { historyLog: HistoryEntry[] },
  entry: Omit<HistoryEntry, "id" | "timestamp">
): HistoryEntry[] {
  const item: HistoryEntry = {
    ...entry,
    id: nanoid(8),
    timestamp: Date.now(),
  };
  return [item, ...state.historyLog].slice(0, 100);
}

export const useTreeStore = create<TreeState>()(
  persist(
    temporal(
      (set, get) => ({
        nodes: {},
        rootId: null,
        selectedNodeId: null,
        historyLog: [],
        busyNodeId: null,
        lastArticle: null,

        selectNode: (id) => set({ selectedNodeId: id }),

        setBusy: (id) => set({ busyNodeId: id }),

        pushHistory: (entry) =>
          set((s) => ({ historyLog: pushLog(s, entry) })),

        createRoot: (title, content) => {
          const node = makeNode({
            parentId: null,
            title,
            content,
            kind: "root",
            position: { x: 120, y: 80 },
          });
          set({
            nodes: { [node.id]: node },
            rootId: node.id,
            selectedNodeId: node.id,
            historyLog: pushLog(get(), {
              type: "create-root",
              label: `创建根节点「${title}」`,
              nodeId: node.id,
            }),
          });
          return node.id;
        },

        addChildren: (
          parentId,
          drafts,
          prompt,
          historyType = "dialogue",
          historyLabel
        ) => {
          const parent = get().nodes[parentId];
          if (!parent || drafts.length === 0) return [];

          const positions = layoutChildren(parent, drafts.length);
          const created: TreeNode[] = drafts.map((d, i) =>
            makeNode({
              parentId,
              title: d.title,
              content: d.content,
              kind: "branch",
              prompt,
              position: positions[i],
            })
          );

          set((s) => {
            const nodes = { ...s.nodes };
            for (const n of created) nodes[n.id] = n;
            return {
              nodes,
              selectedNodeId: created[0]?.id ?? s.selectedNodeId,
              historyLog: pushLog(s, {
                type: historyType,
                label:
                  historyLabel ??
                  `对话生成 ${created.length} 个下级节点`,
                nodeId: parentId,
              }),
            };
          });

          return created.map((n) => n.id);
        },

        replaceChildren: (parentId, drafts, prompt) => {
          const state = get();
          const parent = state.nodes[parentId];
          if (!parent) return;

          const oldChildren = getChildren(state.nodes, parentId);
          const removeIds = new Set<string>();
          for (const child of oldChildren) {
            removeIds.add(child.id);
            for (const d of getDescendantIds(state.nodes, child.id)) {
              removeIds.add(d);
            }
          }

          const positions = layoutChildren(parent, drafts.length);
          const created = drafts.map((d, i) =>
            makeNode({
              parentId,
              title: d.title,
              content: d.content,
              kind: "branch",
              prompt,
              position: positions[i],
            })
          );

          set((s) => {
            const nodes = { ...s.nodes };
            for (const id of removeIds) delete nodes[id];
            for (const n of created) nodes[n.id] = n;
            return {
              nodes,
              selectedNodeId: created[0]?.id ?? parentId,
              historyLog: pushLog(s, {
                type: "regenerate",
                label: `重新生成下级（${created.length}）`,
                nodeId: parentId,
              }),
            };
          });
        },

        applyRefine: (parentId, operations, prompt) => {
          const parent = get().nodes[parentId];
          if (!parent) return;

          set((s) => {
            const nodes = { ...s.nodes };
            let added = 0;
            let updated = 0;
            let removed = 0;

            for (const op of operations) {
              if (op.type === "remove" && op.nodeId && nodes[op.nodeId]) {
                const ids = [
                  op.nodeId,
                  ...getDescendantIds(nodes, op.nodeId),
                ];
                for (const id of ids) delete nodes[id];
                removed += 1;
              } else if (op.type === "update" && op.nodeId && nodes[op.nodeId]) {
                nodes[op.nodeId] = {
                  ...nodes[op.nodeId],
                  title: op.title ?? nodes[op.nodeId].title,
                  content: op.content ?? nodes[op.nodeId].content,
                  updatedAt: Date.now(),
                };
                updated += 1;
              } else if (op.type === "add") {
                const existing = getChildren(nodes, parentId);
                const positions = layoutChildren(
                  parent,
                  existing.length + 1
                );
                const pos = positions[positions.length - 1];
                const node = makeNode({
                  parentId,
                  title: op.title || "新分支",
                  content: op.content || "",
                  kind: "branch" as TreeNodeKind,
                  prompt,
                  position: pos,
                });
                nodes[node.id] = node;
                added += 1;
              }
            }

            return {
              nodes,
              historyLog: pushLog(s, {
                type: "refine",
                label: `修正：+${added} ~${updated} -${removed}（${prompt.slice(0, 24)}）`,
                nodeId: parentId,
              }),
            };
          });
        },

        updateNode: (id, patch, options) => {
          set((s) => {
            const node = s.nodes[id];
            if (!node) return s;
            const next = {
              nodes: {
                ...s.nodes,
                [id]: { ...node, ...patch, updatedAt: Date.now() },
              },
            };
            if (options?.silent) return next;
            return {
              ...next,
              historyLog: pushLog(s, {
                type: "edit",
                label: `编辑节点「${patch.title ?? node.title}」`,
                nodeId: id,
              }),
            };
          });
        },

        moveNode: (id, position) => {
          set((s) => {
            const node = s.nodes[id];
            if (!node) return s;
            return {
              nodes: {
                ...s.nodes,
                [id]: { ...node, position, updatedAt: Date.now() },
              },
            };
          });
        },

        deleteNode: (id) => {
          const state = get();
          const node = state.nodes[id];
          if (!node) return;

          const removeIds = new Set([id, ...getDescendantIds(state.nodes, id)]);
          const parentId = node.parentId;

          set((s) => {
            const nodes = { ...s.nodes };
            for (const rid of removeIds) delete nodes[rid];

            const isRoot = s.rootId === id;
            return {
              nodes,
              rootId: isRoot ? null : s.rootId,
              selectedNodeId: isRoot
                ? null
                : parentId && nodes[parentId]
                  ? parentId
                  : null,
              historyLog: pushLog(s, {
                type: "delete",
                label: `删除「${node.title}」及子孙`,
                nodeId: id,
              }),
            };
          });
        },

        setArticle: (article) =>
          set((s) => ({
            lastArticle: article,
            historyLog: pushLog(s, {
              type: "summarize",
              label: `总结：${article.title}`,
              nodeId: article.nodeId,
            }),
          })),

        clearArticle: () => set({ lastArticle: null }),

        resetAll: () =>
          set({
            nodes: {},
            rootId: null,
            selectedNodeId: null,
            historyLog: [],
            busyNodeId: null,
            lastArticle: null,
          }),
      }),
      {
        partialize: (state) => {
          // Only track structural edits for undo/redo — not selection/busy UI
          const {
            nodes,
            rootId,
            selectedNodeId,
            historyLog,
            lastArticle,
          } = state;
          return {
            nodes,
            rootId,
            selectedNodeId,
            historyLog,
            lastArticle,
          };
        },
        limit: 50,
      }
    ),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        nodes: state.nodes,
        rootId: state.rootId,
        selectedNodeId: state.selectedNodeId,
        historyLog: state.historyLog,
        lastArticle: state.lastArticle,
      }),
    }
  )
);
