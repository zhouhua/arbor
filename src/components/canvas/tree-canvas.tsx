"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useTreeStore } from "@/store/tree-store";
import { getChildren } from "@/lib/tree-utils";
import {
  useArborNodeTypes,
  useOnNodeDragStop,
  type ArborFlowNode,
} from "@/components/canvas/arbor-node";

function CanvasInner() {
  const nodesMap = useTreeStore((s) => s.nodes);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const selectNode = useTreeStore((s) => s.selectNode);
  const nodeTypes = useArborNodeTypes();
  const onNodeDragStop = useOnNodeDragStop();

  const flowNodes: ArborFlowNode[] = useMemo(() => {
    return Object.values(nodesMap).map((n) => ({
      id: n.id,
      type: "arbor" as const,
      position: n.position,
      selected: n.id === selectedNodeId,
      data: {
        title: n.title,
        content: n.content,
        kind: n.kind,
        childCount: getChildren(nodesMap, n.id).length,
      },
    }));
  }, [nodesMap, selectedNodeId]);

  const flowEdges: Edge[] = useMemo(() => {
    return Object.values(nodesMap)
      .filter((n) => n.parentId)
      .map((n) => ({
        id: `e-${n.parentId}-${n.id}`,
        source: n.parentId!,
        target: n.id,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#0f766e", strokeWidth: 1.6, opacity: 0.55 },
      }));
  }, [nodesMap]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      selectNode(selected[0]?.id ?? null);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
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
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      panOnScroll
      selectionOnDrag={false}
      proOptions={{ hideAttribution: true }}
      className="bg-transparent"
    >
      <Background
        id="dots"
        variant={BackgroundVariant.Dots}
        gap={22}
        size={1.4}
        color="rgba(15, 118, 110, 0.18)"
      />
      <Controls
        showInteractive={false}
        className="!overflow-hidden !rounded-xl !border-teal-900/10 !bg-white/90 !shadow-md"
      />
      <MiniMap
        nodeColor={(n) =>
          n.data?.kind === "root"
            ? "#0f766e"
            : n.data?.kind === "summary"
              ? "#d97706"
              : "#475569"
        }
        maskColor="rgba(15, 45, 42, 0.08)"
        className="!overflow-hidden !rounded-xl !border-teal-900/10 !bg-white/80"
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
