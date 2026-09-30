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
    expect(list.map((s) => s.id)).toEqual(["a", "b"]);
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
