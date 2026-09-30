"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useTreeStore } from "@/store/tree-store";
import { focusComposer } from "@/lib/node-actions";
import {
  useArborNodeTypes,
  useOnNodeDragStop,
  type ArborFlowNode,
} from "@/components/canvas/arbor-node";
import {
  CanvasNav,
  CANVAS_FIT_PADDING,
  fitCanvasView,
} from "@/components/canvas/canvas-nav";

function CanvasEffects() {
  const { fitView } = useReactFlow();
  const layoutTick = useTreeStore((s) => s.layoutTick);
  const nodeCount = useTreeStore((s) => Object.keys(s.nodes).length);
  const prevTick = useRef(layoutTick);
  const didInitialFit = useRef(false);

  useEffect(() => {
    if (layoutTick !== prevTick.current) {
      prevTick.current = layoutTick;
      const t = window.setTimeout(() => {
        void fitCanvasView(fitView, { duration: 420 });
      }, 60);
      return () => window.clearTimeout(t);
    }
  }, [layoutTick, fitView]);

  useEffect(() => {
    if (didInitialFit.current || nodeCount === 0) return;
    didInitialFit.current = true;
    const t = window.setTimeout(() => {
      void fitCanvasView(fitView, { duration: 0 });
    }, 80);
    return () => window.clearTimeout(t);
  }, [nodeCount, fitView]);

  return null;
}

function toFlowNodes(
  nodesMap: ReturnType<typeof useTreeStore.getState>["nodes"],
  selectedNodeId: string | null
): ArborFlowNode[] {
  return Object.values(nodesMap).map((n) => ({
    id: n.id,
    type: "arbor" as const,
    position: n.position,
    selected: n.id === selectedNodeId,
    data: {
      title: n.title,
      content: n.content,
      kind: n.kind,
    },
  }));
}

function toFlowEdges(
  nodesMap: ReturnType<typeof useTreeStore.getState>["nodes"]
): Edge[] {
  return Object.values(nodesMap)
    .filter((n) => n.parentId)
    .map((n) => ({
      id: `e-${n.parentId}-${n.id}`,
      source: n.parentId!,
      target: n.id,
      type: "default" as const,
      animated: false,
      style: {
        stroke: "var(--edge)",
        strokeWidth: 1.35,
      },
    }));
}

function CanvasInner() {
  const nodesMap = useTreeStore((s) => s.nodes);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const selectNode = useTreeStore((s) => s.selectNode);
  const deleteNode = useTreeStore((s) => s.deleteNode);
  const nodeTypes = useArborNodeTypes();
  const onNodeDragStop = useOnNodeDragStop();

  const structureSig = useMemo(
    () =>
      Object.values(nodesMap)
        .map(
          (n) =>
            `${n.id}:${n.position.x}:${n.position.y}:${n.title}:${n.content}:${n.kind}`
        )
        .sort()
        .join("|"),
    [nodesMap]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<ArborFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes(toFlowNodes(nodesMap, useTreeStore.getState().selectedNodeId));
    setEdges(toFlowEdges(nodesMap));
  }, [structureSig, nodesMap, setNodes, setEdges]);

  useEffect(() => {
    setNodes((nds) => {
      let changed = false;
      const next = nds.map((n) => {
        const selected = n.id === selectedNodeId;
        if (n.selected !== selected) {
          changed = true;
          return { ...n, selected };
        }
        return n;
      });
      return changed ? next : nds;
    });
  }, [selectedNodeId, setNodes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        selectNode(null);
        return;
      }

      if (typing) return;

      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        focusComposer();
        return;
      }

      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        selectedNodeId &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        deleteNode(selectedNodeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteNode, selectNode, selectedNodeId]);

  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      const id = selected[0]?.id ?? null;
      if (id !== useTreeStore.getState().selectedNodeId) {
        selectNode(id);
      }
    },
    [selectNode]
  );

  const lastPaneClick = useRef(0);

  const onPaneClick = useCallback(() => {
    const now = Date.now();
    if (now - lastPaneClick.current < 320) {
      focusComposer("dialogue");
      lastPaneClick.current = 0;
      return;
    }
    lastPaneClick.current = now;
    selectNode(null);
  }, [selectNode]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onSelectionChange={onSelectionChange}
      onPaneClick={onPaneClick}
      onNodeDragStop={onNodeDragStop}
      fitViewOptions={{
        padding: CANVAS_FIT_PADDING,
        maxZoom: 1.05,
      }}
      minZoom={0.12}
      maxZoom={2.5}
      panOnScroll
      panOnScrollSpeed={1.2}
      zoomOnPinch
      zoomOnScroll={false}
      zoomActivationKeyCode={["Meta", "Control"]}
      zoomOnDoubleClick={false}
      selectionOnDrag={false}
      panOnDrag
      proOptions={{ hideAttribution: true }}
      className="bg-transparent"
      defaultEdgeOptions={{
        type: "default",
        style: { stroke: "var(--edge)", strokeWidth: 1.35 },
      }}
    >
      <CanvasEffects />
      <Background
        id="dots"
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1}
        color="color-mix(in oklch, var(--foreground) 10%, transparent)"
      />
      <CanvasNav />
      <MiniMap
        pannable
        zoomable
        position="bottom-right"
        nodeColor={(n) => {
          const kind = (n.data as { kind?: string } | undefined)?.kind;
          if (kind === "root") return "var(--primary)";
          if (kind === "summary") return "var(--muted-foreground)";
          return "color-mix(in oklch, var(--foreground) 35%, transparent)";
        }}
        maskColor="color-mix(in oklch, var(--foreground) 6%, transparent)"
        className="arbor-chrome !mb-4 !mr-4 !overflow-hidden !rounded-xl !border-0 !shadow-sm"
      />
    </ReactFlow>
  );
}

export function TreeCanvas() {
  return (
    <ReactFlowProvider>
      <div className="h-full w-full">
        <CanvasInner />
      </div>
    </ReactFlowProvider>
  );
}
