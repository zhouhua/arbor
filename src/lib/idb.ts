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
  return all.reverse();
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
