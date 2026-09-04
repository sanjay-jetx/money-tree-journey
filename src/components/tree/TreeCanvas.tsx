import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Compass,
  FoldVertical,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  UnfoldVertical,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/money/calc";
import { NODE_H, NODE_W, layoutTree } from "@/lib/money/tree";
import type { Edge, PositionedNode, TreeNode } from "@/lib/money/tree";
import { cn } from "@/lib/utils";
import { Minimap } from "./Minimap";

function nodeToneClasses(node: PositionedNode): string {
  switch (node.kind) {
    case "root":
      return "border-primary/60 bg-[var(--node-root)] text-white shadow-[0_10px_25px_-5px_var(--glow)] ring-1 ring-primary/40";
    case "month":
      return "border-primary/40 bg-[var(--node-primary)] text-white shadow-md ring-1 ring-primary/25";
    case "week":
      return "border-white/20 bg-[var(--node-standard)] text-white shadow-sm";
    case "date":
      return "border-border-strong bg-surface text-foreground shadow-sm hover:border-primary/70";
    case "income":
      return "border-income/50 bg-income text-white shadow-[0_6px_20px_-6px_rgba(63,107,63,0.4)]";
    case "spent":
      return "border-expense/50 bg-expense text-white shadow-[0_6px_20px_-6px_rgba(180,72,47,0.4)]";
    case "left":
      return "border-balance/50 bg-balance text-white shadow-[0_6px_20px_-6px_rgba(60,95,110,0.4)]";
    case "category":
      if (node.tone === "income") {
        return "border-income/40 bg-surface-2 text-foreground hover:border-income";
      }
      return "border-expense/40 bg-surface-2 text-foreground hover:border-expense";
    case "transaction":
      if (node.tone === "income") {
        return "border-income/30 bg-income-soft text-foreground hover:border-income/60";
      }
      return "border-expense/30 bg-expense-soft text-foreground hover:border-expense/60";
    case "investment":
      return "border-pending/40 bg-pending-soft text-pending";
    case "forecast":
      return "border-dashed border-forecast/60 bg-forecast/15 text-forecast";
    default:
      return "border-border bg-surface text-foreground";
  }
}

function edgeStrokeColor(edge: Edge): string {
  if (edge.to.tone === "income" || edge.to.kind === "income") return "var(--income)";
  if (edge.to.tone === "expense" || edge.to.kind === "spent") return "var(--expense)";
  if (edge.to.tone === "balance" || edge.to.kind === "left") return "var(--balance)";
  if (edge.to.kind === "forecast") return "var(--forecast)";
  if (edge.to.kind === "investment") return "var(--pending)";
  if (edge.to.kind === "month") return "var(--primary)";
  if (edge.to.kind === "week") return "var(--border-strong)";
  return "var(--node-edge)";
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
  onAddNode?: ((node: PositionedNode) => void) | undefined;
  onDeleteNode?: ((node: PositionedNode) => void) | undefined;
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
  onAddNode,
  onDeleteNode,
  selectedId,
  highlightIds,
  currency,
  onContextAction,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 40, scale: 0.85 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [hovered, setHovered] = useState<PositionedNode | null>(null);

  // Container dimensions for minimap & viewport calculations
  const [containerDims, setContainerDims] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateDims = () => {
      setContainerDims({ width: el.clientWidth, height: el.clientHeight });
    };
    updateDims();
    const ro = new ResizeObserver(updateDims);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [minimapOpen, setMinimapOpen] = useState(true);
  const [recentlyToggledId, setRecentlyToggledId] = useState<string | null>(null);
  const pendingAnchorRef = useRef<{
    id: string;
    screenX: number;
    screenY: number;
    scale: number;
  } | null>(null);

  const { nodes, edges, width, height } = useMemo(
    () => layoutTree(root, collapsed),
    [root, collapsed],
  );

  const activeId = hovered?.id ?? selectedId ?? null;

  const { activePathIds, activeEdgeIds } = useMemo(() => {
    const pathIds = new Set<string>();
    const edgeIds = new Set<string>();
    if (!activeId) return { activePathIds: pathIds, activeEdgeIds: edgeIds };
    const parentEdge = new Map<string, Edge>();
    for (const e of edges) parentEdge.set(e.to.id, e);
    let cursor: string | undefined = activeId;
    while (cursor) {
      pathIds.add(cursor);
      const e = parentEdge.get(cursor);
      if (!e) break;
      edgeIds.add(e.id);
      cursor = e.from.id;
    }
    // include edges to the active node's direct children for context
    for (const e of edges) if (e.from.id === activeId) edgeIds.add(e.id);
    return { activePathIds: pathIds, activeEdgeIds: edgeIds };
  }, [activeId, edges]);

  const center = useCallback(
    (scale?: number) => {
      const el = containerRef.current;
      if (!el) return;
      const s = scale ?? (el.clientWidth < 720 ? 0.6 : 0.85);
      const rootNode = nodes.find((n) => n.id === "root");
      const rootX = rootNode ? rootNode.x + NODE_W / 2 : width / 2;
      setTransform({ x: el.clientWidth / 2 - rootX * s, y: 48, scale: s });
    },
    [nodes, width],
  );

  /** Smoothly snaps canvas so the given node appears centered and highlighted. */
  const centerOnNode = useCallback(
    (node: PositionedNode) => {
      const el = containerRef.current;
      if (!el) return;
      setRecentlyToggledId(node.id);
      setTransform((t) => ({
        ...t,
        x: el.clientWidth / 2 - (node.x + NODE_W / 2) * t.scale,
        y: Math.max(48, el.clientHeight / 3 - node.y * t.scale),
      }));
    },
    [],
  );

  /**
   * Toggles branch collapse/expand while anchoring the node to stay in the exact
   * same screen position or cleanly centered within the visible viewport!
   * We capture scale in a ref to avoid stale closure issues inside the layout effect.
   */
  const scaleRef = useRef(transform.scale);
  scaleRef.current = transform.scale;

  const handleToggleNode = useCallback(
    (nodeId: string) => {
      const el = containerRef.current;
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (el && targetNode) {
        const s = scaleRef.current;
        const screenX = transform.x + (targetNode.x + NODE_W / 2) * s;
        const screenY = transform.y + (targetNode.y + NODE_H / 2) * s;
        pendingAnchorRef.current = { id: nodeId, screenX, screenY, scale: s };
      }
      setRecentlyToggledId(nodeId);
      onToggle(nodeId);
    },
    [nodes, transform.x, transform.y, onToggle],
  );

  // Clear recently toggled pulse after 2 seconds
  useEffect(() => {
    if (!recentlyToggledId) return;
    const timer = setTimeout(() => setRecentlyToggledId(null), 2000);
    return () => clearTimeout(timer);
  }, [recentlyToggledId]);

  // Keep toggled node anchored in view after tree layout recalculates!
  useEffect(() => {
    if (!pendingAnchorRef.current) return;
    const { id, screenX, screenY, scale } = pendingAnchorRef.current;
    pendingAnchorRef.current = null;
    const el = containerRef.current;
    if (!el) return;

    const newNode = nodes.find((n) => n.id === id);
    if (!newNode) return;

    const viewW = el.clientWidth;
    const viewH = el.clientHeight;

    // Attempt to keep node at same screen position
    let targetTx = screenX - (newNode.x + NODE_W / 2) * scale;
    let targetTy = screenY - (newNode.y + NODE_H / 2) * scale;

    // Safety: if target would put node out of comfortable view, re-center on it
    const finalSx = targetTx + (newNode.x + NODE_W / 2) * scale;
    const finalSy = targetTy + (newNode.y + NODE_H / 2) * scale;
    if (finalSx < 80 || finalSx > viewW - 80) {
      targetTx = viewW / 2 - (newNode.x + NODE_W / 2) * scale;
    }
    if (finalSy < 60 || finalSy > viewH - 100) {
      targetTy = Math.max(48, Math.min(viewH * 0.35, viewH / 3 - newNode.y * scale));
    }

    setTransform((prev) => ({ ...prev, x: targetTx, y: targetTy }));
  // Only re-run when the nodes array identity changes (after layout recalculates)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  /** All currently-collapsed nodes that have children (visible in layout). */
  const collapsedNodes = useMemo(
    () => nodes.filter((n) => n.collapsed && n.hasChildren),
    [nodes],
  );
  const [collapsedPanelOpen, setCollapsedPanelOpen] = useState(false);

  useEffect(() => {
    center();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root.id]);

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
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
  }

  const handleWheel = useCallback((e: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    setTransform((t) => {
      const next = Math.min(2.2, Math.max(0.25, t.scale * Math.exp(-dy * 0.0015)));
      const ratio = next / t.scale;
      return { scale: next, x: px - (px - t.x) * ratio, y: py - (py - t.y) * ratio };
    });
  }, []);

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

  function zoom(dir: 1 | -1) {
    setTransform((t) => ({
      ...t,
      scale: Math.min(2.2, Math.max(0.25, t.scale * (dir === 1 ? 1.15 : 0.87))),
    }));
  }

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
      {/* ── Tree Structure Guide Bar ── */}
      <div className="glass-panel pointer-events-none absolute top-3.5 left-3.5 z-20 hidden md:flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-xs">
        <span className="font-semibold text-foreground flex items-center gap-1">
          <span>🌳</span> Hierarchy:
        </span>
        <span className="text-foreground/80">Period</span>
        <span className="text-muted-foreground/50">→</span>
        <span className="text-foreground/80">Month</span>
        <span className="text-muted-foreground/50">→</span>
        <span className="text-foreground/80">Week</span>
        <span className="text-muted-foreground/50">→</span>
        <span className="text-foreground/80">Day</span>
        <span className="text-muted-foreground/50">→</span>
        <span className="text-income font-semibold">Received</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-expense font-semibold">Spent</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-balance font-semibold">Left</span>
      </div>

      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          width,
          height: height + NODE_H,
        }}
      >
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
                  strokeWidth={onPath ? 4.4 : 2.8}
                  strokeLinecap="round"
                  className={cn(
                    "transition-all duration-200",
                    edge.dashed && "flow-line",
                  )}
                  style={
                    onPath
                      ? { filter: "drop-shadow(0 0 6px var(--glow))" }
                      : undefined
                  }
                />
              );
            })}

        </svg>

        {nodes.map((node) => {
          const dimmed = highlightIds && highlightIds.size > 0 && !highlightIds.has(node.id);
          const onPath = activePathIds.has(node.id);
          const isHovered = hovered?.id === node.id;
          const isSelected = selectedId === node.id;
          const isRecentlyToggled = recentlyToggledId === node.id;
          const muted = Boolean(activeId) && !onPath;
          return (
            <div
              key={node.id}
              data-node
              className="absolute"
              style={{ left: node.x, top: node.y, width: NODE_W, zIndex: onPath || isRecentlyToggled ? 5 : 1 }}
            >
              <button
                type="button"
                onClick={() => onSelect(node)}
                onDoubleClick={() => node.hasChildren && handleToggleNode(node.id)}
                onMouseEnter={() => setHovered(node)}
                onMouseLeave={() => setHovered((h) => (h?.id === node.id ? null : h))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onContextAction?.({ node, x: e.clientX, y: e.clientY });
                }}
                className={cn(
                  "animate-grow-in w-full rounded-[20px] border-[1.5px] px-4 py-3 text-left shadow-[var(--shadow-node)] transition-all duration-200",
                  nodeToneClasses(node),
                  onPath && !isSelected && !isHovered && "ring-2 ring-primary/55 ring-offset-2 ring-offset-canvas",
                  isHovered &&
                  "-translate-y-1.5 scale-[1.03] ring-2 ring-primary/80 ring-offset-2 ring-offset-canvas shadow-[var(--shadow-glow)]",
                  isSelected &&
                  "ring-[3px] ring-primary ring-offset-2 ring-offset-canvas shadow-[0_18px_40px_-14px_var(--glow)]",
                  isRecentlyToggled &&
                  "ring-[3.5px] ring-primary ring-offset-2 ring-offset-canvas shadow-[0_0_24px_var(--glow)] scale-[1.02]",
                  dimmed
                    ? "opacity-20"
                    : muted
                      ? "opacity-45 saturate-50"
                      : "hover:-translate-y-1 hover:shadow-[var(--shadow-glow)]",
                )}
                style={{ height: NODE_H }}

              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase opacity-90">
                  {node.icon && <span className="text-xs">{node.icon}</span>}
                  <span className="truncate">{node.label}</span>
                </div>
                <div className="stat-figure mt-1 truncate text-[17px] leading-tight font-bold">
                  {node.kind === "income" || (node.kind === "transaction" && node.tone === "income") ? "+" : ""}
                  {node.kind === "spent" || (node.kind === "transaction" && node.tone === "expense") ? "−" : ""}
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

                {/* Quick Add Node button */}
                {onAddNode && node.kind !== "forecast" && node.kind !== "transaction" && (
                  <span
                    data-node
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddNode(node);
                    }}
                    title="Add entry under this node"
                    className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-current shadow-xs transition-all hover:scale-110 active:scale-95 z-10 cursor-pointer"
                  >
                    <Plus className="size-3" />
                  </span>
                )}

                {/* Quick Delete Node button for transactions */}
                {onDeleteNode && node.kind === "transaction" && node.txId && (
                  <span
                    data-node
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNode(node);
                    }}
                    title="Remove this node from tree"
                    className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-destructive/80 hover:bg-destructive text-white shadow-xs transition-all hover:scale-110 active:scale-95 z-10 cursor-pointer"
                  >
                    <Trash2 className="size-3" />
                  </span>
                )}

              </button>

              {node.hasChildren && (
                <button
                  type="button"
                  data-node
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleNode(node.id);
                  }}
                  aria-label={node.collapsed ? "Expand branch" : "Collapse branch"}
                  className={cn(
                    "absolute -bottom-3.5 left-1/2 z-10 flex h-7 min-w-7 -translate-x-1/2 items-center justify-center gap-0.5 rounded-full border px-2 text-[10px] font-bold shadow-[var(--shadow-node)] transition-all duration-200",
                    node.collapsed
                      ? "border-primary bg-primary text-primary-foreground scale-110 shadow-[0_0_12px_var(--glow)] animate-pulse"
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

      {hovered && (
        <div className="glass-panel pointer-events-none absolute top-14 left-3.5 max-w-[220px] rounded-xl px-3 py-2 text-xs z-30 shadow-lg">
          <div className="font-semibold truncate">{hovered.label}</div>
          <div className="num text-sm font-bold mt-0.5">{formatMoney(hovered.amount, currency)}</div>
          {hovered.balanceBefore !== undefined && hovered.balanceAfter !== undefined && (
            <div className="mt-1.5 flex items-center gap-2 border-t border-border/40 pt-1.5">
              <div className="flex flex-col">
                <span className="text-[9px] tracking-wider text-muted-foreground uppercase">Before</span>
                <span className="num text-[11px] font-semibold">
                  {formatMoney(hovered.balanceBefore, currency)}
                </span>
              </div>
              <ArrowRight className="size-3 text-muted-foreground shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] tracking-wider text-muted-foreground uppercase">After</span>
                <span className="num text-[11px] font-semibold">
                  {formatMoney(hovered.balanceAfter, currency)}
                </span>
              </div>
            </div>
          )}
          <div className="mt-1 text-muted-foreground text-[10px]">
            {hovered.hasChildren
              ? `${hovered.children.length} children · double-click to ${hovered.collapsed ? "expand" : "collapse"}`
              : "click for details"}
          </div>
        </div>
      )}


      {/* ── Collapsed branches panel ── */}
      {collapsedNodes.length > 0 && (
        <div className="glass-panel absolute top-4 right-4 z-20 w-52 rounded-2xl overflow-hidden">
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
            {collapsedPanelOpen
              ? <ChevronUp className="size-3 text-muted-foreground" />
              : <ChevronDown className="size-3 text-muted-foreground" />}
          </button>
          {collapsedPanelOpen && (
            <ul className="border-t border-border">
              {collapsedNodes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    data-node
                    onClick={() => {
                      centerOnNode(n);
                      setCollapsedPanelOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-2 transition-colors"
                  >
                    <span className="shrink-0 text-sm">{n.icon ?? "📦"}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{n.label}</span>
                    <span className="num shrink-0 text-[10px] text-muted-foreground">
                      +{n.children.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Game Minimap / Radar ── */}
      <Minimap
        nodes={nodes}
        edges={edges}
        totalWidth={width}
        totalHeight={height}
        transform={transform}
        onTransformChange={setTransform}
        containerWidth={containerDims.width}
        containerHeight={containerDims.height}
        activeId={activeId}
        onCenterOnNode={centerOnNode}
        onFit={() => {
          const el = containerRef.current;
          if (!el) return;
          center(Math.min(1.4, Math.max(0.22, (el.clientWidth - 80) / Math.max(width, 1))));
        }}
        isOpen={minimapOpen}
        onToggleOpen={() => setMinimapOpen((o) => !o)}
        className="absolute right-4 bottom-20 z-20"
      />

      <div className="glass-panel absolute right-4 bottom-4 flex items-center gap-1 rounded-xl p-1 z-20 shadow-sm">
        <IconBtn
          onClick={() => {
            if (collapsed.size === 0) {
              // Collapse to high level: collapse all with children except root
              const toCollapse: string[] = [];
              function walk(n: TreeNode) {
                if (n.children.length > 0 && n.id !== "root") toCollapse.push(n.id);
                n.children.forEach(walk);
              }
              walk(root);
              toCollapse.forEach((id) => onToggle(id));
            } else {
              // Expand all: toggle every collapsed node
              Array.from(collapsed).forEach((id) => onToggle(id));
            }
            setTimeout(() => center(), 60);
          }}
          label={collapsed.size === 0 ? "Collapse branches" : "Expand all branches"}
        >
          {collapsed.size === 0 ? (
            <FoldVertical className="size-4" />
          ) : (
            <UnfoldVertical className="size-4" />
          )}
        </IconBtn>
        <div className="h-4 w-px bg-border/80 mx-0.5" />
        <IconBtn
          onClick={() => setMinimapOpen((o) => !o)}
          label={minimapOpen ? "Hide minimap radar" : "Show minimap radar"}
        >
          <Compass
            className={cn(
              "size-4 transition-colors",
              minimapOpen ? "text-primary" : "text-muted-foreground",
            )}
          />
        </IconBtn>
        <div className="h-4 w-px bg-border/80 mx-0.5" />
        <IconBtn onClick={() => zoom(-1)} label="Zoom out">
          <Minus className="size-4" />
        </IconBtn>
        <span className="num w-10 text-center text-[11px] text-muted-foreground">
          {Math.round(transform.scale * 100)}%
        </span>
        <IconBtn onClick={() => zoom(1)} label="Zoom in">
          <Plus className="size-4" />
        </IconBtn>
        <IconBtn onClick={() => center()} label="Recenter to root">
          <RotateCcw className="size-4" />
        </IconBtn>
        <IconBtn
          onClick={() => {
            const el = containerRef.current;
            if (!el) return;
            center(Math.min(1.4, Math.max(0.22, (el.clientWidth - 80) / Math.max(width, 1))));
          }}
          label="Fit whole tree"
        >
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
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      {children}
    </button>
  );
}
