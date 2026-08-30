import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/money/calc";
import { NODE_H, NODE_W, layoutTree } from "@/lib/money/tree";
import type { Edge, PositionedNode, TreeNode } from "@/lib/money/tree";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

function nodeToneClasses(node: PositionedNode): string {
  switch (node.kind) {
    case "root":
      return "border-white/25 bg-[var(--node-root)] text-white";
    case "month":
    case "week":
    case "date":
    case "left":
      return "border-white/20 bg-[var(--node-primary)] text-white";
    case "income":
    case "spent":
    case "category":
      return "border-white/25 bg-[var(--node-standard)] text-white";
    case "transaction":
    case "forecast":
      return "border-[var(--node-secondary-text)]/10 bg-[var(--node-secondary)] text-[var(--node-secondary-text)]";
    default:
      return "border-border bg-surface text-foreground";
  }
}

function edgeStrokeColor(edge: Edge): string {
  switch (edge.to.kind) {
    case "root":
    case "month":
    case "week":
    case "date":
    case "left":
      return "var(--node-primary)";
    case "income":
    case "spent":
    case "category":
      return "var(--node-standard)";
    case "transaction":
    case "forecast":
      return "var(--node-secondary)";
    default:
      return "var(--node-edge)";
  }
}

export interface ContextAction {
  node: PositionedNode;
  x: number;
  y: number;
}

interface Props {
  root: TreeNode;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: PositionedNode) => void;
  selectedId?: string | null | undefined;
  highlightIds?: Set<string> | undefined;
  currency: string;
  onContextAction?: ((action: ContextAction) => void) | undefined;
  className?: string | undefined;
}

export function TreeCanvas({
  root,
  collapsed,
  onToggle,
  onSelect,
  selectedId,
  highlightIds,
  currency,
  onContextAction,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 40, scale: 0.85 });
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [hovered, setHovered] = useState<PositionedNode | null>(null);
  const [collapsedPanelOpen, setCollapsedPanelOpen] = useState(false);

  const { nodes, edges, width, height } = useMemo(
    () => layoutTree(root, collapsed),
    [root, collapsed],
  );

  const activeId = hovered?.id ?? selectedId ?? null;

  // Build lookup maps for parent and children relationships
  const { nodeMap, parentEdgeMap, childEdgesMap } = useMemo(() => {
    const nMap = new Map<string, PositionedNode>();
    for (const n of nodes) nMap.set(n.id, n);

    const pMap = new Map<string, Edge>();
    const cMap = new Map<string, Edge[]>();

    for (const e of edges) {
      pMap.set(e.to.id, e);
      const cur = cMap.get(e.from.id) ?? [];
      cur.push(e);
      cMap.set(e.from.id, cur);
    }
    return { nodeMap: nMap, parentEdgeMap: pMap, childEdgesMap: cMap };
  }, [nodes, edges]);

  // Compute active lineage path and illuminated edges
  const { activePathIds, activeEdgeIds, breadcrumbNodes } = useMemo(() => {
    const pathIds = new Set<string>();
    const edgeIds = new Set<string>();
    const crumbs: PositionedNode[] = [];

    if (!activeId) return { activePathIds: pathIds, activeEdgeIds: edgeIds, breadcrumbNodes: crumbs };

    let cursor: string | undefined = activeId;
    while (cursor) {
      pathIds.add(cursor);
      const n = nodeMap.get(cursor);
      if (n) crumbs.unshift(n);

      const e = parentEdgeMap.get(cursor);
      if (!e) break;
      edgeIds.add(e.id);
      cursor = e.from.id;
    }

    // Direct children edges of active node
    for (const e of edges) {
      if (e.from.id === activeId) edgeIds.add(e.id);
    }

    return { activePathIds: pathIds, activeEdgeIds: edgeIds, breadcrumbNodes: crumbs };
  }, [activeId, nodeMap, parentEdgeMap, edges]);

  // Active selected or hovered node details
  const activeNode = useMemo(() => {
    if (!activeId) return null;
    return nodeMap.get(activeId) ?? null;
  }, [activeId, nodeMap]);

  const activeParentNode = useMemo(() => {
    if (!activeId) return null;
    const parentEdge = parentEdgeMap.get(activeId);
    return parentEdge ? parentEdge.from : null;
  }, [activeId, parentEdgeMap]);

  const activeChildrenNodes = useMemo(() => {
    if (!activeId) return [];
    const childrenEdges = childEdgesMap.get(activeId) ?? [];
    return childrenEdges.map((e) => e.to);
  }, [activeId, childEdgesMap]);

  /** Center around root or a given scale smoothly. */
  const center = useCallback(
    (targetScale?: number) => {
      const el = containerRef.current;
      if (!el) return;
      const s = targetScale ?? (el.clientWidth < 720 ? 0.6 : 0.85);
      const rootNode = nodes.find((n) => n.id === "root");
      const rootX = rootNode ? rootNode.x + NODE_W / 2 : width / 2;
      setTransform({
        x: el.clientWidth / 2 - rootX * s,
        y: 48,
        scale: s,
      });
    },
    [nodes, width],
  );

  /** Smoothly centers the canvas on a given node with optional zoom level. */
  const centerOnNode = useCallback(
    (node: PositionedNode, overrideScale?: number) => {
      const el = containerRef.current;
      if (!el) return;
      setTransform((t) => {
        const s = overrideScale ?? t.scale;
        return {
          x: el.clientWidth / 2 - (node.x + NODE_W / 2) * s,
          y: Math.max(48, el.clientHeight / 3 - node.y * s),
          scale: s,
        };
      });
    },
    [],
  );

  /** Zoom into the center of the viewport or an arbitrary anchor coordinate. */
  const zoomAroundPoint = useCallback((targetScale: number, px?: number, py?: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const anchorX = px ?? rect.width / 2;
    const anchorY = py ?? rect.height / 2;
    const clamped = Math.min(2.4, Math.max(0.2, targetScale));

    setTransform((t) => {
      const ratio = clamped / t.scale;
      return {
        scale: clamped,
        x: anchorX - (anchorX - t.x) * ratio,
        y: anchorY - (anchorY - t.y) * ratio,
      };
    });
  }, []);

  const zoomStep = useCallback(
    (dir: 1 | -1) => {
      setTransform((t) => {
        const factor = dir === 1 ? 1.25 : 0.8;
        const next = Math.min(2.4, Math.max(0.2, t.scale * factor));
        const el = containerRef.current;
        if (!el) return { ...t, scale: next };
        const rect = el.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const ratio = next / t.scale;
        return {
          scale: next,
          x: cx - (cx - t.x) * ratio,
          y: cy - (cy - t.y) * ratio,
        };
      });
    },
    [],
  );

  const fitTree = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const idealScale = Math.min(1.3, Math.max(0.22, (el.clientWidth - 80) / Math.max(width, 1)));
    center(idealScale);
  }, [center, width]);

  /** Smooth Mouse Wheel & Trackpad Pinch-to-Zoom */
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      if (e.ctrlKey) {
        // Trackpad pinch-to-zoom gesture
        const next = Math.min(2.4, Math.max(0.2, transform.scale * (1 - e.deltaY * 0.01)));
        zoomAroundPoint(next, px, py);
        return;
      }

      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const next = Math.min(2.4, Math.max(0.2, transform.scale * Math.exp(-dy * 0.0018)));
      zoomAroundPoint(next, px, py);
    },
    [transform.scale, zoomAroundPoint],
  );

  const wheelRef = useRef(handleWheel);
  wheelRef.current = handleWheel;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const listener = (e: WheelEvent) => {
      e.preventDefault();
      wheelRef.current(e);
    };
    el.addEventListener("wheel", listener, { passive: false });
    return () => el.removeEventListener("wheel", listener);
  }, []);

  /** Keyboard Navigation between Parent, Children, and Siblings */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA" ||
          (document.activeElement as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomStep(1);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomStep(-1);
      } else if (e.key === "0" || e.key === "r" || e.key === "R") {
        e.preventDefault();
        center();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        fitTree();
      } else if (e.key === "ArrowUp") {
        // Jump to parent
        if (activeParentNode) {
          e.preventDefault();
          onSelect(activeParentNode);
          centerOnNode(activeParentNode);
        }
      } else if (e.key === "ArrowDown") {
        // Jump to first child
        if (activeChildrenNodes.length > 0) {
          e.preventDefault();
          const firstChild = activeChildrenNodes[0]!;
          onSelect(firstChild);
          centerOnNode(firstChild);
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        // Sibling navigation
        if (activeParentNode) {
          const siblings = childEdgesMap.get(activeParentNode.id)?.map((e) => e.to) ?? [];
          const currentIndex = siblings.findIndex((s) => s.id === activeId);
          if (currentIndex !== -1) {
            e.preventDefault();
            const nextIndex =
              e.key === "ArrowLeft"
                ? Math.max(0, currentIndex - 1)
                : Math.min(siblings.length - 1, currentIndex + 1);
            const targetSibling = siblings[nextIndex];
            if (targetSibling && targetSibling.id !== activeId) {
              onSelect(targetSibling);
              centerOnNode(targetSibling);
            }
          }
        }
      } else if (e.key === "Enter" || e.key === " ") {
        if (activeNode && activeNode.hasChildren) {
          e.preventDefault();
          onToggle(activeNode.id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeId,
    activeNode,
    activeParentNode,
    activeChildrenNodes,
    childEdgesMap,
    center,
    fitTree,
    centerOnNode,
    onSelect,
    onToggle,
    zoomStep,
  ]);

  useEffect(() => {
    center();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root.id]);

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = drag.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    setTransform((t) => ({ ...t, x: start.tx + dx, y: start.ty + dy }));
  }

  function onPointerUp() {
    drag.current = null;
    setIsDragging(false);
  }

  /** Collapsed nodes visible in current layout */
  const collapsedNodes = useMemo(
    () => nodes.filter((n) => n.collapsed && n.hasChildren),
    [nodes],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "canvas-grain relative touch-none overflow-hidden rounded-3xl shadow-[var(--shadow-node)] select-none",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* ── Top Floating Breadcrumb & Hierarchy Navigator ── */}
      {breadcrumbNodes.length > 1 && (
        <div className="glass-panel absolute top-4 left-4 z-20 flex max-w-[calc(100%-120px)] flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2 text-xs shadow-lg backdrop-blur-md transition-all duration-300">
          <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Path:
          </span>
          <div className="flex flex-wrap items-center gap-1 overflow-x-auto">
            {breadcrumbNodes.map((crumb, idx) => {
              const isLast = idx === breadcrumbNodes.length - 1;
              return (
                <div key={crumb.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    data-node
                    onClick={() => {
                      // If any parent was collapsed, expand it
                      if (collapsed.has(crumb.id)) onToggle(crumb.id);
                      onSelect(crumb);
                      centerOnNode(crumb);
                    }}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all duration-200",
                      isLast
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-surface-2/80 text-foreground hover:bg-primary/20 hover:text-primary",
                    )}
                  >
                    {crumb.icon && <span className="text-xs">{crumb.icon}</span>}
                    <span className="max-w-[110px] truncate">{crumb.label}</span>
                  </button>
                  {!isLast && <ChevronRight className="size-3.5 text-muted-foreground/60" />}
                </div>
              );
            })}
          </div>

          {/* Quick Jump to Parent button */}
          {activeParentNode && (
            <button
              type="button"
              data-node
              onClick={() => {
                onSelect(activeParentNode);
                centerOnNode(activeParentNode);
              }}
              title="Jump to Parent [↑]"
              className="ml-1 flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <ArrowUp className="size-3" />
              <span className="hidden sm:inline">Parent</span>
            </button>
          )}

          {/* Quick Jump to First Child button */}
          {activeChildrenNodes.length > 0 && (
            <button
              type="button"
              data-node
              onClick={() => {
                const firstChild = activeChildrenNodes[0]!;
                onSelect(firstChild);
                centerOnNode(firstChild);
              }}
              title="Jump to Child [↓]"
              className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <ArrowDown className="size-3" />
              <span className="hidden sm:inline">Child ({activeChildrenNodes.length})</span>
            </button>
          )}

          <button
            type="button"
            data-node
            onClick={() => {
              setHovered(null);
              // reset focus
            }}
            title="Clear focus"
            className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* ── Main Canvas Transformation Layer ── */}
      <div
        className={cn(
          "absolute top-0 left-0 origin-top-left",
          isDragging ? "canvas-stage-instant" : "canvas-stage-smooth",
        )}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          width,
          height: height + NODE_H,
        }}
      >
        {/* SVG Bézier Connection Curves */}
        <svg
          className="pointer-events-none absolute top-0 left-0 overflow-visible"
          width={width}
          height={height + NODE_H}
        >
          {[...edges]
            .sort(
              (a, b) =>
                Number(activeEdgeIds.has(a.id)) - Number(activeEdgeIds.has(b.id)),
            )
            .map((edge) => {
              const x1 = edge.from.x + NODE_W / 2;
              const y1 = edge.from.y + NODE_H;
              const x2 = edge.to.x + NODE_W / 2;
              const y2 = edge.to.y;
              const mid = (y1 + y2) / 2;
              const onPath = activeEdgeIds.has(edge.id);
              const faded = Boolean(activeId) && !onPath;
              return (
                <path
                  key={edge.id}
                  d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                  fill="none"
                  stroke={onPath ? "var(--primary)" : edgeStrokeColor(edge)}
                  strokeOpacity={onPath ? 1 : faded ? 0.16 : 0.62}
                  strokeWidth={onPath ? 4.5 : 2.8}
                  strokeLinecap="round"
                  className={cn(
                    "transition-all duration-300",
                    edge.dashed && "flow-line",
                  )}
                  style={
                    onPath
                      ? { filter: "drop-shadow(0 0 8px var(--glow))" }
                      : undefined
                  }
                />
              );
            })}
        </svg>

        {/* Tree Nodes */}
        {nodes.map((node) => {
          const dimmed = highlightIds && highlightIds.size > 0 && !highlightIds.has(node.id);
          const onPath = activePathIds.has(node.id);
          const isHovered = hovered?.id === node.id;
          const isSelected = selectedId === node.id;
          const muted = Boolean(activeId) && !onPath;

          return (
            <div
              key={node.id}
              data-node
              className="absolute transition-all duration-300"
              style={{ left: node.x, top: node.y, width: NODE_W, zIndex: onPath ? 10 : 2 }}
            >
              <button
                type="button"
                onClick={() => {
                  onSelect(node);
                  centerOnNode(node);
                }}
                onDoubleClick={() => {
                  if (node.hasChildren) {
                    onToggle(node.id);
                  }
                  centerOnNode(node, Math.max(transform.scale, 1.05));
                }}
                onMouseEnter={() => setHovered(node)}
                onMouseLeave={() => setHovered((h) => (h?.id === node.id ? null : h))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onContextAction?.({ node, x: e.clientX, y: e.clientY });
                }}
                className={cn(
                  "animate-grow-in group relative w-full rounded-[22px] border-[1.5px] px-4 py-3 text-left shadow-[var(--shadow-node)] transition-all duration-200 cursor-pointer",
                  nodeToneClasses(node),
                  onPath &&
                    !isSelected &&
                    !isHovered &&
                    "ring-2 ring-primary/60 ring-offset-2 ring-offset-canvas shadow-[0_0_15px_var(--glow)]",
                  isHovered &&
                    "-translate-y-1.5 scale-[1.03] ring-2 ring-primary/90 ring-offset-2 ring-offset-canvas shadow-[var(--shadow-glow)]",
                  isSelected &&
                    "ring-[3px] ring-primary ring-offset-2 ring-offset-canvas shadow-[0_20px_45px_-12px_var(--glow)]",
                  dimmed
                    ? "opacity-20"
                    : muted
                      ? "opacity-50 saturate-60"
                      : "hover:-translate-y-1 hover:shadow-[var(--shadow-glow)]",
                )}
                style={{ height: NODE_H }}
              >
                <div className="flex items-center justify-between gap-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase opacity-90">
                  <div className="flex min-w-0 items-center gap-1.5 truncate">
                    {node.icon && <span className="text-xs">{node.icon}</span>}
                    <span className="truncate">{node.label}</span>
                  </div>
                  {isSelected && (
                    <span className="flex size-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>

                <div className="stat-figure mt-1 truncate text-[17px] leading-tight">
                  {formatMoney(node.amount, currency)}
                </div>

                {node.balanceBefore !== undefined && node.balanceAfter !== undefined && (
                  <div className="mt-1 grid grid-cols-2 gap-1 border-t border-current/20 pt-1.5">
                    <div className="flex min-w-0 flex-col">
                      <span className="text-[9px] uppercase tracking-wider opacity-60">Before</span>
                      <span className="num truncate text-[11px] font-semibold opacity-90">
                        {formatMoney(node.balanceBefore, currency)}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col items-end">
                      <span className="text-[9px] uppercase tracking-wider opacity-60">After</span>
                      <span className="num truncate text-[11px] font-semibold">
                        {formatMoney(node.balanceAfter, currency)}
                      </span>
                    </div>
                  </div>
                )}

                {node.sublabel && (
                  <div className="truncate text-[10px] opacity-70">{node.sublabel}</div>
                )}
              </button>

              {/* Expand / Collapse Button with Glow Indicator */}
              {node.hasChildren && (
                <button
                  type="button"
                  data-node
                  onClick={() => {
                    onToggle(node.id);
                    if (!node.collapsed) {
                      setTimeout(() => centerOnNode(node), 40);
                    }
                  }}
                  aria-label={node.collapsed ? "Expand branch" : "Collapse branch"}
                  title={node.collapsed ? "Click to expand branch" : "Click to collapse branch"}
                  className={cn(
                    "absolute -bottom-3.5 left-1/2 z-20 flex h-7 min-w-7 -translate-x-1/2 items-center justify-center gap-0.5 rounded-full border px-2 text-[10px] font-bold shadow-[var(--shadow-node)] transition-all duration-200 cursor-pointer hover:scale-110",
                    node.collapsed
                      ? "border-primary bg-primary text-primary-foreground scale-110 shadow-[0_0_14px_var(--glow)] animate-pulse"
                      : "border-border bg-surface text-muted-foreground hover:bg-secondary hover:text-primary",
                  )}
                >
                  {node.collapsed ? (
                    <>
                      <span className="text-[11px] leading-none">+</span>
                      <span>{node.children.length}</span>
                    </>
                  ) : (
                    "−"
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Hover Node Details Floating Mini-Card ── */}
      {hovered && !selectedId && (
        <div className="glass-panel pointer-events-none absolute top-4 left-4 max-w-[280px] rounded-2xl px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md transition-all">
          <div className="flex items-center gap-1.5 font-semibold">
            {hovered.icon && <span>{hovered.icon}</span>}
            <span>{hovered.label}</span>
          </div>
          <div className="stat-figure mt-0.5 text-sm">{formatMoney(hovered.amount, currency)}</div>

          {hovered.balanceBefore !== undefined && hovered.balanceAfter !== undefined && (
            <div className="mt-1.5 flex items-center gap-2 border-t border-border/40 pt-1.5">
              <div className="flex flex-col">
                <span className="text-[9px] tracking-wider text-muted-foreground uppercase">Before</span>
                <span className="num text-[11px] font-semibold">
                  {formatMoney(hovered.balanceBefore, currency)}
                </span>
              </div>
              <ArrowRight className="size-3 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-[9px] tracking-wider text-muted-foreground uppercase">After</span>
                <span className="num text-[11px] font-semibold">
                  {formatMoney(hovered.balanceAfter, currency)}
                </span>
              </div>
            </div>
          )}

          <div className="mt-1 text-[10px] text-muted-foreground">
            {hovered.hasChildren
              ? `${hovered.children.length} branches · double-click to ${hovered.collapsed ? "expand" : "collapse"}`
              : "click to inspect node"}
          </div>
        </div>
      )}

      {/* ── Collapsed Branches Finder Panel ── */}
      {collapsedNodes.length > 0 && (
        <div className="glass-panel absolute top-4 right-4 z-20 w-56 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md">
          <button
            type="button"
            data-node
            onClick={() => setCollapsedPanelOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-surface-2 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {collapsedNodes.length}
              </span>
              Collapsed branches
            </span>
            {collapsedPanelOpen ? (
              <ChevronUp className="size-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-3 text-muted-foreground" />
            )}
          </button>
          {collapsedPanelOpen && (
            <ul className="max-h-60 overflow-y-auto border-t border-border">
              {collapsedNodes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    data-node
                    onClick={() => {
                      onToggle(n.id);
                      centerOnNode(n);
                      onSelect(n);
                      setCollapsedPanelOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-2 transition-colors"
                  >
                    <span className="shrink-0 text-sm">{n.icon ?? "📦"}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{n.label}</span>
                    <span className="num shrink-0 text-[10px] font-bold text-primary">
                      +{n.children.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Smooth Zoom & Canvas Navigation Toolbar ── */}
      <div className="glass-panel absolute right-4 bottom-4 z-20 flex items-center gap-1 rounded-2xl p-1.5 shadow-xl backdrop-blur-md">
        {/* Zoom Out Button */}
        <IconBtn onClick={() => zoomStep(-1)} label="Zoom out (-)">
          <Minus className="size-4" />
        </IconBtn>

        {/* Zoom Level Popover & Slider */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-node
              title="Click to adjust zoom slider & presets"
              className="num flex h-8 min-w-12 items-center justify-center rounded-lg px-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-surface-2"
            >
              {Math.round(transform.scale * 100)}%
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3 p-3 text-xs" align="end" side="top">
            <div className="flex items-center justify-between font-semibold">
              <span>Zoom Scale</span>
              <span className="num text-primary">{Math.round(transform.scale * 100)}%</span>
            </div>

            <Slider
              value={[Math.round(transform.scale * 100)]}
              min={25}
              max={220}
              step={5}
              onValueChange={([val]) => {
                if (val) zoomAroundPoint(val / 100);
              }}
              className="my-2"
            />

            <div className="grid grid-cols-4 gap-1 pt-1">
              {[50, 75, 100, 150].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => zoomAroundPoint(pct / 100)}
                  className={cn(
                    "rounded-lg py-1 text-[11px] font-medium transition-colors",
                    Math.round(transform.scale * 100) === pct
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-2 hover:bg-surface-2/80 text-foreground",
                  )}
                >
                  {pct}%
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 border-t border-border pt-2">
              <button
                type="button"
                onClick={() => {
                  center();
                }}
                className="flex-1 rounded-lg bg-surface-2 py-1 text-[11px] font-medium hover:bg-surface-2/80"
              >
                Reset Root
              </button>
              <button
                type="button"
                onClick={() => {
                  fitTree();
                }}
                className="flex-1 rounded-lg bg-surface-2 py-1 text-[11px] font-medium hover:bg-surface-2/80"
              >
                Fit All
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Zoom In Button */}
        <IconBtn onClick={() => zoomStep(1)} label="Zoom in (+)">
          <Plus className="size-4" />
        </IconBtn>

        <div className="mx-0.5 h-4 w-px bg-border" />

        {/* Recenter to Root */}
        <IconBtn onClick={() => center()} label="Recenter to root [R]">
          <RotateCcw className="size-4" />
        </IconBtn>

        {/* Fit Whole Tree */}
        <IconBtn onClick={fitTree} label="Fit whole tree [F]">
          <Maximize2 className="size-4" />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-node
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-surface-2 hover:text-foreground hover:scale-105 active:scale-95"
    >
      {children}
    </button>
  );
}
