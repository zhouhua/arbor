import { describe, expect, it } from "vitest";
import {
  parseLegacySettings,
  parseLegacyTree,
  pruneSessions,
  sessionTitleFromNodes,
} from "@/lib/persist-runtime";
import type { TreeNode, TreeSession } from "@/types/tree";

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
    expect(next.s1).toBeUndefined();
    expect(next.s54).toBeTruthy();
  });
});

describe("sessionTitleFromNodes", () => {
  it("uses root title", () => {
    const root: TreeNode = {
      id: "r",
      parentId: null,
      title: "议题A",
      content: "",
      kind: "root",
      position: { x: 0, y: 0 },
      createdAt: 0,
      updatedAt: 0,
    };
    expect(sessionTitleFromNodes({ r: root }, "r")).toBe("议题A");
  });

  it("falls back when empty", () => {
    expect(sessionTitleFromNodes({}, null)).toBe("未命名议题");
  });
});

describe("parseLegacy", () => {
  it("parses zustand tree persist blob", () => {
    const raw = JSON.stringify({
      state: {
        nodes: {
          r: {
            id: "r",
            parentId: null,
            title: "旧树",
            content: "x",
            kind: "root",
            position: { x: 0, y: 0 },
            createdAt: 1,
            updatedAt: 1,
          },
        },
        rootId: "r",
        selectedNodeId: "r",
        historyLog: [],
        lastArticle: null,
      },
    });
    const session = parseLegacyTree(raw);
    expect(session?.title).toBe("旧树");
    expect(session?.rootId).toBe("r");
  });

  it("parses settings blob", () => {
    const raw = JSON.stringify({
      state: { apiKey: "k", baseUrl: "", model: "m" },
    });
    expect(parseLegacySettings(raw)).toEqual({
      apiKey: "k",
      baseUrl: "",
      model: "m",
    });
  });
});
