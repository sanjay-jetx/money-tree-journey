import { createFileRoute } from "@tanstack/react-router";
import { addDays, addMonths, addYears, format, parseISO, startOfWeek, subDays } from "date-fns";
import { CalendarCheck, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { NodeDetailPanel } from "@/components/tree/NodeDetailPanel";
import { ColorLegend } from "@/components/tree/ColorLegend";
import { TreeCanvas } from "@/components/tree/TreeCanvas";
import type { ContextAction } from "@/components/tree/TreeCanvas";
import { useTxDialog } from "@/components/transactions/TransactionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  ISO,
  applyFilters,
  currentBalance,
  formatFullDate,
  formatMoney,
  periodRange,
} from "@/lib/money/calc";
import { forecast } from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";
import { buildTree, defaultCollapsed, layoutTree } from "@/lib/money/tree";
import type { TreeNode, PositionedNode } from "@/lib/money/tree";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/money/types";
import type { ViewMode } from "@/lib/money/types";
import { cn } from "@/lib/utils";

/**
 * Builds the initial collapsed set for the year view so that today's
 * month → week → day path is pre-expanded while everything else stays
 * collapsed as before.
 */
function todayFocusCollapsed(root: TreeNode, today: string): Set<string> {
  const set = defaultCollapsed(root);
  if (root.kind !== "root") return set;

  const todayMonth = today.slice(0, 7); // "YYYY-MM"
  const todayWeekStart = format(
    startOfWeek(parseISO(today), { weekStartsOn: 1 }),
    ISO,
  );

  for (const monthNode of root.children) {
    if (monthNode.kind !== "month") continue;
    const nodeMonth = monthNode.date?.slice(0, 7);
    if (nodeMonth !== todayMonth) continue;
    // Expand today's month
    set.delete(monthNode.id);
    for (const weekNode of monthNode.children) {
      if (weekNode.kind !== "week") continue;
      if (weekNode.date && format(
        startOfWeek(parseISO(weekNode.date), { weekStartsOn: 1 }),
        ISO,
      ) !== todayWeekStart) continue;
      // Expand today's week
      set.delete(weekNode.id);
      for (const dayNode of weekNode.children) {
        if (dayNode.kind === "date" && dayNode.date === today) {
          // Expand today's day node
          set.delete(dayNode.id);
        }
      }
    }
  }
  return set;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MoneyTree — See the journey of your money" },
      {
        name: "description",
        content:
          "MoneyTree turns your income, spending and balance into a living interactive tree. Explore every date, branch and transaction of your money story.",
      },
      { property: "og:title", content: "MoneyTree — See the journey of your money" },
      {
        property: "og:description",
        content:
          "An interactive financial journey: every date is a layer, every branch shows where your money went.",
      },
    ],
  }),
  component: TreePage,
});

const VIEWS: ViewMode[] = ["day", "week", "month", "year"];

function TreePage() {
  const { state, ready, view, setView, anchorDate, setAnchorDate, filters, setFilters, resetFilters } =
    useMoney();
  const { openDialog } = useTxDialog();
  const today = useMemo(() => format(new Date(), ISO), []);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<PositionedNode | null>(null);
  const [menu, setMenu] = useState<ContextAction | null>(null);
  const [showProjection, setShowProjection] = useState(false);

  const range = useMemo(() => periodRange(view, anchorDate), [view, anchorDate]);
  const filteredTx = useMemo(() => applyFilters(state.transactions, filters), [state.transactions, filters]);

  const projection = useMemo(() => {
    if (!showProjection) return undefined;
    const points = forecast(state, 7);
    const last = points[points.length - 1];
    return last ? { days: 7, balance: Math.max(0, last.balance) } : undefined;
  }, [showProjection, state]);

  const root = useMemo(
    () => buildTree(state, { view, from: range.from, to: range.to, filteredTx, projection }),
    [state, view, range.from, range.to, filteredTx, projection],
  );

  const focusToday = useCallback(() => {
    setCollapsed(view === "year" ? todayFocusCollapsed(root, today) : defaultCollapsed(root));
  }, [root, view, today]);

  useEffect(() => {
    focusToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, range.from, range.to]);

  const highlightIds = useMemo(() => {
    if (!filters.query.trim()) return undefined;
    const ids = new Set<string>();
    const matched = new Set(filteredTx.map((t) => t.id));
    layoutTree(root, new Set()).nodes.forEach((n) => {
      if (n.txIds.some((id) => matched.has(id))) ids.add(n.id);
    });
    ids.add("root");
    return ids;
  }, [filters.query, filteredTx, root]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function shift(dir: 1 | -1) {
    const d = parseISO(anchorDate);
    if (view === "day") setAnchorDate(format(addDays(d, dir), ISO));
    else if (view === "week") setAnchorDate(format(addDays(d, dir * 7), ISO));
    else if (view === "month") setAnchorDate(format(addMonths(d, dir), ISO));
    else setAnchorDate(format(addYears(d, dir), ISO));
  }

  const activeFilterCount =
    filters.categories.length +
    filters.paymentMethods.length +
    (filters.type !== "all" ? 1 : 0) +
    (filters.minAmount != null ? 1 : 0) +
    (filters.maxAmount != null ? 1 : 0);

  const hasData = state.transactions.length > 0;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">Your money tree</h1>
          <p className="text-sm text-muted-foreground">
            {ready ? formatMoney(currentBalance(state), state.currency) : "—"} growing across{" "}
            {state.transactions.length} entries · {formatFullDate(range.from)} →{" "}
            {formatFullDate(range.to)}
          </p>
        </div>
        {state.isDemo && (
          <span className="rounded-full border border-pending/40 bg-pending-soft px-3 py-1 text-[11px] font-semibold text-pending">
            Demo data — reset it in Settings
          </span>
        )}
      </div>

      <StatsBar />

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-2xl bg-secondary/70 p-1">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-xs font-semibold capitalize transition-all",
                view === v
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-node)]"
                  : "text-secondary-foreground hover:text-primary",
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-2xl bg-secondary/70 p-1">
          <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Previous period">
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            className="h-8 w-[140px] border-0 bg-transparent text-xs shadow-none"
          />
          <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Next period">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <Button
          variant="secondary"
          className="gap-1.5"
          onClick={focusToday}
          title="Expand today's branch"
        >
          <CalendarCheck className="size-4" />
          Today
        </Button>

        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(e) => setFilters({ query: e.target.value })}
            placeholder="Search food, ₹500, GPay, Aug 29…"
            className="pl-9"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => setFilters({ query: "" })}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" className="gap-2">
              <SlidersHorizontal className="size-4" /> Filters
              {activeFilterCount > 0 && (
                <span className="num rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] space-y-4" align="end">
            <FilterGroup label="Flow">
              {(["all", "expense", "income"] as const).map((t) => (
                <Chip key={t} active={filters.type === t} onClick={() => setFilters({ type: t })}>
                  {t}
                </Chip>
              ))}
            </FilterGroup>
            <FilterGroup label="Categories">
              {[...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => (
                <Chip
                  key={c.name}
                  active={filters.categories.includes(c.name)}
                  onClick={() =>
                    setFilters({
                      categories: filters.categories.includes(c.name)
                        ? filters.categories.filter((x) => x !== c.name)
                        : [...filters.categories, c.name],
                    })
                  }
                >
                  {c.icon} {c.name}
                </Chip>
              ))}
            </FilterGroup>
            <FilterGroup label="Payment">
              {PAYMENT_METHODS.map((m) => (
                <Chip
                  key={m}
                  active={filters.paymentMethods.includes(m)}
                  onClick={() =>
                    setFilters({
                      paymentMethods: filters.paymentMethods.includes(m)
                        ? filters.paymentMethods.filter((x) => x !== m)
                        : [...filters.paymentMethods, m],
                    })
                  }
                >
                  {m}
                </Chip>
              ))}
            </FilterGroup>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Min ₹"
                inputMode="numeric"
                value={filters.minAmount ?? ""}
                onChange={(e) =>
                  setFilters({ minAmount: e.target.value ? Number(e.target.value) : null })
                }
              />
              <Input
                placeholder="Max ₹"
                inputMode="numeric"
                value={filters.maxAmount ?? ""}
                onChange={(e) =>
                  setFilters({ maxAmount: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={resetFilters}>
              Reset filters
            </Button>
          </PopoverContent>
        </Popover>

        <label className="flex items-center gap-2 rounded-2xl bg-secondary/70 px-3.5 py-2 text-xs font-medium text-secondary-foreground">
          <Switch checked={showProjection} onCheckedChange={setShowProjection} />
          Forecast branch
        </label>
      </div>

      {!ready ? (
        <div className="h-[560px] animate-pulse rounded-3xl bg-secondary/50" />
      ) : hasData ? (
        <div className="relative">
          <TreeCanvas
            root={root}
            collapsed={collapsed}
            onToggle={toggle}
            onSelect={setSelected}
            selectedId={selected?.id ?? null}
            highlightIds={highlightIds}
            currency={state.currency}
            onContextAction={setMenu}
            className="h-[560px] lg:h-[640px]"
          />
          <ColorLegend className="pointer-events-none absolute right-4 bottom-4 z-20" />
        </div>

      ) : (
        <div className="canvas-grain flex h-[520px] flex-col items-center justify-center gap-4 rounded-3xl text-center shadow-[var(--shadow-node)]">
          <div className="text-5xl">🌱</div>
          <h2 className="text-xl font-semibold">Your money story starts here.</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add your first entry and watch the first node grow into a full financial tree.
          </p>
          <Button onClick={() => openDialog({ kind: "income" })}>+ Add your first money</Button>
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Drag to pan · scroll to zoom · click a node for details · double-click to expand · right-click
        for actions
      </p>

      <NodeDetailPanel node={selected} onClose={() => setSelected(null)} />

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="glass-panel fixed z-50 w-52 rounded-xl p-1 text-sm shadow-[var(--shadow-node)]"
            style={{ left: Math.min(menu.x, window.innerWidth - 220), top: menu.y }}
          >
            <MenuItem
              onClick={() => {
                openDialog({ kind: "expense", date: menu.node.date ?? undefined });
                setMenu(null);
              }}
            >
              Add expense
            </MenuItem>
            <MenuItem
              onClick={() => {
                openDialog({ kind: "income", date: menu.node.date ?? undefined });
                setMenu(null);
              }}
            >
              Add income
            </MenuItem>
            <MenuItem
              onClick={() => {
                setSelected(menu.node);
                setMenu(null);
              }}
            >
              View analytics
            </MenuItem>
            {menu.node.hasChildren && (
              <MenuItem
                onClick={() => {
                  toggle(menu.node.id);
                  setMenu(null);
                }}
              >
                {menu.node.collapsed ? "Expand branch" : "Collapse branch"}
              </MenuItem>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border text-muted-foreground hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

void subDays;
