import { ArrowRight, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/money/calc";
import { NODE_H, NODE_W, layoutTree } from "@/lib/money/tree";
import type { Edge, PositionedNode, TreeNode } from "@/lib/money/tree";
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
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [hovered, setHovered] = useState<PositionedNode | null>(null);

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
          const muted = Boolean(activeId) && !onPath;
          return (
            <div
              key={node.id}
              data-node
              className="absolute"
              style={{ left: node.x, top: node.y, width: NODE_W, zIndex: onPath ? 5 : 1 }}
            >
              <button
                type="button"
                onClick={() => onSelect(node)}
                onDoubleClick={() => node.hasChildren && onToggle(node.id)}
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

              {node.hasChildren && (
                <button
                  type="button"
                  data-node
                  onClick={() => onToggle(node.id)}
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
        <div className="glass-panel pointer-events-none absolute top-4 left-4 max-w-[260px] rounded-xl px-3 py-2 text-xs">
          <div className="font-semibold">{hovered.label}</div>
          <div className="num text-sm">{formatMoney(hovered.amount, currency)}</div>
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
          <div className="mt-1 text-muted-foreground">
            {hovered.hasChildren
              ? `${hovered.children.length} branches · double-click to ${hovered.collapsed ? "expand" : "collapse"}`
              : "click for details"}
          </div>
        </div>
      )}


      <div className="glass-panel absolute right-4 bottom-4 flex items-center gap-1 rounded-xl p-1">
        <IconBtn onClick={() => zoom(-1)} label="Zoom out">
          <Minus className="size-4" />
        </IconBtn>
        <span className="num w-10 text-center text-[11px] text-muted-foreground">
          {Math.round(transform.scale * 100)}%
        </span>
        <IconBtn onClick={() => zoom(1)} label="Zoom in">
          <Plus className="size-4" />
        </IconBtn>
        <IconBtn onClick={() => center()} label="Recenter">
          <RotateCcw className="size-4" />
        </IconBtn>
        <IconBtn
          onClick={() => {
            const el = containerRef.current;
            if (!el) return;
            center(Math.min(1.4, Math.max(0.22, (el.clientWidth - 80) / Math.max(width, 1))));
          }}
          label="Fit tree"
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
