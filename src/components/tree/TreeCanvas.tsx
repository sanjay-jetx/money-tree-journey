import { ArrowRight, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/money/calc";
import { NODE_H, NODE_W, layoutTree } from "@/lib/money/tree";
import type { PositionedNode, Tone, TreeNode } from "@/lib/money/tree";
import { cn } from "@/lib/utils";

const toneStyles: Record<Tone, string> = {
  income: "border-income/45 bg-income-soft text-income",
  expense: "border-expense/45 bg-expense-soft text-expense",
  balance: "border-balance/45 bg-balance-soft text-balance",
  pending: "border-pending/45 bg-pending-soft text-pending",
  forecast: "border-forecast/50 bg-forecast/10 text-forecast",
  neutral: "border-border bg-surface-2 text-foreground",
};

const toneStroke: Record<Tone, string> = {
  income: "var(--income)",
  expense: "var(--expense)",
  balance: "var(--balance)",
  pending: "var(--pending)",
  forecast: "var(--forecast)",
  neutral: "var(--border)",
};

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
        "canvas-grain relative touch-none overflow-hidden rounded-3xl border border-border select-none",
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
          {edges.map((edge) => {
            const x1 = edge.from.x + NODE_W / 2;
            const y1 = edge.from.y + NODE_H;
            const x2 = edge.to.x + NODE_W / 2;
            const y2 = edge.to.y;
            const mid = (y1 + y2) / 2;
            return (
              <path
                key={edge.id}
                d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                fill="none"
                stroke={toneStroke[edge.tone]}
                strokeOpacity={0.55}
                strokeWidth={2}
                strokeLinecap="round"
                className={edge.dashed ? "flow-line" : undefined}
              />
            );
          })}
        </svg>

        {nodes.map((node) => {
          const dimmed = highlightIds && highlightIds.size > 0 && !highlightIds.has(node.id);
          return (
            <div
              key={node.id}
              data-node
              className="absolute"
              style={{ left: node.x, top: node.y, width: NODE_W }}
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
                  "animate-grow-in w-full rounded-2xl border px-3 py-2.5 text-left shadow-[var(--shadow-node)] backdrop-blur-sm transition-all",
                  toneStyles[node.tone],
                  selectedId === node.id && "ring-2 ring-ring ring-offset-2 ring-offset-canvas",
                  dimmed ? "opacity-25" : "hover:-translate-y-0.5",
                )}
                style={{ height: NODE_H }}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase opacity-90">
                  {node.icon && <span className="text-xs">{node.icon}</span>}
                  <span className="truncate">{node.label}</span>
                </div>
                <div className="num mt-0.5 truncate text-base leading-tight font-semibold text-foreground">
                  {formatMoney(node.amount, currency)}
                </div>
                {node.sublabel && (
                  <div className="truncate text-[10px] text-muted-foreground">{node.sublabel}</div>
                )}
                {node.balanceBefore !== undefined && node.balanceAfter !== undefined && (
                  <div className="mt-1 flex items-center gap-1 border-t border-border/50 pt-1 text-[9px] text-muted-foreground">
                    <span className="num truncate">
                      {formatMoney(node.balanceBefore, currency)}
                    </span>
                    <ArrowRight className="size-2.5 shrink-0 opacity-60" />
                    <span
                      className={cn(
                        "num truncate font-semibold",
                        node.balanceAfter >= node.balanceBefore
                          ? "text-income"
                          : "text-expense",
                      )}
                    >
                      {formatMoney(node.balanceAfter, currency)}
                    </span>
                  </div>
                )}

              </button>

              {node.hasChildren && (
                <button
                  type="button"
                  data-node
                  onClick={() => onToggle(node.id)}
                  aria-label={node.collapsed ? "Expand branch" : "Collapse branch"}
                  className="absolute -bottom-3 left-1/2 z-10 flex h-6 min-w-6 -translate-x-1/2 items-center justify-center gap-0.5 rounded-full border border-border bg-surface px-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  {node.collapsed ? `+${node.children.length}` : "−"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {hovered && (
        <div className="glass-panel pointer-events-none absolute top-4 left-4 max-w-[240px] rounded-xl px-3 py-2 text-xs">
          <div className="font-semibold">{hovered.label}</div>
          <div className="num text-sm">{formatMoney(hovered.amount, currency)}</div>
          <div className="text-muted-foreground">
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
