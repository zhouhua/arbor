"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useTreeStore } from "@/store/tree-store";
import { useTemporal } from "@/store/use-temporal";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const typeLabel: Record<string, string> = {
  "create-root": "创建",
  dialogue: "对话",
  refine: "修正",
  summarize: "总结",
  regenerate: "重生成",
  delete: "删除",
  move: "移动",
  edit: "编辑",
};

export function HistoryPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<"trees" | "ops">("trees");
  const sessions = useTreeStore((s) => s.sessions);
  const currentSessionId = useTreeStore((s) => s.currentSessionId);
  const switchSession = useTreeStore((s) => s.switchSession);
  const syncCurrentIntoSessions = useTreeStore(
    (s) => s.syncCurrentIntoSessions
  );
  const deleteSessionById = useTreeStore((s) => s.deleteSessionById);
  const historyLog = useTreeStore((s) => s.historyLog);
  const selectNode = useTreeStore((s) => s.selectNode);
  const nodes = useTreeStore((s) => s.nodes);
  const temporal = useTemporal();

  const sessionList = useMemo(
    () =>
      Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>历史记录</DialogTitle>
          <DialogDescription>
            本地保存的思维树与当前树的操作记录。
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors",
              tab === "trees"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
            onClick={() => setTab("trees")}
          >
            思维树
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors",
              tab === "ops"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
            onClick={() => setTab("ops")}
          >
            操作记录
          </button>
        </div>

        <ScrollArea className="h-[360px] pr-3">
          {tab === "trees" ? (
            sessionList.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                暂无保存的思维树
              </p>
            ) : (
              <ul className="space-y-1">
                {sessionList.map((session) => {
                  const isCurrent = session.id === currentSessionId;
                  const nodeCount = Object.keys(session.nodes).length;
                  return (
                    <li key={session.id} className="flex items-stretch gap-1">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                        onClick={() => {
                          if (isCurrent) {
                            onOpenChange(false);
                            return;
                          }
                          syncCurrentIntoSessions();
                          switchSession(session.id);
                          temporal.clear();
                          onOpenChange(false);
                        }}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="block truncate text-sm text-foreground">
                              {session.title}
                            </span>
                            {isCurrent && (
                              <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                                当前
                              </span>
                            )}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {nodeCount} 个节点 ·{" "}
                            {new Date(session.updatedAt).toLocaleString()}
                          </span>
                        </span>
                      </button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="mt-1.5 shrink-0 text-muted-foreground"
                        aria-label="删除会话"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `删除思维树「${session.title}」？此操作不可撤销。`
                            )
                          ) {
                            return;
                          }
                          deleteSessionById(session.id);
                          if (isCurrent) temporal.clear();
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : historyLog.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              暂无操作记录
            </p>
          ) : (
            <ul className="space-y-1">
              {historyLog.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                    onClick={() => {
                      if (h.nodeId && nodes[h.nodeId]) {
                        selectNode(h.nodeId);
                        onOpenChange(false);
                      }
                    }}
                  >
                    <span className="mt-0.5 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                      {typeLabel[h.type] ?? h.type}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">
                        {h.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
