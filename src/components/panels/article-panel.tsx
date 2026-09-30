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
    <div className="pointer-events-none absolute inset-x-4 bottom-[7.5rem] z-30 mx-auto max-w-3xl md:inset-x-auto md:right-4 md:bottom-24 md:left-auto md:w-[min(420px,calc(100vw-2rem))]">
      <div className="arbor-chrome pointer-events-auto overflow-hidden rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-250">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              链路总结
            </p>
            <h3 className="mt-0.5 font-heading text-lg font-semibold text-foreground">
              {lastArticle.title}
            </h3>
          </div>
          <div className="flex gap-0.5">
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
          <article className="whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-foreground/90">
            {lastArticle.article}
          </article>
        </ScrollArea>
      </div>
    </div>
  );
}
