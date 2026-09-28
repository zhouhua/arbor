"use client";

import { Copy, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTreeStore } from "@/store/tree-store";

export function ArticlePanel() {
  const lastArticle = useTreeStore((s) => s.lastArticle);
  const clearArticle = useTreeStore((s) => s.clearArticle);

  if (!lastArticle) return null;

  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-4 z-30 mx-auto max-w-3xl md:inset-x-auto md:right-4 md:left-auto md:w-[min(440px,calc(100vw-2rem))]">
      <div className="pointer-events-auto overflow-hidden rounded-2xl border border-amber-700/20 bg-white/95 shadow-[0_20px_60px_-24px_rgba(120,53,15,0.45)] backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300">
        <div className="flex items-start justify-between gap-3 border-b border-amber-700/10 bg-gradient-to-r from-amber-50 to-orange-50/40 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-amber-800/70">
              链路总结
            </p>
            <h3 className="font-[family-name:var(--font-display)] text-lg text-slate-900">
              {lastArticle.title}
            </h3>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(lastArticle.article);
                toast.success("已复制全文");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={clearArticle}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[280px]">
          <article className="prose-sm whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-slate-700">
            {lastArticle.article}
          </article>
        </ScrollArea>
      </div>
    </div>
  );
}
