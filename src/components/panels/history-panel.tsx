"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTreeStore } from "@/store/tree-store";

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
  const historyLog = useTreeStore((s) => s.historyLog);
  const selectNode = useTreeStore((s) => s.selectNode);
  const nodes = useTreeStore((s) => s.nodes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>操作历史</DialogTitle>
          <DialogDescription>
            最近 100 条操作记录。撤销/重做请使用工具栏或快捷键。
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[360px] pr-3">
          {historyLog.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              暂无历史记录
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
