"use client";

import { useEffect, useState } from "react";
import {
  Undo2,
  Redo2,
  History,
  Plus,
  Eraser,
  Keyboard,
  Settings2,
  Loader2,
  LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { createRootAndExpand, focusComposer } from "@/lib/node-actions";
import { useTreeStore } from "@/store/tree-store";
import { useTemporal } from "@/store/use-temporal";
import { HistoryPanel } from "@/components/panels/history-panel";
import { SettingsPanel } from "@/components/panels/settings-panel";

export function CanvasToolbar() {
  const resetAll = useTreeStore((s) => s.resetAll);
  const rootId = useTreeStore((s) => s.rootId);
  const busyNodeId = useTreeStore((s) => s.busyNodeId);
  const organizeLayout = useTreeStore((s) => s.organizeLayout);
  const temporal = useTemporal();

  const [createOpen, setCreateOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        temporal.undo();
      } else if (
        meta &&
        (e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        temporal.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [temporal]);

  const canUndo = temporal.pastStates.length > 0;
  const canRedo = temporal.futureStates.length > 0;

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="arbor-chrome pointer-events-auto flex items-center gap-2.5 rounded-xl px-3 py-2 shadow-sm">
          <div>
            <p className="font-heading text-base leading-none font-semibold tracking-tight text-foreground">
              清照
            </p>
            <p className="mt-1 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Lucora
            </p>
          </div>
        </div>

        <div className="arbor-chrome pointer-events-auto flex flex-wrap items-center gap-0.5 rounded-xl p-1 shadow-sm">
          <Tool
            label="新建根议题"
            onClick={() => {
              if (!rootId) {
                focusComposer();
                return;
              }
              setTitle("");
              setContent("");
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
          </Tool>
          <Tool
            label="撤销 ⌘Z"
            disabled={!canUndo}
            onClick={() => temporal.undo()}
          >
            <Undo2 className="h-4 w-4" />
          </Tool>
          <Tool
            label="重做 ⌘⇧Z"
            disabled={!canRedo}
            onClick={() => temporal.redo()}
          >
            <Redo2 className="h-4 w-4" />
          </Tool>
          <Tool label="历史记录" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4" />
          </Tool>
          <Tool
            label="整理布局 ⇧F"
            disabled={!rootId}
            onClick={() => {
              organizeLayout();
              toast.success("已整理布局");
            }}
          >
            <LayoutTemplate className="h-4 w-4" />
          </Tool>
          <Tool label="模型设定" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4" />
          </Tool>
          <Tool
            label="快捷键"
            onClick={() =>
              toast.message("快捷键", {
                description:
                  "/ 聚焦 · Esc 取消选中 · Delete 删除 · ⌘Z/⌘⇧Z 撤销重做 · ⌘+/⌘- 缩放 · ⌘0 100% · ⌘1 适应 · ⇧F 整理 · 双击空白聚焦 · 滚轮平移 · ⌘滚轮缩放",
              })
            }
          >
            <Keyboard className="h-4 w-4" />
          </Tool>
          <ThemeToggle />
          <Tool
            label="清空画布"
            disabled={!rootId}
            onClick={() => {
              resetAll();
              temporal.clear();
              toast.success("画布已清空");
              focusComposer();
            }}
          >
            <Eraser className="h-4 w-4" />
          </Tool>
        </div>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (creating) return;
          setCreateOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>替换为新根议题</DialogTitle>
            <DialogDescription>
              将清空当前思维树，并以新议题重新拆解。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="议题标题"
              autoFocus
              disabled={creating}
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="补充背景（可选）"
              rows={3}
              className="resize-none"
              disabled={creating}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              取消
            </Button>
            <Button
              disabled={!title.trim() || creating || !!busyNodeId}
              onClick={async () => {
                setCreating(true);
                try {
                  temporal.clear();
                  setCreateOpen(false);
                  await createRootAndExpand(title, content);
                  setTitle("");
                  setContent("");
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  拆解中
                </>
              ) : (
                "替换并拆解"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HistoryPanel open={historyOpen} onOpenChange={setHistoryOpen} />
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

function Tool({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={disabled}
          onClick={onClick}
          className="text-muted-foreground"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
