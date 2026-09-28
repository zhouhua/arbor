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
import { useTreeStore } from "@/store/tree-store";
import { useTemporal } from "@/store/use-temporal";
import { HistoryPanel } from "@/components/panels/history-panel";
import { SettingsPanel } from "@/components/panels/settings-panel";
import { expandNodeWithDialogue } from "@/lib/expand-node";

export function CanvasToolbar() {
  const createRoot = useTreeStore((s) => s.createRoot);
  const resetAll = useTreeStore((s) => s.resetAll);
  const rootId = useTreeStore((s) => s.rootId);
  const busyNodeId = useTreeStore((s) => s.busyNodeId);
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
    const onNewRoot = () => {
      setTitle("");
      setContent("");
      setCreateOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("arbor:new-root", onNewRoot);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("arbor:new-root", onNewRoot);
    };
  }, [temporal]);

  const canUndo = temporal.pastStates.length > 0;
  const canRedo = temporal.futureStates.length > 0;

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-teal-900/10 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-md">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg leading-none text-teal-950">
              枝脉
            </p>
            <p className="mt-0.5 text-[10px] tracking-[0.18em] text-teal-800/60 uppercase">
              Arbor · Tree Thinking
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-2xl border border-teal-900/10 bg-white/80 p-1.5 shadow-sm backdrop-blur-md">
          <Tool
            label="新建根节点"
            onClick={() => {
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
          <Tool label="模型设定" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4" />
          </Tool>
          <Tool
            label="快捷键"
            onClick={() =>
              toast.message("快捷键", {
                description: "⌘/Ctrl+Z 撤销 · ⌘/Ctrl+⇧Z 或 ⌘Y 重做 · 滚轮缩放 · 拖动画布平移",
              })
            }
          >
            <Keyboard className="h-4 w-4" />
          </Tool>
          <Tool
            label="清空画布"
            disabled={!rootId}
            onClick={() => {
              resetAll();
              temporal.clear();
              toast.success("画布已清空");
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
            <DialogTitle>新建根议题</DialogTitle>
            <DialogDescription>
              {rootId
                ? "将替换当前整棵思维树，并立即拆解出下级分支。"
                : "创建一个核心议题后，AI 会立刻多角度拆解出下级节点。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="议题标题，例如：如何提升新用户留存"
              autoFocus
              disabled={creating}
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="补充背景、约束或你已经知道的信息…"
              rows={4}
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
                const topic = title.trim();
                const body =
                  content.trim() || "从这里开始拆解与多角度探索。";
                setCreating(true);
                try {
                  if (rootId) {
                    resetAll();
                    temporal.clear();
                  }
                  const id = createRoot(topic, body);
                  setCreateOpen(false);
                  toast.message("根节点已创建，正在拆解…");
                  await expandNodeWithDialogue(
                    id,
                    `请围绕「${topic}」进行首轮拆解：从核心目标、多角度分析、可行路径等方向生成下级节点。背景：${body}`
                  );
                } finally {
                  setCreating(false);
                  setTitle("");
                  setContent("");
                }
              }}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  拆解中
                </>
              ) : (
                "开始并拆解"
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
          className="text-slate-700"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
