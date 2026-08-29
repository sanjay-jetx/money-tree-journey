import { createFileRoute } from "@tanstack/react-router";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ISO,
  buildDays,
  formatFullDate,
  formatMoney,
  formatTime,
  todayISO,
} from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";
import { categoryDef } from "@/lib/money/types";

export const Route = createFileRoute("/time-machine")({
  head: () => ({
    meta: [
      { title: "Money Time Machine — MoneyTree" },
      {
        name: "description",
        content:
          "Travel to any date and watch your balance move hour by hour: opening balance, money received, money spent and what was left.",
      },
      { property: "og:title", content: "Money Time Machine — MoneyTree" },
      {
        property: "og:description",
        content: "Replay any day of your money story, transaction by transaction.",
      },
    ],
  }),
  component: TimeMachinePage,
});

function TimeMachinePage() {
  const { state, ready } = useMoney();
  const [date, setDate] = useState(() => todayISO());

  const days = useMemo(() => (ready ? buildDays(state) : []), [state, ready]);
  const day = days.find((d) => d.date === date);

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

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">Money Time Machine</h1>
          <p className="text-sm text-muted-foreground">
            Pick a date and watch your money move through the day.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface/70 p-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous day"
            onClick={() => setDate(format(addDays(parseISO(date), -1), ISO))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 w-[150px] border-0 bg-transparent shadow-none"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next day"
            onClick={() => setDate(format(addDays(parseISO(date), 1), ISO))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Starting balance" value={formatMoney(day?.opening ?? 0, state.currency)} />
        <Metric
          label="Money received"
          value={formatMoney(day?.income ?? 0, state.currency)}
          tone="text-income"
        />
        <Metric
          label="Money spent"
          value={formatMoney(day?.spent ?? 0, state.currency)}
          tone="text-expense"
        />
        <Metric
          label="Ending balance"
          value={formatMoney(day?.closing ?? day?.opening ?? 0, state.currency)}
          tone="text-balance"
        />
      </div>

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="text-base font-semibold">{formatFullDate(date)}</h2>
        {!day || timeline.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing happened on this date — your balance stayed still.
          </p>
        ) : (
          <ol className="mt-5 space-y-0">
            <li className="flex items-center gap-4">
              <span className="num w-20 shrink-0 text-xs text-muted-foreground">start</span>
              <span className="size-2.5 shrink-0 rounded-full bg-balance" />
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-balance/40" style={{ width: "100%" }} />
              </div>
              <span className="num w-24 shrink-0 text-right text-sm">
                {formatMoney(day.opening, state.currency)}
              </span>
            </li>
            {timeline.map((p) => (
              <li key={p.tx.id} className="flex items-center gap-4 border-t border-border/60 py-2.5">
                <span className="num w-20 shrink-0 text-xs text-muted-foreground">
                  {formatTime(p.tx.time)}
                </span>
                <span
                  className={`size-2.5 shrink-0 rounded-full ${p.tx.type === "income" ? "bg-income" : "bg-expense"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {categoryDef(p.tx.category).icon} {p.tx.subcategory || p.tx.category}
                    <span className="ml-2 text-xs text-muted-foreground">
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
                <span className="num w-24 shrink-0 text-right text-sm font-semibold">
                  {formatMoney(p.balance, state.currency)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">Jump to an active day</h2>
        <div className="flex flex-wrap gap-2">
          {days.slice(-21).map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => setDate(d.date)}
              className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                d.date === date
                  ? "border-primary bg-primary/15"
                  : "border-border bg-surface-2/40 hover:border-primary/40"
              }`}
            >
              <div className="font-semibold">{format(parseISO(d.date), "MMM d")}</div>
              <div className="num text-expense">−{formatMoney(d.spent, state.currency)}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/70 px-4 py-3">
      <div className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{label}</div>
      <div className={`num mt-1 text-lg font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
