"use client";

import { useCallback, useMemo } from "react";
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTreeStore } from "@/store/tree-store";
import type { TreeNodeKind } from "@/types/tree";

export type ArborNodeData = {
  title: string;
  content: string;
  kind: TreeNodeKind;
  childCount: number;
};

export type ArborFlowNode = Node<ArborNodeData, "arbor">;

export function ArborNode({ id, data, selected }: NodeProps<ArborFlowNode>) {
  const busyNodeId = useTreeStore((s) => s.busyNodeId);
  const busy = busyNodeId === id;

  const accent =
    data.kind === "root"
      ? "from-teal-700 to-teal-900"
      : data.kind === "summary"
        ? "from-amber-600 to-amber-800"
        : "from-slate-600 to-slate-800";

  return (
    <div
      className={cn(
        "group relative w-[280px] rounded-2xl border bg-[color:var(--node-bg)] shadow-sm transition-all duration-300",
        selected
          ? "border-teal-600/70 shadow-[0_12px_40px_-18px_rgba(13,86,78,0.55)] scale-[1.02]"
          : "border-teal-900/10 hover:border-teal-700/30 hover:shadow-md",
        busy && "opacity-80"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-teal-700"
      />

      <div
        className={cn(
          "flex items-center gap-2 rounded-t-2xl bg-gradient-to-r px-3.5 py-2 text-white",
          accent
        )}
      >
        <Sparkles className="h-3.5 w-3.5 opacity-80" />
        <span className="truncate text-xs font-medium tracking-wide">
          {data.kind === "root"
            ? "根议题"
            : data.kind === "summary"
              ? "总结"
              : "分支"}
        </span>
        {data.childCount > 0 && (
          <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
            {data.childCount} 子节点
          </span>
        )}
      </div>

      <div className="space-y-2 px-3.5 py-3">
        <h3 className="font-[family-name:var(--font-display)] text-[15px] font-semibold leading-snug text-slate-900">
          {data.title}
        </h3>
        <p className="line-clamp-3 text-xs leading-relaxed text-slate-600">
          {data.content}
        </p>
      </div>

      {busy && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/55 backdrop-blur-[1px]">
          <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-teal-700"
      />
    </div>
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
