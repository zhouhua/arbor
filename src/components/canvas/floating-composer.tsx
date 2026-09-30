"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  FileText,
  Loader2,
  MessageSquare,
  PenLine,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createRootAndExpand,
  runNodeAction,
  type ComposerMode,
} from "@/lib/node-actions";
import { getChildren } from "@/lib/tree-utils";
import { cn } from "@/lib/utils";
import { useTemporal } from "@/store/use-temporal";
import { useTreeStore } from "@/store/tree-store";

const modes: {
  id: ComposerMode;
  label: string;
  icon: React.ReactNode;
  needsChildren?: boolean;
}[] = [
  {
    id: "dialogue",
    label: "对话",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
  },
  {
    id: "refine",
    label: "修正",
    icon: <PenLine className="h-3.5 w-3.5" />,
    needsChildren: true,
  },
  {
    id: "summarize",
    label: "总结",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
];

const placeholders: Record<ComposerMode | "root", string> = {
  root: "写下你的根议题，回车开始拆解…",
  dialogue: "继续追问或指定拆解方向，⌘↵ 发送…",
  refine: "说明要增删或改写哪些子节点，⌘↵ 发送…",
  summarize: "说明总结风格或受众，⌘↵ 发送…",
};

export function FloatingComposer() {
  const rootId = useTreeStore((s) => s.rootId);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const nodes = useTreeStore((s) => s.nodes);
  const busyNodeId = useTreeStore((s) => s.busyNodeId);
  const selectNode = useTreeStore((s) => s.selectNode);
  const temporal = useTemporal();

  const [mode, setMode] = useState<ComposerMode>("dialogue");
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selected = selectedNodeId ? nodes[selectedNodeId] : null;
  const targetId = selectedNodeId ?? rootId;
  const targetHasChildren = targetId
    ? getChildren(nodes, targetId).length > 0
    : false;
  const isEmptyCanvas = !rootId;
  const busy = !!busyNodeId || sending;

  useEffect(() => {
    const onFocus = (e: Event) => {
      const detail = (e as CustomEvent<{ mode?: ComposerMode }>).detail;
      if (detail?.mode) setMode(detail.mode);
      requestAnimationFrame(() => textareaRef.current?.focus());
    };
    const onNewRoot = () => {
      selectNode(null);
      setPrompt("");
      setMode("dialogue");
      requestAnimationFrame(() => textareaRef.current?.focus());
    };
    window.addEventListener("arbor:focus-composer", onFocus);
    window.addEventListener("arbor:new-root", onNewRoot);
    return () => {
      window.removeEventListener("arbor:focus-composer", onFocus);
      window.removeEventListener("arbor:new-root", onNewRoot);
    };
  }, [selectNode]);

  useEffect(() => {
    if (mode === "refine" && !targetHasChildren && !isEmptyCanvas) {
      setMode("dialogue");
    }
  }, [mode, targetHasChildren, isEmptyCanvas]);

  const submit = useCallback(async () => {
    const text = prompt.trim();
    if (!text || busy) return;

    setSending(true);
    try {
      if (isEmptyCanvas) {
        temporal.clear();
        const lines = text.split("\n");
        const title = lines[0]!.trim();
        const content = lines.slice(1).join("\n").trim();
        await createRootAndExpand(title, content || undefined);
        setPrompt("");
        return;
      }

      const target = selectedNodeId ?? rootId;
      if (!target) {
        toast.message("请先选中一个节点");
        return;
      }

      if (
        mode === "refine" &&
        getChildren(useTreeStore.getState().nodes, target).length === 0
      ) {
        toast.message("当前节点没有子节点可修正");
        return;
      }

      const ok = await runNodeAction(target, mode, text);
      if (ok) setPrompt("");
    } finally {
      setSending(false);
    }
  }, [
    prompt,
    busy,
    isEmptyCanvas,
    temporal,
    selectedNodeId,
    rootId,
    mode,
  ]);

  const placeholder = isEmptyCanvas
    ? placeholders.root
    : placeholders[mode];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5 pt-16">
      <div
        className={cn(
          "arbor-chrome pointer-events-auto w-full max-w-2xl overflow-hidden rounded-2xl shadow-lg",
          "ring-1 ring-foreground/5 transition-shadow focus-within:shadow-xl focus-within:ring-primary/25"
        )}
      >
        {!isEmptyCanvas && selected && (
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
            <span className="text-[11px] text-muted-foreground">从</span>
            <button
              type="button"
              className="max-w-[70%] truncate rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
              onClick={() => textareaRef.current?.focus()}
            >
              {selected.title}
            </button>
            <span className="text-[11px] text-muted-foreground">继续</span>
            <button
              type="button"
              className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="取消选中"
              onClick={() => selectNode(null)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {!isEmptyCanvas && !selected && (
          <div className="border-b border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
            点击节点设为上下文，或直接对根节点发送
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          rows={isEmptyCanvas ? 2 : 2}
          disabled={busy}
          className="min-h-[56px] resize-none border-0 bg-transparent px-3.5 py-3 text-[15px] shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            } else if (
              e.key === "Enter" &&
              !e.shiftKey &&
              isEmptyCanvas &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              void submit();
            }
          }}
        />

        <div className="flex items-center gap-1 px-2 pb-2">
          {!isEmptyCanvas &&
            modes.map((m) => {
              const disabled = !!m.needsChildren && !targetHasChildren;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                    mode === m.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    disabled && "opacity-40"
                  )}
                >
                  {m.icon}
                  {m.label}
                </button>
              );
            })}

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[10px] text-muted-foreground sm:inline">
              {isEmptyCanvas ? "Enter 发送" : "⌘↵ 发送"}
            </span>
            <Button
              size="icon-sm"
              disabled={!prompt.trim() || busy}
              onClick={() => void submit()}
              className="rounded-full"
              aria-label="发送"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
