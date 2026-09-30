export type TreeNodeKind = "root" | "branch" | "summary";

export interface TreeNode {
  id: string;
  parentId: string | null;
  title: string;
  content: string;
  kind: TreeNodeKind;
  /** Prompt that produced this node (user-facing) */
  prompt?: string;
  position: { x: number; y: number };
  createdAt: number;
  updatedAt: number;
}

export type HistoryActionType =
  | "create-root"
  | "dialogue"
  | "refine"
  | "summarize"
  | "regenerate"
  | "delete"
  | "move"
  | "edit";

export interface HistoryEntry {
  id: string;
  type: HistoryActionType;
  label: string;
  nodeId?: string;
  timestamp: number;
}

export interface TreeSnapshot {
  nodes: Record<string, TreeNode>;
  rootId: string | null;
  selectedNodeId: string | null;
}

export type AiAction = "dialogue" | "refine" | "summarize" | "regenerate";

export interface AiContextNode {
  id: string;
  title: string;
  content: string;
  kind: TreeNodeKind;
}

export interface AiRequest {
  action: AiAction;
  prompt: string;
  current: AiContextNode;
  ancestors: AiContextNode[];
  siblings: AiContextNode[];
  children: AiContextNode[];
}

export interface GeneratedNodeDraft {
  title: string;
  content: string;
}

export interface RefineOperation {
  type: "add" | "update" | "remove";
  /** For update/remove */
  nodeId?: string;
  title?: string;
  content?: string;
}

export interface AiDialogueResponse {
  action: "dialogue" | "regenerate";
  nodes: GeneratedNodeDraft[];
  /** Optional regenerated content for the current node */
  current?: GeneratedNodeDraft;
}

export interface AiRefineResponse {
  action: "refine";
  operations: RefineOperation[];
}

export interface AiSummarizeResponse {
  action: "summarize";
  title: string;
  article: string;
}

export type AiResponse =
  | AiDialogueResponse
  | AiRefineResponse
  | AiSummarizeResponse;

export interface TreeSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  nodes: Record<string, TreeNode>;
  rootId: string | null;
  selectedNodeId: string | null;
  historyLog: HistoryEntry[];
  lastArticle: { title: string; article: string; nodeId: string } | null;
}

export type ThemePreference = "light" | "dark" | "system";

export interface AppSettingsDoc {
  apiKey: string;
  baseUrl: string;
  model: string;
  theme: ThemePreference;
}

export interface AppMeta {
  currentSessionId: string | null;
  version: 1;
}
