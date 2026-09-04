import { Link, createFileRoute } from "@tanstack/react-router";
import { addDays, format, parseISO, subDays, subMonths, subWeeks } from "date-fns";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  History,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ColorLegend } from "@/components/tree/ColorLegend";
import { NodeDetailPanel } from "@/components/tree/NodeDetailPanel";
import { TreeCanvas } from "@/components/tree/TreeCanvas";
import type { PositionedNode } from "@/lib/money/tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ISO,
  balanceOn,
  buildDays,
  formatFullDate,
  formatMoney,
  formatTime,
  periodRange,
  todayISO,
} from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";
import { buildTree, defaultCollapsed } from "@/lib/money/tree";
import { categoryDef } from "@/lib/money/types";
import type { MoneyState, ViewMode } from "@/lib/money/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/time-machine")({
  head: () => ({
    meta: [
      { title: "Money Time Machine — MoneyTree" },
      {
        name: "description",
        content:
          "Travel back to any past date and explore what your money tree and balance looked like at that moment in time.",
      },
      { property: "og:title", content: "Money Time Machine — MoneyTree" },
      {
        property: "og:description",
        content: "Travel back in time to replay and visualize your money tree on any historical date.",
      },
    ],
  }),
  component: TimeMachinePage,
});

const VIEWS: ViewMode[] = ["day", "week", "month"];

function TimeMachinePage() {
  const { state, ready } = useMoney();
  const today = useMemo(() => todayISO(), []);
  const [date, setDate] = useState(() => todayISO());
  const [timeView, setTimeView] = useState<ViewMode>("week");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<PositionedNode | null>(null);

  // Filter state to only include transactions and assets up to the selected past date
  const historicalState = useMemo<MoneyState>(() => {
    return {
      ...state,
      transactions: state.transactions.filter((t) => t.date <= date),
      debts: state.debts.filter((d) => d.date <= date),
      investments: state.investments.filter((i) => i.startDate <= date),
    };
  }, [state, date]);

  const historicalBalance = useMemo(() => {
    if (!ready) return 0;
    return balanceOn(historicalState, date);
  }, [historicalState, date, ready]);

  const days = useMemo(() => (ready ? buildDays(state) : []), [state, ready]);
  const day = days.find((d) => d.date === date);

  // Build the historical tree range
  const range = useMemo(() => periodRange(timeView, date), [timeView, date]);

  const root = useMemo(() => {
    return buildTree(historicalState, {
      view: timeView,
      from: range.from,
      to: range.to,
      filteredTx: historicalState.transactions,
    });
  }, [historicalState, timeView, range.from, range.to]);

  useEffect(() => {
    setCollapsed(defaultCollapsed(root));
  }, [root]);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const timeline = useMemo(() => {
    if (!day) return [];
    let running = day.opening;
    return [...day.transactions]
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((t) => {
        running += t.type === "income" ? t.amount : -t.amount;
        return { tx: t, balance: running };
      });
  }, [day]);

  const maxBalance = Math.max(day?.opening ?? 1, ...timeline.map((p) => p.balance), 1);

  // Quick travel presets
  function travelTo(targetDate: string) {
    setDate(targetDate);
  }

  const isToday = date === today;

  return (
    <div className="space-y-6 p-4 lg:p-7 max-w-7xl mx-auto">
      {/* Header & Date Controls */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="accent-gradient flex size-9 items-center justify-center rounded-xl text-lg shadow-sm">
              ⏳
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl font-display">
              Money Time Machine
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Travel to any past date and explore what your money tree and balance looked like then.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Date Picker Bar */}
          <div className="flex items-center rounded-2xl border border-border bg-surface/80 p-1 backdrop-blur shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl hover:bg-surface-2"
              aria-label="Previous day"
              onClick={() => setDate(format(addDays(parseISO(date), -1), ISO))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-2 px-2 py-1">
              <Calendar className="size-3.5 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="h-7 w-[138px] border-0 bg-transparent p-0 text-xs font-semibold focus-visible:ring-0 shadow-none"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl hover:bg-surface-2"
              aria-label="Next day"
              disabled={isToday}
              onClick={() => setDate(format(addDays(parseISO(date), 1), ISO))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {!isToday && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => travelTo(today)}
              className="rounded-2xl text-xs h-9 gap-1"
            >
              <RotateCcw className="size-3.5" /> Return to Today
            </Button>
          )}

          <Link
            to="/"
            search={{ date }}
            className="accent-gradient inline-flex items-center gap-1.5 rounded-2xl px-3.5 text-xs sm:text-sm font-semibold text-primary-foreground shadow-sm h-9 hover:opacity-95 transition-opacity"
          >
            <Compass className="size-4" />
            Open on Tree
          </Link>
        </div>
      </header>

      {/* Historical Status Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface-2/60 p-5 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase">
                {isToday ? "Current Day" : "Time Capsule Snapshot"}
              </span>
              <span className="text-xs font-semibold text-foreground">
                {formatFullDate(date)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing your financial tree with all transactions recorded up to{" "}
              <strong>{date}</strong>. Subsequent activity is hidden to show this exact snapshot.
            </p>
          </div>

          {/* Balance at this point in time */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="rounded-2xl border border-border bg-surface/90 px-4 py-2 text-right shadow-xs">
              <div className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Balance on this date
              </div>
              <div className="num text-xl font-bold text-foreground">
                {ready ? formatMoney(historicalBalance, state.currency) : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Quick presets */}
        <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-1">
            <History className="size-3" /> Quick travel:
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => travelTo(format(subDays(parseISO(today), 1), ISO))}
            className="h-7 text-xs rounded-xl bg-surface px-2.5"
          >
            Yesterday
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => travelTo(format(subWeeks(parseISO(today), 1), ISO))}
            className="h-7 text-xs rounded-xl bg-surface px-2.5"
          >
            1 Week Ago
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => travelTo(format(subMonths(parseISO(today), 1), ISO))}
            className="h-7 text-xs rounded-xl bg-surface px-2.5"
          >
            1 Month Ago
          </Button>
          {days.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => travelTo(days[0]!.date)}
              className="h-7 text-xs rounded-xl bg-surface px-2.5"
            >
              First Recorded Day ({format(parseISO(days[0]!.date), "MMM d")})
            </Button>
          )}
        </div>
      </section>

      {/* Main Historical Tree Viewer */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              What Your Tree Looked Like
            </h2>
          </div>

          <div className="flex rounded-2xl bg-secondary/70 p-1">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTimeView(v)}
                className={cn(
                  "rounded-xl px-3 py-1 text-xs font-semibold capitalize transition-all",
                  timeView === v
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-secondary-foreground hover:text-primary",
                )}
              >
                {v} View
              </button>
            ))}
          </div>
        </div>

        {/* Tree Canvas */}
        <div className="relative rounded-3xl border border-border bg-canvas overflow-hidden shadow-sm">
          <TreeCanvas
            root={root}
            collapsed={collapsed}
            onToggle={toggle}
            onSelect={setSelected}
            selectedId={selected?.id ?? null}
            currency={state.currency}
            className="h-[520px] lg:h-[580px]"
          />
          <ColorLegend className="absolute left-4 bottom-4 z-20" />
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          Drag to pan · scroll to zoom · click any branch to inspect historical details
        </p>
      </section>

      {/* Day's Movement Timeline */}
      <section className="rounded-3xl border border-border bg-surface/75 p-5 backdrop-blur space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            Hourly Cash Movement on {format(parseISO(date), "MMMM d, yyyy")}
          </h2>
          {day && (
            <span className="text-xs text-muted-foreground">
              {day.transactions.length} transactions
            </span>
          )}
        </div>

        {!day || timeline.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No money movement on this date — balance was held at{" "}
            {formatMoney(day?.opening ?? historicalBalance, state.currency)}.
          </div>
        ) : (
          <ol className="space-y-0">
            <li className="flex items-center gap-4 py-2">
              <span className="num w-20 shrink-0 text-xs text-muted-foreground">Opening</span>
              <span className="size-2.5 shrink-0 rounded-full bg-balance" />
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-balance/40" style={{ width: "100%" }} />
              </div>
              <span className="num w-24 shrink-0 text-right text-xs font-semibold">
                {formatMoney(day.opening, state.currency)}
              </span>
            </li>
            {timeline.map((p) => (
              <li key={p.tx.id} className="flex items-center gap-4 border-t border-border/50 py-2.5">
                <span className="num w-20 shrink-0 text-xs text-muted-foreground">
                  {formatTime(p.tx.time)}
                </span>
                <span
                  className={`size-2.5 shrink-0 rounded-full ${
                    p.tx.type === "income" ? "bg-income" : "bg-expense"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground">
                    {categoryDef(p.tx.category).icon} {p.tx.subcategory || p.tx.category}
                    <span className="ml-2 text-muted-foreground">
                      {p.tx.type === "income" ? "+" : "−"}
                      {formatMoney(p.tx.amount, state.currency)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-balance"
                      style={{ width: `${Math.max(2, (p.balance / maxBalance) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="num w-24 shrink-0 text-right text-xs font-semibold">
                  {formatMoney(p.balance, state.currency)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Jump to active historical days */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Jump to an Active Day in History
        </h2>
        <div className="flex flex-wrap gap-2">
          {days.slice(-24).map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => setDate(d.date)}
              className={cn(
                "rounded-2xl border px-3 py-2 text-left text-xs transition-all",
                d.date === date
                  ? "border-primary bg-primary/15 font-semibold text-primary"
                  : "border-border bg-surface hover:border-border-strong text-muted-foreground",
              )}
            >
              <div>{format(parseISO(d.date), "MMM d")}</div>
              <div className="num text-[10px] text-expense">−{formatMoney(d.spent, state.currency)}</div>
            </button>
          ))}
        </div>
      </section>

      <NodeDetailPanel node={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
