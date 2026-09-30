# Session History (IndexedDB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist multiple thinking-tree sessions and app settings in IndexedDB via a single Zustand `tree-store` (+ existing `settings-store`), with auto-save and a history panel to switch trees.

**Architecture:** Thin `src/lib/idb.ts` owns all IndexedDB IO (`sessions`, `meta`, `settings`). Zustand stores hold memory state only—no zustand `persist` to localStorage. A small `src/lib/persist-runtime.ts` wires debounce/flush + localStorage→IDB migration. `HistoryPanel` becomes a two-tab dialog (trees + operation log).

**Tech Stack:** Next.js 16, React 19, Zustand 5, zundo, `idb`, vitest + `fake-indexeddb` for unit tests.

**Spec:** @docs/superpowers/specs/2026-09-30-session-history-design.md

---

## File map

| File | Responsibility |
|------|----------------|
| `src/types/tree.ts` | Add `TreeSession`, `AppSettingsDoc`, `AppMeta` |
| `src/lib/idb.ts` | Open DB, CRUD sessions/meta/settings |
| `src/lib/persist-runtime.ts` | Debounced save, flush, migrate LS→IDB, hydrate entry |
| `src/lib/theme-idb-storage.ts` | `next-themes` Storage adapter → IDB settings.theme |
| `src/store/tree-store.ts` | Drop LS persist; add sessions + switch/new/clear helpers |
| `src/store/settings-store.ts` | Drop LS persist; hydrate/save via IDB |
| `src/components/arbor-app.tsx` | Await hydrate before render canvas |
| `src/components/theme-provider.tsx` / `layout.tsx` | Pass IDB storage to next-themes |
| `src/lib/node-actions.ts` | `createRootAndExpand` uses new-session path |
| `src/components/canvas/canvas-toolbar.tsx` | Clear uses archive-then-empty |
| `src/components/panels/history-panel.tsx` | Tabs: 思维树 / 操作记录 |
| `package.json` | Add `idb`, vitest, fake-indexeddb; `test` script |
| `vitest.config.ts` | Vitest config |
| `src/lib/idb.test.ts` | IDB unit tests |
| `src/lib/persist-runtime.test.ts` | Migration + prune helpers |
| `README.md` | Note IndexedDB persistence |

---

### Task 1: Add vitest + idb dependencies

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install deps**

```bash
npm install idb
npm install -D vitest fake-indexeddb @vitest/coverage-v8
```

- [ ] **Step 2: Add vitest config**

Create `vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Create `vitest.setup.ts`:

```ts
import "fake-indexeddb/auto";
```

- [ ] **Step 3: Add test script**

In `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Commit** (only if user asked to commit in this session)

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "$(cat <<'EOF'
chore: add idb and vitest for session persistence

EOF
)"
```

---

### Task 2: Types + IDB IO layer (TDD)

**Files:**
- Modify: `src/types/tree.ts`
- Create: `src/lib/idb.ts`
- Create: `src/lib/idb.test.ts`

- [ ] **Step 1: Extend types in `src/types/tree.ts`**

Append:

```ts
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
```

- [ ] **Step 2: Write failing IDB tests**

Create `src/lib/idb.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllIdb,
  deleteSession,
  getMeta,
  getSettings,
  listSessions,
  putSession,
  putSettings,
  setMeta,
} from "@/lib/idb";
import type { TreeSession } from "@/types/tree";

function sampleSession(id: string, updatedAt: number): TreeSession {
  return {
    id,
    title: `T-${id}`,
    createdAt: updatedAt,
    updatedAt,
    nodes: {},
    rootId: null,
    selectedNodeId: null,
    historyLog: [],
    lastArticle: null,
  };
}

beforeEach(async () => {
  await clearAllIdb();
});

describe("idb sessions", () => {
  it("puts and lists sessions", async () => {
    await putSession(sampleSession("a", 2));
    await putSession(sampleSession("b", 1));
    const list = await listSessions();
    expect(list.map((s) => s.id)).toEqual(["a", "b"]); // updatedAt desc
  });

  it("deletes a session", async () => {
    await putSession(sampleSession("a", 1));
    await deleteSession("a");
    expect(await listSessions()).toEqual([]);
  });
});

describe("idb meta/settings", () => {
  it("round-trips meta and settings", async () => {
    await setMeta({ currentSessionId: "a", version: 1 });
    await putSettings({
      apiKey: "k",
      baseUrl: "https://x",
      model: "m",
      theme: "dark",
    });
    expect(await getMeta()).toEqual({ currentSessionId: "a", version: 1 });
    expect(await getSettings()).toMatchObject({ apiKey: "k", theme: "dark" });
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
npm test -- src/lib/idb.test.ts
```

Expected: fail resolving `@/lib/idb` or missing exports.

- [ ] **Step 4: Implement `src/lib/idb.ts`**

```ts
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AppMeta, AppSettingsDoc, TreeSession } from "@/types/tree";

const DB_NAME = "lucora";
const DB_VERSION = 1;

interface LucoraDB extends DBSchema {
  sessions: {
    key: string;
    value: TreeSession;
    indexes: { "by-updatedAt": number };
  };
  meta: {
    key: string;
    value: AppMeta;
  };
  settings: {
    key: string;
    value: AppSettingsDoc;
  };
}

let dbPromise: Promise<IDBPDatabase<LucoraDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<LucoraDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const sessions = db.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("by-updatedAt", "updatedAt");
        db.createObjectStore("meta");
        db.createObjectStore("settings");
      },
    });
  }
  return dbPromise;
}

/** Test helper: wipe DB between tests */
export async function clearAllIdb() {
  const db = await getDb();
  const tx = db.transaction(["sessions", "meta", "settings"], "readwrite");
  await Promise.all([
    tx.objectStore("sessions").clear(),
    tx.objectStore("meta").clear(),
    tx.objectStore("settings").clear(),
    tx.done,
  ]);
}

export async function putSession(session: TreeSession) {
  await (await getDb()).put("sessions", session);
}

export async function getSession(id: string) {
  return (await getDb()).get("sessions", id);
}

export async function deleteSession(id: string) {
  await (await getDb()).delete("sessions", id);
}

export async function listSessions(): Promise<TreeSession[]> {
  const all = await (await getDb()).getAllFromIndex(
    "sessions",
    "by-updatedAt"
  );
  return all.reverse(); // index is ascending
}

export async function setMeta(meta: AppMeta) {
  await (await getDb()).put("meta", meta, "app");
}

export async function getMeta(): Promise<AppMeta | undefined> {
  return (await getDb()).get("meta", "app");
}

export async function putSettings(doc: AppSettingsDoc) {
  await (await getDb()).put("settings", doc, "app");
}

export async function getSettings(): Promise<AppSettingsDoc | undefined> {
  return (await getDb()).get("settings", "app");
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npm test -- src/lib/idb.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit** (if user requested commits)

```bash
git add src/types/tree.ts src/lib/idb.ts src/lib/idb.test.ts
git commit -m "$(cat <<'EOF'
feat: add IndexedDB layer for sessions and settings

EOF
)"
```

---

### Task 3: Persist runtime — migrate, prune, snapshot helpers (TDD)

**Files:**
- Create: `src/lib/persist-runtime.ts`
- Create: `src/lib/persist-runtime.test.ts`

- [ ] **Step 1: Write failing tests for pure helpers**

Export and test:

- `sessionTitleFromNodes(nodes, rootId)` → root title or `未命名议题`
- `pruneSessions(sessions, currentId, limit=50)` → drop oldest non-current
- `parseLegacyTree(raw: string)` → TreeSession | null
- `parseLegacySettings(raw: string)` → partial settings | null

Example test:

```ts
import { describe, expect, it } from "vitest";
import {
  pruneSessions,
  sessionTitleFromNodes,
} from "@/lib/persist-runtime";
import type { TreeSession } from "@/types/tree";

function s(id: string, updatedAt: number): TreeSession {
  return {
    id,
    title: id,
    createdAt: 0,
    updatedAt,
    nodes: {},
    rootId: null,
    selectedNodeId: null,
    historyLog: [],
    lastArticle: null,
  };
}

describe("pruneSessions", () => {
  it("keeps current and newest up to limit", () => {
    const map: Record<string, TreeSession> = {};
    for (let i = 0; i < 55; i++) map[`s${i}`] = s(`s${i}`, i);
    const next = pruneSessions(map, "s0", 50);
    expect(Object.keys(next)).toHaveLength(50);
    expect(next.s0).toBeTruthy();
    expect(next.s1).toBeUndefined(); // oldest non-current among overflow
  });
});

describe("sessionTitleFromNodes", () => {
  it("uses root title", () => {
    expect(
      sessionTitleFromNodes(
        { r: { id: "r", parentId: null, title: "议题A", content: "", kind: "root", position: { x: 0, y: 0 }, createdAt: 0, updatedAt: 0 } },
        "r"
      )
    ).toBe("议题A");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- src/lib/persist-runtime.test.ts
```

- [ ] **Step 3: Implement helpers in `src/lib/persist-runtime.ts`**

Also implement (used by app, lightly tested):

- `LEGACY_TREE_KEY = "arbor-tree-v1"`
- `LEGACY_SETTINGS_KEY = "arbor-llm-settings-v1"`
- `migrateLegacyLocalStorage(): Promise<{ session?: TreeSession; settings?: Partial<AppSettingsDoc> }>` — read LS, parse, return data; caller writes IDB then removes keys
- `MAX_SESSIONS = 50`
- `buildSnapshotFromStore(...)` helper mapping canvas fields → `TreeSession`

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- src/lib/persist-runtime.test.ts
```

- [ ] **Step 5: Commit** (if requested)

---

### Task 4: Refactor `tree-store` for multi-session (no LS persist)

**Files:**
- Modify: `src/store/tree-store.ts`
- Modify: `src/lib/node-actions.ts`
- Modify: `src/components/canvas/canvas-toolbar.tsx`

- [ ] **Step 1: Remove `persist` middleware from `tree-store`**

Keep `temporal` only. Outer shape:

```ts
export const useTreeStore = create<TreeState>()(
  temporal(
    (set, get) => ({ /* ... */ }),
    { partialize: ..., limit: 50 }
  )
);
```

Add state fields:

```ts
sessions: Record<string, TreeSession>;
currentSessionId: string | null;
hydrated: boolean;
setHydrated: (v: boolean) => void;
```

Add actions:

```ts
/** Replace in-memory sessions map (hydrate) */
hydrateFromIdb: (payload: {
  sessions: Record<string, TreeSession>;
  currentSessionId: string | null;
}) => void;

/** Sync canvas fields into sessions[currentSessionId] */
syncCurrentIntoSessions: () => void;

/** Start a brand-new empty canvas; keep previous session in map if it had a root */
beginNewSession: () => string; // returns new id, or use null-until-createRoot

/** Load target session as current (caller flushes first) */
switchSession: (id: string) => void;

/** Remove session; if current, clear canvas */
deleteSessionById: (id: string) => void;
```

Semantics (match spec):

- `createRoot`: if `currentSessionId` is null, allocate id + entry first; set title from root
- `resetAll` (clear canvas): `syncCurrentIntoSessions` first (no-op if empty); set `currentSessionId = null` and empty canvas fields; **do not** delete the previous session from `sessions`
- `beginNewSession` / used by create-root replace: sync current (keeps old in map), allocate new id, clear canvas into that id, then `createRoot`
- After every structural `set`, update `sessions[currentSessionId]` mirror (`title`, `updatedAt`, snapshot fields) so UI list stays fresh before IDB flush

- [ ] **Step 2: Update `createRootAndExpand` in `src/lib/node-actions.ts`**

Replace `if (store.rootId) store.resetAll()` with:

```ts
if (store.rootId) {
  store.syncCurrentIntoSessions();
  store.beginNewSession(); // sets new currentSessionId + empty canvas
} else if (!store.currentSessionId) {
  store.beginNewSession();
}
```

Then `createRoot` as today.

- [ ] **Step 3: Update toolbar clear**

```ts
onClick={() => {
  resetAll(); // archives-by-keeping session, clears canvas
  temporal.clear();
  toast.success("画布已清空");
  focusComposer();
}}
```

Ensure `resetAll` does **not** wipe `sessions`.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors related to new APIs (fix any call sites).

- [ ] **Step 5: Commit** (if requested)

---

### Task 5: Wire hydrate + auto-save + settings IDB

**Files:**
- Modify: `src/lib/persist-runtime.ts` (add `startPersistRuntime`, `hydrateApp`)
- Modify: `src/store/settings-store.ts`
- Create: `src/lib/theme-idb-storage.ts`
- Modify: `src/components/theme-provider.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/arbor-app.tsx`

- [ ] **Step 1: Strip LS persist from `settings-store`**

Keep in-memory Zustand. Add:

```ts
hydrateFromDoc: (doc: Partial<AppSettingsDoc>) => void;
```

`patch` / `clearSecrets` unchanged for memory; persistence via runtime subscription.

- [ ] **Step 2: Implement `hydrateApp` + `startPersistRuntime`**

`hydrateApp`:

1. `migrateLegacyLocalStorage()` 
2. Merge migrated session/settings into IDB if present; delete LS keys after successful write
3. `listSessions` + `getMeta` + `getSettings`
4. `useTreeStore.getState().hydrateFromIdb(...)`
5. `useSettingsStore.getState().hydrateFromDoc(...)`
6. Mark both hydrated

`startPersistRuntime` (call once in client):

- Subscribe `useTreeStore` — on change to sessions/current/canvas snapshot fields, debounce 400ms → `putSession` + `setMeta` + prune write-deletes
- Subscribe `useSettingsStore` — debounce 400ms → `putSettings` (include theme from settings doc; theme storage adapter also writes)
- `document.addEventListener("visibilitychange")` / `pagehide` → flush immediately

Prune: after save, if `Object.keys(sessions).length > 50`, compute victims with `pruneSessions`, `deleteSession` for removed ids, update store map.

- [ ] **Step 3: Theme IDB storage**

`src/lib/theme-idb-storage.ts` implements sync-ish API expected by next-themes. Because IDB is async, use an in-memory cache filled during `hydrateApp` before ThemeProvider mounts children that need theme—or pass `storage` that reads/writes cache and schedules IDB put.

Pattern:

```ts
let themeCache: ThemePreference = "system";

export function setThemeCache(t: ThemePreference) {
  themeCache = t;
}

export const themeIdbStorage = {
  getItem: () => themeCache,
  setItem: (_key: string, value: string) => {
    themeCache = value as ThemePreference;
    // schedule merge into settings IDB via settings-store.patch({ theme }) or direct putSettings
  },
  removeItem: () => {
    themeCache = "system";
  },
};
```

In `layout.tsx` / `ThemeProvider`:

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  storage={themeIdbStorage}
  storageKey="lucora-theme"
>
```

Ensure hydrate sets `themeCache` + settings before first paint that applies theme (arbor-app already gates on hydrate).

- [ ] **Step 4: Gate UI on hydrate in `arbor-app.tsx`**

```tsx
useEffect(() => {
  let stop = () => {};
  (async () => {
    await hydrateApp();
    stop = startPersistRuntime();
    useTreeStore.getState().setHydrated(true);
  })();
  return () => stop();
}, []);

const hydrated = useTreeStore((s) => s.hydrated);
// keep existing loading UI until hydrated
```

Also set settings `hydrated` true inside `hydrateApp`.

- [ ] **Step 5: Manual smoke**

```bash
npm run dev
```

- Set API key in 模型设定 → refresh → key still there  
- Create root → refresh → tree still there  

- [ ] **Step 6: Commit** (if requested)

---

### Task 6: History panel — session list UI

**Files:**
- Modify: `src/components/panels/history-panel.tsx`

- [ ] **Step 1: Rebuild panel with two tabs**

UI structure:

- Dialog title: `历史记录`
- Tab buttons: `思维树` (default) | `操作记录`
- **思维树** list: from `Object.values(sessions).sort((a,b)=>b.updatedAt-a.updatedAt)`  
  - Show title, `Object.keys(nodes).length` 节点, `toLocaleString(updatedAt)`  
  - Badge `当前` when `id === currentSessionId`  
  - Click: if not current → `syncCurrentIntoSessions()`; `switchSession(id)`; `useTemporal().clear()`; close dialog; toast optional  
  - Delete button (stopPropagation): confirm via `window.confirm` or inline; `deleteSessionById`
- **操作记录**: keep existing `historyLog` list UI

Use existing Dialog/ScrollArea; minimal styling consistent with arbor chrome (no new card clutter).

- [ ] **Step 2: Wire delete + switch edge cases**

- Switching to missing id: no-op  
- Deleting current: clear canvas + `currentSessionId=null`, keep other sessions  
- Empty list copy: `暂无保存的思维树`

- [ ] **Step 3: Visual check in browser**

Create tree A → new root B → open history → see A → click A → tree A restored → B still listed.

- [ ] **Step 4: Commit** (if requested)

---

### Task 7: README + full verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README 功能 bullet**

Replace/extend 历史 line:

```markdown
- **历史 / Undo / Redo**：多棵思维树本地会话库（IndexedDB）+ 操作日志 + `⌘/Ctrl+Z` / `⌘/Ctrl+⇧Z`
- **模型设定（BYOK）**：自备 Key；设定与主题一并存 IndexedDB
```

- [ ] **Step 2: Run automated checks**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: tests pass; build succeeds.

- [ ] **Step 3: Manual acceptance (spec)**

1. Edit tree → refresh → restored  
2. New root → old tree in history → click restores  
3. Clear canvas → old tree remains in history  
4. Switch A→B→A → both intact  
5. Legacy LS migration once (seed `localStorage` manually in DevTools if needed)  
6. >50 sessions prune (can unit-test only; optional manual)  
7. Operation log tab still works  
8. Settings survive refresh  
9. Theme survives refresh without `localStorage` theme key  

- [ ] **Step 4: Final commit** (if requested)

```bash
git add README.md src docs
git commit -m "$(cat <<'EOF'
feat: persist tree sessions and settings in IndexedDB

EOF
)"
```

---

## Notes for implementers

- Do **not** create a separate Zustand sessions store—only `tree-store` + existing `settings-store`.
- Do **not** persist zundo past/future stacks.
- `moveNode` drag: either include in debounced snapshot (simple) or skip mid-drag; prefer include—debounce covers it.
- Commits in this plan are optional until the user explicitly asks to commit.
- After plan approval, prefer @superpowers:subagent-driven-development (one task per subagent) or @superpowers:executing-plans for inline batches.
