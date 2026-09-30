"use client";

import {
  deleteSession,
  getMeta,
  getSettings,
  listSessions,
  putSession,
  putSettings,
  setMeta,
} from "@/lib/idb";
import {
  MAX_SESSIONS,
  clearLegacyLocalStorage,
  pruneSessions,
  readLegacyLocalStorage,
} from "@/lib/persist-runtime";
import { setThemeCache } from "@/lib/theme-idb-storage";
import { useSettingsStore } from "@/store/settings-store";
import { useTreeStore } from "@/store/tree-store";
import type { AppSettingsDoc, TreeSession } from "@/types/tree";

const SAVE_DEBOUNCE_MS = 400;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let settingsTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function sessionsRecord(
  list: TreeSession[]
): Record<string, TreeSession> {
  const map: Record<string, TreeSession> = {};
  for (const s of list) map[s.id] = s;
  return map;
}

async function persistTreeNow() {
  const state = useTreeStore.getState();
  state.syncCurrentIntoSessions();
  const after = useTreeStore.getState();
  let sessions = after.sessions;
  const pruned = pruneSessions(
    sessions,
    after.currentSessionId,
    MAX_SESSIONS
  );
  if (Object.keys(pruned).length !== Object.keys(sessions).length) {
    const removed = Object.keys(sessions).filter((id) => !pruned[id]);
    for (const id of removed) {
      await deleteSession(id);
    }
    useTreeStore.setState({ sessions: pruned });
    sessions = pruned;
  }

  for (const session of Object.values(sessions)) {
    await putSession(session);
  }
  await setMeta({
    currentSessionId: after.currentSessionId,
    version: 1,
  });
}

async function persistSettingsNow() {
  const s = useSettingsStore.getState();
  const doc: AppSettingsDoc = {
    apiKey: s.apiKey,
    baseUrl: s.baseUrl,
    model: s.model,
    theme: s.theme,
  };
  await putSettings(doc);
  setThemeCache(s.theme);
}

function scheduleTreeSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persistTreeNow();
  }, SAVE_DEBOUNCE_MS);
}

function scheduleSettingsSave() {
  if (settingsTimer) clearTimeout(settingsTimer);
  settingsTimer = setTimeout(() => {
    settingsTimer = null;
    void persistSettingsNow();
  }, SAVE_DEBOUNCE_MS);
}

export async function flushPersist() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (settingsTimer) {
    clearTimeout(settingsTimer);
    settingsTimer = null;
  }
  await Promise.all([persistTreeNow(), persistSettingsNow()]);
}

export async function hydrateApp() {
  const legacy = readLegacyLocalStorage();
  let sessions = sessionsRecord(await listSessions());
  let meta = await getMeta();
  const settings = await getSettings();

  if (legacy.session && !sessions[legacy.session.id]) {
    await putSession(legacy.session);
    sessions[legacy.session.id] = legacy.session;
    if (!meta?.currentSessionId) {
      meta = { currentSessionId: legacy.session.id, version: 1 };
      await setMeta(meta);
    }
  }

  const mergedSettings: AppSettingsDoc = {
    apiKey: settings?.apiKey ?? legacy.settings?.apiKey ?? "",
    baseUrl: settings?.baseUrl ?? legacy.settings?.baseUrl ?? "",
    model: settings?.model ?? legacy.settings?.model ?? "",
    theme:
      settings?.theme ??
      legacy.settings?.theme ??
      legacy.theme ??
      "system",
  };

  if (!settings || legacy.settings || legacy.theme) {
    await putSettings(mergedSettings);
  }

  if (legacy.session || legacy.settings || legacy.theme) {
    clearLegacyLocalStorage();
  }

  sessions = sessionsRecord(await listSessions());
  meta = (await getMeta()) ?? { currentSessionId: null, version: 1 };

  let currentSessionId = meta.currentSessionId;
  if (currentSessionId && !sessions[currentSessionId]) {
    currentSessionId = null;
  }
  if (!currentSessionId) {
    const newest = Object.values(sessions).sort(
      (a, b) => b.updatedAt - a.updatedAt
    )[0];
    currentSessionId = newest?.id ?? null;
  }

  useTreeStore.getState().hydrateFromIdb({ sessions, currentSessionId });
  useSettingsStore.getState().hydrateFromDoc(mergedSettings);
  setThemeCache(mergedSettings.theme);
  useSettingsStore.getState().setHydrated(true);
}

export function startPersistRuntime(): () => void {
  if (started || typeof window === "undefined") return () => {};
  started = true;

  const unsubTree = useTreeStore.subscribe((state, prev) => {
    if (!state.hydrated) return;
    const removed = Object.keys(prev.sessions).filter(
      (id) => !state.sessions[id]
    );
    for (const id of removed) {
      void deleteSession(id);
    }
    const changed =
      state.sessions !== prev.sessions ||
      state.currentSessionId !== prev.currentSessionId ||
      state.nodes !== prev.nodes ||
      state.rootId !== prev.rootId ||
      state.selectedNodeId !== prev.selectedNodeId ||
      state.historyLog !== prev.historyLog ||
      state.lastArticle !== prev.lastArticle;
    if (changed) scheduleTreeSave();
  });

  const unsubSettings = useSettingsStore.subscribe((state, prev) => {
    if (!state.hydrated) return;
    const changed =
      state.apiKey !== prev.apiKey ||
      state.baseUrl !== prev.baseUrl ||
      state.model !== prev.model ||
      state.theme !== prev.theme;
    if (changed) scheduleSettingsSave();
  });

  const onHide = () => {
    if (document.visibilityState === "hidden") {
      void flushPersist();
    }
  };
  const onPageHide = () => {
    void flushPersist();
  };

  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onPageHide);

  return () => {
    unsubTree();
    unsubSettings();
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onPageHide);
    started = false;
    if (saveTimer) clearTimeout(saveTimer);
    if (settingsTimer) clearTimeout(settingsTimer);
  };
}
