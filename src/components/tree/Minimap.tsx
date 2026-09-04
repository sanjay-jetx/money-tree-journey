import {
  Compass,
  Crosshair,
  Maximize2,
  Minimize2,
} from "lucide-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { NODE_H, NODE_W } from "@/lib/money/tree";
import type { Edge, PositionedNode } from "@/lib/money/tree";
import { cn } from "@/lib/utils";

interface MinimapProps {
  nodes: PositionedNode[];
  edges: Edge[];
  totalWidth: number;
  totalHeight: number;
  transform: { x: number; y: number; scale: number };
  onTransformChange: React.Dispatch<
    React.SetStateAction<{ x: number; y: number; scale: number }>
  >;
  containerWidth: number;
  containerHeight: number;
  activeId?: string | null | undefined;
  onCenterOnNode?: ((node: PositionedNode) => void) | undefined;
  onFit?: (() => void) | undefined;
  isOpen: boolean;
  onToggleOpen: () => void;
  className?: string | undefined;
}

function getNodeColor(node: PositionedNode): string {
  switch (node.kind) {
    case "root":      return "#d08c3c";
    case "income":    return "#3f6b3f";
    case "spent":     return "#b4482f";
    case "left":      return "#3c5f6e";
    case "month":     return "#8a5828";
    case "week":      return "#7a6652";
    case "date":      return "#8f8271";
    case "transaction":
    case "category":
      if (node.tone === "income")  return "#4a7c4a";
      if (node.tone === "expense") return "#c05338";
      return "#5d6d7e";
    default:          return "#8f8271";
  }
}

const MAP_W = 200;
const MAP_H = 120;
const PAD = 6;

/** Clamp a value between min and max. */
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function Minimap({
  nodes,
  edges,
  totalWidth,
  totalHeight,
  transform,
  onTransformChange,
  containerWidth,
  containerHeight,
  activeId,
  onCenterOnNode,
  onFit,
  isOpen,
  onToggleOpen,
  className,
}: MinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const [hoveredNode, setHoveredNode] = useState<PositionedNode | null>(null);

  // ── Viewport bounds in canvas (world) space ────────────────────────────────
  const viewportInCanvas = useMemo(() => {
    const s = Math.max(0.01, transform.scale);
    const left  = -transform.x / s;
    const top   = -transform.y / s;
    const w     = containerWidth  / s;
    const h     = containerHeight / s;
    return { left, top, right: left + w, bottom: top + h, w, h };
  }, [transform.x, transform.y, transform.scale, containerWidth, containerHeight]);

  // ── World bounding box: union of tree content + camera view ────────────────
  const world = useMemo(() => {
    const minX = Math.min(0, viewportInCanvas.left)  - 60;
    const maxX = Math.max(totalWidth, viewportInCanvas.right)  + 60;
    const minY = Math.min(0, viewportInCanvas.top)   - 60;
    const maxY = Math.max(totalHeight + NODE_H, viewportInCanvas.bottom) + 60;
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);

    const drawW = MAP_W - PAD * 2;
    const drawH = MAP_H - PAD * 2;
    // Keep aspect ratio – pick the smallest scale that fits both dimensions
    const s       = Math.min(drawW / w, drawH / h);
    const offsetX = PAD + (drawW - w * s) / 2;
    const offsetY = PAD + (drawH - h * s) / 2;

    return { minX, minY, w, h, s, offsetX, offsetY };
  }, [totalWidth, totalHeight, viewportInCanvas]);

  // ── Camera viewport rectangle in minimap SVG coords ───────────────────────
  const viewportBox = useMemo(() => {
    const rawX = world.offsetX + (viewportInCanvas.left  - world.minX) * world.s;
    const rawY = world.offsetY + (viewportInCanvas.top   - world.minY) * world.s;
    const rawW = viewportInCanvas.w * world.s;
    const rawH = viewportInCanvas.h * world.s;

    // Clamp so the box never escapes the SVG bounds
    const x = clamp(rawX, 0, MAP_W - 4);
    const y = clamp(rawY, 0, MAP_H - 4);
    const w = clamp(rawW, 6, MAP_W - x);
    const h = clamp(rawH, 6, MAP_H - y);
    return { x, y, w, h };
  }, [world, viewportInCanvas]);

  // ── Pan canvas to wherever the user clicks/drags on the minimap ───────────
  const panToPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect   = svg.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      // SVG px → world canvas coords
      const worldX = world.minX + (clickX - world.offsetX) / world.s;
      const worldY = world.minY + (clickY - world.offsetY) / world.s;

      onTransformChange(prev => ({
        ...prev,
        x: containerWidth  / 2 - worldX * prev.scale,
        y: containerHeight / 2 - worldY * prev.scale,
      }));
    },
    [world, containerWidth, containerHeight, onTransformChange],
  );

  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Don't handle clicks that originate from node <g> elements
    if ((e.target as SVGElement).closest("g")) return;
    e.stopPropagation();
    isDragging.current = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    panToPoint(e.clientX, e.clientY);
  };

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    panToPoint(e.clientX, e.clientY);
  };

  const onSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isDragging.current = false;
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  // ── Collapsed (pill) state ─────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        type="button"
        data-node
        onClick={onToggleOpen}
        title="Open Game Minimap"
        className={cn(
          "glass-panel flex items-center gap-1.5 rounded-xl border border-border/80 px-2.5 py-1.5",
          "text-xs font-semibold text-foreground/80 shadow-md backdrop-blur-md",
          "transition-all duration-200 hover:bg-surface-2 hover:text-foreground hover:scale-105 active:scale-95",
          className,
        )}
      >
        <Compass className="size-3.5 text-primary" />
        <span>Radar</span>
        <span className="flex size-4 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary">
          {nodes.length}
        </span>
      </button>
    );
  }

  // ── Full minimap panel ─────────────────────────────────────────────────────
  return (
    <div
      data-node
      className={cn(
        "glass-panel flex flex-col rounded-2xl border border-border/80 shadow-xl backdrop-blur-md select-none overflow-hidden",
        "transition-all duration-200",
        className,
      )}
      style={{ width: MAP_W + 16, padding: "6px" }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-1 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5">
          <Compass className="size-3.5 text-primary shrink-0" />
          <span className="text-[10px] font-extrabold tracking-widest text-primary">RADAR</span>
          <span className="rounded bg-secondary/80 px-1 text-[9px] font-medium text-muted-foreground tabular-nums">
            {nodes.length}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          {onFit && (
            <button
              type="button"
              data-node
              onClick={e => { e.stopPropagation(); onFit(); }}
              title="Fit whole tree in view"
              className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
            >
              <Maximize2 className="size-3" />
            </button>
          )}
          <button
            type="button"
            data-node
            onClick={e => { e.stopPropagation(); onToggleOpen(); }}
            title="Collapse radar"
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            <Minimize2 className="size-3" />
          </button>
        </div>
      </div>

      {/* ── SVG Radar ─────────────────────────────────────────────────────── */}
      <div
        className="relative rounded-lg overflow-hidden border border-border/50 bg-canvas/80 cursor-crosshair"
        style={{ width: MAP_W, height: MAP_H }}
      >
        <svg
          ref={svgRef}
          width={MAP_W}
          height={MAP_H}
          className="touch-none block absolute inset-0"
          onPointerDown={onSvgPointerDown}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerCancel={onSvgPointerUp}
        >
          {/* Grid lines */}
          <line x1={MAP_W / 2} y1={0} x2={MAP_W / 2} y2={MAP_H}
            stroke="var(--border)" strokeOpacity={0.22} strokeDasharray="2,4" />
          <line x1={0} y1={MAP_H / 2} x2={MAP_W} y2={MAP_H / 2}
            stroke="var(--border)" strokeOpacity={0.22} strokeDasharray="2,4" />

          {/* Edges */}
          {edges.map(e => {
            const x1 = world.offsetX + (e.from.x + NODE_W / 2 - world.minX) * world.s;
            const y1 = world.offsetY + (e.from.y + NODE_H      - world.minY) * world.s;
            const x2 = world.offsetX + (e.to.x   + NODE_W / 2 - world.minX) * world.s;
            const y2 = world.offsetY + (e.to.y                - world.minY) * world.s;
            const color =
              e.tone === "income"  ? "var(--income)"  :
              e.tone === "expense" ? "var(--expense)" :
              e.tone === "balance" ? "var(--balance)" :
              "var(--border-strong)";
            return (
              <line key={e.id}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color} strokeOpacity={0.38} strokeWidth={0.8} />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const nx     = world.offsetX + (node.x - world.minX) * world.s;
            const ny     = world.offsetY + (node.y - world.minY) * world.s;
            const nw     = Math.max(4, NODE_W * world.s);
            const nh     = Math.max(2.5, NODE_H * world.s);
            const active = node.id === activeId;
            const color  = getNodeColor(node);
            return (
              <g
                key={node.id}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={e => { e.stopPropagation(); onCenterOnNode?.(node); }}
              >
                <rect
                  x={nx} y={ny} width={nw} height={nh}
                  rx={Math.max(1, nh / 2.5)}
                  fill={color}
                  stroke={active ? "var(--primary)" : "rgba(255,255,255,0.35)"}
                  strokeWidth={active ? 1.5 : 0.4}
                  opacity={active ? 1 : 0.85}
                />
                {/* Pulse ring for active node */}
                {active && (
                  <circle
                    cx={nx + nw / 2} cy={ny + nh / 2}
                    r={Math.max(nh, 3.5)}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={1.2}
                    opacity={0.6}
                    className="animate-ping"
                    style={{ transformOrigin: `${nx + nw / 2}px ${ny + nh / 2}px` }}
                  />
                )}
              </g>
            );
          })}

          {/* Camera Viewport rect – drawn on top of everything, pointer-events none */}
          <rect
            x={viewportBox.x} y={viewportBox.y}
            width={viewportBox.w} height={viewportBox.h}
            rx={3}
            fill="var(--primary)" fillOpacity={0.12}
            stroke="var(--primary)" strokeWidth={1.6}
            strokeDasharray="none"
            pointerEvents="none"
            style={{ filter: "drop-shadow(0 0 3px var(--glow))" }}
          />
          {/* Crosshair dot */}
          <circle
            cx={viewportBox.x + viewportBox.w / 2}
            cy={viewportBox.y + viewportBox.h / 2}
            r={1.5}
            fill="var(--primary)"
            pointerEvents="none"
          />
        </svg>

        {/* Node tooltip – only when hovering */}
        {hoveredNode && (
          <div
            className={cn(
              "pointer-events-none absolute bottom-0.5 left-0.5 right-0.5",
              "rounded bg-surface/95 px-1.5 py-0.5 text-[9px] font-semibold text-foreground",
              "shadow-sm truncate backdrop-blur-sm border border-border/60",
            )}
          >
            <span className="mr-1" style={{ color: getNodeColor(hoveredNode) }}>●</span>
            {hoveredNode.label}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-1 flex items-center justify-between px-0.5 text-[9px] text-muted-foreground/70">
        <span>Click · drag to navigate</span>
        <Crosshair className="size-2.5 opacity-50 shrink-0" />
      </div>
    </div>
  );
}
