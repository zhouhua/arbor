"use client";

import { useEffect, useState } from "react";

import { TreeCanvas } from "@/components/canvas/tree-canvas";
import { CanvasToolbar } from "@/components/canvas/canvas-toolbar";
import { FloatingComposer } from "@/components/canvas/floating-composer";
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
      <div className="flex h-dvh items-center justify-center bg-canvas text-muted-foreground">
        <p className="text-sm tracking-wide">加载画布…</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh overflow-hidden bg-canvas">
      <main className="relative min-h-0 min-w-0 flex-1">
        <TreeCanvas />
        <CanvasToolbar />
        <ArticlePanel />
        <FloatingComposer />

        {!rootId && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 pb-36">
            <div className="max-w-md animate-in fade-in duration-400 text-left">
              <p className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                Lucora
              </p>
              <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                清照
              </h1>
              <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-muted-foreground">
                把模糊议题照见成可展开的结构。在下方写下起点，Enter
                开始；选中节点后继续追问。
              </p>
              <p className="mt-5 text-xs text-muted-foreground/80">
                双击空白画布聚焦输入 · <kbd className="rounded border border-border px-1">/</kbd>{" "}
                快捷聚焦
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
