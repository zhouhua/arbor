"use client";

import { useCallback, useMemo } from "react";
import {
  Handle,
  NodeToolbar,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { focusComposer, runNodeAction } from "@/lib/node-actions";
import { cn } from "@/lib/utils";
import { useTreeStore } from "@/store/tree-store";
import type { TreeNodeKind } from "@/types/tree";

export type ArborNodeData = {
  title: string;
  content: string;
  kind: TreeNodeKind;
};

export type ArborFlowNode = Node<ArborNodeData, "arbor">;

export function ArborNode({ id, data, selected }: NodeProps<ArborFlowNode>) {
  const busyNodeId = useTreeStore((s) => s.busyNodeId);
  const deleteNode = useTreeStore((s) => s.deleteNode);
  const busy = busyNodeId === id;

  const onFollowUp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      useTreeStore.getState().selectNode(id);
      focusComposer("dialogue");
    },
    [id]
  );

  const onRegenerate = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const node = useTreeStore.getState().nodes[id];
      if (!node) return;
      await runNodeAction(id, "regenerate", node.prompt || node.title);
    },
    [id]
  );

  const onSummarize = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      useTreeStore.getState().selectNode(id);
      focusComposer("summarize");
    },
    [id]
  );

  const onDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteNode(id);
      toast.success("节点已删除");
    },
    [deleteNode, id]
  );

  return (
    <>
      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        offset={12}
        className="!m-0"
      >
        <div className="arbor-chrome flex items-center gap-0.5 rounded-xl p-1 shadow-md">
          <Quick
            label="跟进"
            onClick={onFollowUp}
            disabled={busy}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Quick>
          <Quick label="总结" onClick={onSummarize} disabled={busy}>
            <FileText className="h-3.5 w-3.5" />
          </Quick>
          <Quick label="重新生成" onClick={onRegenerate} disabled={busy}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Quick>
          <Quick label="删除" onClick={onDelete} disabled={busy} danger>
            <Trash2 className="h-3.5 w-3.5" />
          </Quick>
        </div>
      </NodeToolbar>

      <NodeToolbar
        isVisible={selected}
        position={Position.Bottom}
        offset={14}
        className="!m-0"
      >
        <button
          type="button"
          disabled={busy}
          onClick={onFollowUp}
          className={cn(
            "arbor-chrome inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-md",
            "text-foreground transition hover:bg-muted disabled:opacity-50"
          )}
        >
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
          跟进
        </button>
      </NodeToolbar>

      <div
        className={cn(
          "group relative w-[260px] rounded-xl border bg-card text-card-foreground transition-all duration-200",
          selected
            ? "border-primary/50 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_35%,transparent),0_12px_32px_-16px_oklch(0.3_0.05_255/0.35)]"
            : "border-border shadow-sm hover:border-foreground/20",
          busy && "opacity-75"
        )}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onFollowUp(e);
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2 !w-2 !border-2 !border-card !bg-primary"
        />

        <div className="space-y-1.5 px-3.5 py-3.5">
          <h3 className="font-heading text-[14px] font-semibold leading-snug text-foreground">
            {data.title}
          </h3>
          <p className="line-clamp-3 text-[12px] leading-relaxed text-muted-foreground">
            {data.content}
          </p>
        </div>

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-card/70 backdrop-blur-[1px]">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}

        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2 !w-2 !border-2 !border-card !bg-primary"
        />
      </div>
    </>
  );
}

function Quick({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-xs"
          variant="ghost"
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "text-muted-foreground",
            danger && "hover:bg-destructive/10 hover:text-destructive"
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function useArborNodeTypes() {
  return useMemo(() => ({ arbor: ArborNode }), []);
}

export function useOnNodeDragStop() {
  const moveNode = useTreeStore((s) => s.moveNode);
  return useCallback(
    (_: unknown, node: { id: string; position: { x: number; y: number } }) => {
      moveNode(node.id, node.position);
    },
    [moveNode]
  );
}
