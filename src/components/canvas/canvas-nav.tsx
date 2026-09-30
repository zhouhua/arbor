"use client";

import { useCallback, useEffect, useState } from "react";
import { useReactFlow, useViewport, Panel } from "@xyflow/react";
import {
  Focus,
  LayoutTemplate,
  Minus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTreeStore } from "@/store/tree-store";
import { cn } from "@/lib/utils";

/** 给底部 Composer 留白的 fitView padding */
export const CANVAS_FIT_PADDING = {
  top: 0.12,
  right: 0.14,
  bottom: 0.32,
  left: 0.14,
} as const;

export function fitCanvasView(
  fitView: ReturnType<typeof useReactFlow>["fitView"],
  opts?: { duration?: number; maxZoom?: number }
) {
  return fitView({
    padding: CANVAS_FIT_PADDING,
    duration: opts?.duration ?? 380,
    maxZoom: opts?.maxZoom ?? 1.05,
    minZoom: 0.2,
  });
}

/**
 * Flowith 风格画布导航：缩放百分比、适应画布、整理布局。
 * 放在左下角，避开默认 Controls。
 */
export function CanvasNav() {
  const { zoomIn, zoomOut, zoomTo, fitView, setCenter, getNodes } =
    useReactFlow();
  const { zoom } = useViewport();
  const organizeLayout = useTreeStore((s) => s.organizeLayout);
  const rootId = useTreeStore((s) => s.rootId);
  const [pct, setPct] = useState(100);

  useEffect(() => {
    setPct(Math.round(zoom * 100));
  }, [zoom]);

  const onFit = useCallback(() => {
    void fitCanvasView(fitView, { duration: 420 });
  }, [fitView]);

  const onResetZoom = useCallback(() => {
    const nodes = getNodes();
    if (nodes.length === 0) {
      void zoomTo(1, { duration: 280 });
      return;
    }
    const selected = nodes.find((n) => n.selected) ?? nodes[0]!;
    const w = selected.measured?.width ?? 260;
    const h = selected.measured?.height ?? 118;
    void setCenter(selected.position.x + w / 2, selected.position.y + h / 2, {
      zoom: 1,
      duration: 320,
    });
  }, [getNodes, setCenter, zoomTo]);

  const onOrganize = useCallback(() => {
    if (!rootId) {
      toast.message("画布为空");
      return;
    }
    organizeLayout();
    toast.success("已整理布局");
    // fitView 由 layoutTick → CanvasEffects 统一处理
  }, [organizeLayout, rootId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;

      const meta = e.metaKey || e.ctrlKey;

      if (meta && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        void zoomIn({ duration: 160 });
        return;
      }
      if (meta && e.key === "-") {
        e.preventDefault();
        void zoomOut({ duration: 160 });
        return;
      }
      if (meta && e.key === "0") {
        e.preventDefault();
        onResetZoom();
        return;
      }
      if (meta && e.key === "1") {
        e.preventDefault();
        onFit();
        return;
      }
      if (!meta && (e.key === "f" || e.key === "F") && e.shiftKey) {
        e.preventDefault();
        onOrganize();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFit, onOrganize, onResetZoom, zoomIn, zoomOut]);

  return (
    <Panel
      position="bottom-left"
      className="!mb-5 !ml-4 flex items-center gap-1.5"
    >
      <div className="arbor-chrome flex items-center gap-0.5 rounded-xl p-1 shadow-sm">
        <NavBtn label="缩小 ⌘-" onClick={() => void zoomOut({ duration: 160 })}>
          <Minus className="h-3.5 w-3.5" />
        </NavBtn>
        <button
          type="button"
          onClick={onResetZoom}
          className={cn(
            "min-w-[3.25rem] rounded-lg px-1.5 py-1.5 text-center text-[11px] font-medium tabular-nums",
            "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          )}
          title="重置为 100%"
        >
          {pct}%
        </button>
        <NavBtn label="放大 ⌘+" onClick={() => void zoomIn({ duration: 160 })}>
          <Plus className="h-3.5 w-3.5" />
        </NavBtn>
      </div>

      <div className="arbor-chrome flex items-center gap-0.5 rounded-xl p-1 shadow-sm">
        <NavBtn label="适应画布 ⌘1" onClick={onFit}>
          <Focus className="h-3.5 w-3.5" />
        </NavBtn>
        <NavBtn
          label="整理布局 ⇧F"
          onClick={onOrganize}
          disabled={!rootId}
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
        </NavBtn>
      </div>
    </Panel>
  );
}

function NavBtn({
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
          size="icon-xs"
          variant="ghost"
          disabled={disabled}
          onClick={onClick}
          className="text-muted-foreground"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
