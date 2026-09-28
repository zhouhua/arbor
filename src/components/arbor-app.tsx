"use client";

import { useEffect, useState } from "react";
import { GitBranchPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TreeCanvas } from "@/components/canvas/tree-canvas";
import { CanvasToolbar } from "@/components/canvas/canvas-toolbar";
import { NodeActionPanel } from "@/components/panels/node-action-panel";
import { ArticlePanel } from "@/components/panels/article-panel";
import { useTreeStore } from "@/store/tree-store";

export function ArborApp() {
  const rootId = useTreeStore((s) => s.rootId);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[color:var(--canvas-bg)] text-slate-500">
        加载画布…
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[color:var(--canvas-bg)] md:flex-row">
      <div className="arbor-atmosphere pointer-events-none absolute inset-0" />

      <main className="relative min-h-0 min-w-0 flex-1">
        <TreeCanvas />
        <CanvasToolbar />
        <ArticlePanel />

        {!rootId && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="pointer-events-auto max-w-lg animate-in fade-in zoom-in-95 duration-500 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-800 text-white shadow-lg shadow-teal-900/20">
                <GitBranchPlus className="h-7 w-7" />
              </div>
              <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-teal-950 sm:text-5xl">
                枝脉
              </h1>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                用思维树代替线性对话。写下根议题后立刻拆解分支，再随时修正、总结、回退。
              </p>
              <Button
                className="mt-6"
                size="lg"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("arbor:new-root"));
                }}
              >
                创建第一个议题
              </Button>
            </div>
          </div>
        )}
      </main>

      <div className="relative z-20 max-h-[40vh] shrink-0 overflow-auto border-t border-teal-900/10 md:max-h-none md:w-[320px] md:border-t-0 md:border-l">
        <NodeActionPanel />
      </div>
    </div>
  );
}
