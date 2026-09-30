import type {
  AppSettingsDoc,
  HistoryEntry,
  ThemePreference,
  TreeNode,
  TreeSession,
} from "@/types/tree";

export const LEGACY_TREE_KEY = "arbor-tree-v1";
export const LEGACY_SETTINGS_KEY = "arbor-llm-settings-v1";
export const MAX_SESSIONS = 50;

export function sessionTitleFromNodes(
  nodes: Record<string, TreeNode>,
  rootId: string | null
): string {
  if (rootId && nodes[rootId]?.title.trim()) {
    return nodes[rootId].title.trim();
  }
  return "未命名议题";
}

/** Keep current + newest sessions up to `limit`; drop oldest non-current. */
export function pruneSessions(
  sessions: Record<string, TreeSession>,
  currentId: string | null,
  limit: number = MAX_SESSIONS
): Record<string, TreeSession> {
  const entries = Object.values(sessions);
  if (entries.length <= limit) return { ...sessions };

  const sorted = [...entries].sort((a, b) => a.updatedAt - b.updatedAt);
  const keep = new Set<string>();
  if (currentId && sessions[currentId]) keep.add(currentId);

  for (let i = sorted.length - 1; i >= 0 && keep.size < limit; i--) {
    keep.add(sorted[i].id);
  }

  const next: Record<string, TreeSession> = {};
  for (const id of keep) {
    const s = sessions[id];
    if (s) next[id] = s;
  }
  return next;
}

export function buildSessionSnapshot(input: {
  id: string;
  createdAt: number;
  nodes: Record<string, TreeNode>;
  rootId: string | null;
  selectedNodeId: string | null;
  historyLog: HistoryEntry[];
  lastArticle: TreeSession["lastArticle"];
  updatedAt?: number;
}): TreeSession {
  const updatedAt = input.updatedAt ?? Date.now();
  return {
    id: input.id,
    title: sessionTitleFromNodes(input.nodes, input.rootId),
    createdAt: input.createdAt,
    updatedAt,
    nodes: input.nodes,
    rootId: input.rootId,
    selectedNodeId: input.selectedNodeId,
    historyLog: input.historyLog,
    lastArticle: input.lastArticle,
  };
}

type LegacyTreePersisted = {
  state?: {
    nodes?: Record<string, TreeNode>;
    rootId?: string | null;
    selectedNodeId?: string | null;
    historyLog?: HistoryEntry[];
    lastArticle?: TreeSession["lastArticle"];
  };
};

export function parseLegacyTree(raw: string): TreeSession | null {
  try {
    const parsed = JSON.parse(raw) as LegacyTreePersisted;
    const state = parsed.state;
    if (!state || typeof state !== "object") return null;
    const nodes = state.nodes ?? {};
    const rootId = state.rootId ?? null;
    if (!rootId && Object.keys(nodes).length === 0) return null;
    const now = Date.now();
    return buildSessionSnapshot({
      id: `migrated-${now}`,
      createdAt: now,
      nodes,
      rootId,
      selectedNodeId: state.selectedNodeId ?? null,
      historyLog: state.historyLog ?? [],
      lastArticle: state.lastArticle ?? null,
      updatedAt: now,
    });
  } catch {
    return null;
  }
}

export function parseLegacySettings(
  raw: string
): Partial<AppSettingsDoc> | null {
  try {
    const parsed = JSON.parse(raw) as {
      state?: Partial<AppSettingsDoc>;
    };
    const state = parsed.state;
    if (!state || typeof state !== "object") return null;
    const out: Partial<AppSettingsDoc> = {};
    if (typeof state.apiKey === "string") out.apiKey = state.apiKey;
    if (typeof state.baseUrl === "string") out.baseUrl = state.baseUrl;
    if (typeof state.model === "string") out.model = state.model;
    if (
      state.theme === "light" ||
      state.theme === "dark" ||
      state.theme === "system"
    ) {
      out.theme = state.theme;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function readLegacyLocalStorage(): {
  session?: TreeSession;
  settings?: Partial<AppSettingsDoc>;
  theme?: ThemePreference;
} {
  if (typeof window === "undefined") return {};
  const out: {
    session?: TreeSession;
    settings?: Partial<AppSettingsDoc>;
    theme?: ThemePreference;
  } = {};

  const treeRaw = window.localStorage.getItem(LEGACY_TREE_KEY);
  if (treeRaw) {
    const session = parseLegacyTree(treeRaw);
    if (session) out.session = session;
  }

  const settingsRaw = window.localStorage.getItem(LEGACY_SETTINGS_KEY);
  if (settingsRaw) {
    const settings = parseLegacySettings(settingsRaw);
    if (settings) out.settings = settings;
  }

  const themeRaw =
    window.localStorage.getItem("theme") ||
    window.localStorage.getItem("lucora-theme");
  if (
    themeRaw === "light" ||
    themeRaw === "dark" ||
    themeRaw === "system"
  ) {
    out.theme = themeRaw;
  }

  return out;
}

export function clearLegacyLocalStorage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEGACY_TREE_KEY);
  window.localStorage.removeItem(LEGACY_SETTINGS_KEY);
  window.localStorage.removeItem("theme");
  window.localStorage.removeItem("lucora-theme");
}
