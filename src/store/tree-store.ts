"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import { nanoid } from "nanoid";
import type {
  HistoryEntry,
  HistoryActionType,
  TreeNode,
  TreeNodeKind,
  TreeSession,
  GeneratedNodeDraft,
  RefineOperation,
} from "@/types/tree";
import {
  getChildren,
  getDescendantIds,
  layoutChildren,
} from "@/lib/tree-utils";
import {
  computeTreeLayout,
  LAYOUT_ROOT_ORIGIN,
} from "@/lib/tree-layout";
import { buildSessionSnapshot } from "@/lib/persist-runtime";

function withTreeLayout(
  nodes: Record<string, TreeNode>,
  rootId: string | null
): Record<string, TreeNode> {
  if (!rootId || !nodes[rootId]) return nodes;
  const positions = computeTreeLayout(nodes, rootId);
  const next = { ...nodes };
  const now = Date.now();
  for (const [id, pos] of Object.entries(positions)) {
    const node = next[id];
    if (!node) continue;
    next[id] = { ...node, position: pos, updatedAt: now };
  }
  return next;
}

type CanvasSlice = {
  nodes: Record<string, TreeNode>;
  rootId: string | null;
  selectedNodeId: string | null;
  historyLog: HistoryEntry[];
  lastArticle: TreeSession["lastArticle"];
  currentSessionId: string | null;
  sessions: Record<string, TreeSession>;
};

/** Merge canvas patch and mirror into sessions[currentSessionId]. */
function withSessionMirror<T extends Partial<CanvasSlice>>(
  s: CanvasSlice,
  patch: T
): T & {
  sessions: Record<string, TreeSession>;
  currentSessionId: string | null;
} {
  const currentSessionId =
    patch.currentSessionId !== undefined
      ? patch.currentSessionId
      : s.currentSessionId;
  const nodes = patch.nodes ?? s.nodes;
  const rootId = patch.rootId !== undefined ? patch.rootId : s.rootId;
  const selectedNodeId =
    patch.selectedNodeId !== undefined
      ? patch.selectedNodeId
      : s.selectedNodeId;
  const historyLog = patch.historyLog ?? s.historyLog;
  const lastArticle =
    patch.lastArticle !== undefined ? patch.lastArticle : s.lastArticle;
  const sessions = { ...(patch.sessions ?? s.sessions) };

  if (currentSessionId) {
    const prev = sessions[currentSessionId];
    sessions[currentSessionId] = buildSessionSnapshot({
      id: currentSessionId,
      createdAt: prev?.createdAt ?? Date.now(),
      nodes,
      rootId,
      selectedNodeId,
      historyLog,
      lastArticle,
    });
  }

  return {
    ...patch,
    sessions,
    currentSessionId,
  };
}

interface TreeState {
  nodes: Record<string, TreeNode>;
  rootId: string | null;
  selectedNodeId: string | null;
  historyLog: HistoryEntry[];
  busyNodeId: string | null;
  lastArticle: { title: string; article: string; nodeId: string } | null;
  layoutTick: number;
  sessions: Record<string, TreeSession>;
  currentSessionId: string | null;
  hydrated: boolean;

  setHydrated: (v: boolean) => void;
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
  organizeLayout: () => void;
  deleteNode: (id: string) => void;
  setArticle: (article: {
    title: string;
    article: string;
    nodeId: string;
  }) => void;
  clearArticle: () => void;
  resetAll: () => void;
  pushHistory: (entry: Omit<HistoryEntry, "id" | "timestamp">) => void;
  hydrateFromIdb: (payload: {
    sessions: Record<string, TreeSession>;
    currentSessionId: string | null;
  }) => void;
  syncCurrentIntoSessions: () => void;
  beginNewSession: () => string;
  switchSession: (id: string) => void;
  deleteSessionById: (id: string) => void;
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

function ensureSessionId(s: TreeState): string {
  if (s.currentSessionId) return s.currentSessionId;
  return nanoid(10);
}

export const useTreeStore = create<TreeState>()(
  temporal(
    (set, get) => ({
      nodes: {},
      rootId: null,
      selectedNodeId: null,
      historyLog: [],
      busyNodeId: null,
      lastArticle: null,
      layoutTick: 0,
      sessions: {},
      currentSessionId: null,
      hydrated: false,

      setHydrated: (v) => set({ hydrated: v }),

      selectNode: (id) =>
        set((s) => withSessionMirror(s, { selectedNodeId: id })),

      setBusy: (id) => set({ busyNodeId: id }),

      pushHistory: (entry) =>
        set((s) =>
          withSessionMirror(s, { historyLog: pushLog(s, entry) })
        ),

      hydrateFromIdb: ({ sessions, currentSessionId }) => {
        const current =
          currentSessionId && sessions[currentSessionId]
            ? sessions[currentSessionId]
            : null;
        set({
          sessions,
          currentSessionId: current ? currentSessionId : null,
          nodes: current?.nodes ?? {},
          rootId: current?.rootId ?? null,
          selectedNodeId: current?.selectedNodeId ?? null,
          historyLog: current?.historyLog ?? [],
          lastArticle: current?.lastArticle ?? null,
          busyNodeId: null,
          layoutTick: 0,
        });
      },

      syncCurrentIntoSessions: () =>
        set((s) => {
          if (!s.currentSessionId) return s;
          return withSessionMirror(s, {});
        }),

      beginNewSession: () => {
        const id = nanoid(10);
        const now = Date.now();
        set((s) => {
          const sessions = { ...s.sessions };
          if (s.currentSessionId && s.rootId) {
            sessions[s.currentSessionId] = buildSessionSnapshot({
              id: s.currentSessionId,
              createdAt:
                sessions[s.currentSessionId]?.createdAt ?? now,
              nodes: s.nodes,
              rootId: s.rootId,
              selectedNodeId: s.selectedNodeId,
              historyLog: s.historyLog,
              lastArticle: s.lastArticle,
            });
          }
          const empty = buildSessionSnapshot({
            id,
            createdAt: now,
            nodes: {},
            rootId: null,
            selectedNodeId: null,
            historyLog: [],
            lastArticle: null,
          });
          sessions[id] = empty;
          return {
            sessions,
            currentSessionId: id,
            nodes: {},
            rootId: null,
            selectedNodeId: null,
            historyLog: [],
            busyNodeId: null,
            lastArticle: null,
            layoutTick: 0,
          };
        });
        return id;
      },

      switchSession: (id) => {
        set((s) => {
          const target = s.sessions[id];
          if (!target || id === s.currentSessionId) return s;
          const sessions = { ...s.sessions };
          if (s.currentSessionId) {
            sessions[s.currentSessionId] = buildSessionSnapshot({
              id: s.currentSessionId,
              createdAt:
                sessions[s.currentSessionId]?.createdAt ?? Date.now(),
              nodes: s.nodes,
              rootId: s.rootId,
              selectedNodeId: s.selectedNodeId,
              historyLog: s.historyLog,
              lastArticle: s.lastArticle,
            });
          }
          return {
            sessions,
            currentSessionId: id,
            nodes: target.nodes,
            rootId: target.rootId,
            selectedNodeId: target.selectedNodeId,
            historyLog: target.historyLog,
            lastArticle: target.lastArticle,
            busyNodeId: null,
            layoutTick: s.layoutTick + 1,
          };
        });
      },

      deleteSessionById: (id) => {
        set((s) => {
          if (!s.sessions[id]) return s;
          const sessions = { ...s.sessions };
          delete sessions[id];
          if (s.currentSessionId !== id) {
            return { sessions };
          }
          return {
            sessions,
            currentSessionId: null,
            nodes: {},
            rootId: null,
            selectedNodeId: null,
            historyLog: [],
            busyNodeId: null,
            lastArticle: null,
            layoutTick: s.layoutTick + 1,
          };
        });
      },

      createRoot: (title, content) => {
        const node = makeNode({
          parentId: null,
          title,
          content,
          kind: "root",
          position: { ...LAYOUT_ROOT_ORIGIN },
        });
        set((s) => {
          const sessionId = ensureSessionId(s);
          const historyLog = pushLog(
            { historyLog: [] },
            {
              type: "create-root",
              label: `创建根节点「${title}」`,
              nodeId: node.id,
            }
          );
          return withSessionMirror(s, {
            currentSessionId: sessionId,
            nodes: { [node.id]: node },
            rootId: node.id,
            selectedNodeId: node.id,
            historyLog,
            lastArticle: null,
            layoutTick: s.layoutTick + 1,
          });
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
          const laidOut = withTreeLayout(nodes, s.rootId);
          return withSessionMirror(s, {
            nodes: laidOut,
            selectedNodeId: created[0]?.id ?? s.selectedNodeId,
            layoutTick: s.layoutTick + 1,
            historyLog: pushLog(s, {
              type: historyType,
              label:
                historyLabel ??
                `对话生成 ${created.length} 个下级节点`,
              nodeId: parentId,
            }),
          });
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
          return withSessionMirror(s, {
            nodes: withTreeLayout(nodes, s.rootId),
            selectedNodeId: created[0]?.id ?? parentId,
            layoutTick: s.layoutTick + 1,
            historyLog: pushLog(s, {
              type: "regenerate",
              label: `重新生成下级（${created.length}）`,
              nodeId: parentId,
            }),
          });
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
            } else if (
              op.type === "update" &&
              op.nodeId &&
              nodes[op.nodeId]
            ) {
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

          return withSessionMirror(s, {
            nodes: withTreeLayout(nodes, s.rootId),
            layoutTick: s.layoutTick + 1,
            historyLog: pushLog(s, {
              type: "refine",
              label: `修正：+${added} ~${updated} -${removed}（${prompt.slice(0, 24)}）`,
              nodeId: parentId,
            }),
          });
        });
      },

      updateNode: (id, patch, options) => {
        set((s) => {
          const node = s.nodes[id];
          if (!node) return s;
          const nodes = {
            ...s.nodes,
            [id]: { ...node, ...patch, updatedAt: Date.now() },
          };
          if (options?.silent) {
            return withSessionMirror(s, { nodes });
          }
          return withSessionMirror(s, {
            nodes,
            historyLog: pushLog(s, {
              type: "edit",
              label: `编辑节点「${patch.title ?? node.title}」`,
              nodeId: id,
            }),
          });
        });
      },

      moveNode: (id, position) => {
        set((s) => {
          const node = s.nodes[id];
          if (!node) return s;
          const dx = position.x - node.position.x;
          const dy = position.y - node.position.y;
          if (dx === 0 && dy === 0) return s;

          const ids = [id, ...getDescendantIds(s.nodes, id)];
          const nodes = { ...s.nodes };
          const now = Date.now();
          for (const nid of ids) {
            const n = nodes[nid];
            if (!n) continue;
            nodes[nid] = {
              ...n,
              position: {
                x: n.position.x + dx,
                y: n.position.y + dy,
              },
              updatedAt: now,
            };
          }
          return withSessionMirror(s, { nodes });
        });
      },

      organizeLayout: () => {
        set((s) => {
          if (!s.rootId) return s;
          return withSessionMirror(s, {
            nodes: withTreeLayout(s.nodes, s.rootId),
            layoutTick: s.layoutTick + 1,
            historyLog: pushLog(s, {
              type: "edit",
              label: "整理画布布局",
              nodeId: s.rootId,
            }),
          });
        });
      },

      deleteNode: (id) => {
        const state = get();
        const node = state.nodes[id];
        if (!node) return;

        const removeIds = new Set([
          id,
          ...getDescendantIds(state.nodes, id),
        ]);
        const parentId = node.parentId;

        set((s) => {
          const nodes = { ...s.nodes };
          for (const rid of removeIds) delete nodes[rid];

          const isRoot = s.rootId === id;
          const nextRoot = isRoot ? null : s.rootId;
          const nextNodes = isRoot
            ? nodes
            : withTreeLayout(nodes, nextRoot);

          return withSessionMirror(s, {
            nodes: nextNodes,
            rootId: nextRoot,
            selectedNodeId: isRoot
              ? null
              : parentId && nextNodes[parentId]
                ? parentId
                : null,
            layoutTick: s.layoutTick + 1,
            historyLog: pushLog(s, {
              type: "delete",
              label: `删除「${node.title}」及子孙`,
              nodeId: id,
            }),
          });
        });
      },

      setArticle: (article) =>
        set((s) =>
          withSessionMirror(s, {
            lastArticle: article,
            historyLog: pushLog(s, {
              type: "summarize",
              label: `总结：${article.title}`,
              nodeId: article.nodeId,
            }),
          })
        ),

      clearArticle: () =>
        set((s) => withSessionMirror(s, { lastArticle: null })),

      resetAll: () =>
        set((s) => {
          const sessions = { ...s.sessions };
          if (s.currentSessionId && s.rootId) {
            sessions[s.currentSessionId] = buildSessionSnapshot({
              id: s.currentSessionId,
              createdAt:
                sessions[s.currentSessionId]?.createdAt ?? Date.now(),
              nodes: s.nodes,
              rootId: s.rootId,
              selectedNodeId: s.selectedNodeId,
              historyLog: s.historyLog,
              lastArticle: s.lastArticle,
            });
          }
          return {
            sessions,
            currentSessionId: null,
            nodes: {},
            rootId: null,
            selectedNodeId: null,
            historyLog: [],
            busyNodeId: null,
            lastArticle: null,
            layoutTick: 0,
          };
        }),
    }),
    {
      partialize: (state) => {
        const {
          nodes,
          rootId,
          selectedNodeId,
          historyLog,
          lastArticle,
          sessions,
          currentSessionId,
        } = state;
        return {
          nodes,
          rootId,
          selectedNodeId,
          historyLog,
          lastArticle,
          sessions,
          currentSessionId,
        };
      },
      limit: 50,
    }
  )
);
