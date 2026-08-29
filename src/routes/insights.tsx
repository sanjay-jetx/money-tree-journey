import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  averageDailySpend,
  categoryTotals,
  currentBalance,
  forecast,
  formatMoney,
  sum,
} from "@/lib/money/calc";
import { generateInsights } from "@/lib/money/insights";
import { useMoney } from "@/lib/money/store";
import { categoryDef } from "@/lib/money/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — MoneyTree" },
      {
        name: "description",
        content:
          "Behaviour-aware money insights: spending patterns, category analysis, savings rate and low-balance forecasts built from your own transactions.",
      },
      { property: "og:title", content: "Insights — MoneyTree" },
      {
        property: "og:description",
        content: "Understand your spending patterns, category spikes and projected balance.",
      },
    ],
  }),
  component: InsightsPage,
});

const toneClass: Record<string, string> = {
  income: "text-income border-income/40 bg-income-soft",
  expense: "text-expense border-expense/40 bg-expense-soft",
  balance: "text-balance border-balance/40 bg-balance-soft",
  pending: "text-pending border-pending/40 bg-pending-soft",
  neutral: "text-foreground border-border bg-surface-2/60",
};

function InsightsPage() {
  const { state, ready } = useMoney();
  const insights = ready ? generateInsights(state) : [];
  const monthPrefix = format(new Date(), "yyyy-MM");
  const monthExp = state.transactions.filter(
    (t) => t.type === "expense" && t.date.startsWith(monthPrefix),
  );
  const cats = categoryTotals(monthExp);
  const total = sum(cats.map((c) => c.total));
  const points = ready ? forecast(state, 30) : [];
  const in7 = points[6];
  const in30 = points[29];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="text-2xl font-semibold lg:text-3xl">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Generated from your actual transactions — no invented numbers.
        </p>
      </header>

      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a few transactions and insights will appear here.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {insights.map((i) => (
            <article
              key={i.id}
              className={cn("rounded-2xl border p-4", toneClass[i.tone] ?? toneClass.neutral)}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">{i.title}</h2>
                {i.metric && <span className="num text-sm font-semibold">{i.metric}</span>}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{i.detail}</p>
            </article>
          ))}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface/60 p-5">
          <h2 className="text-base font-semibold">Category analysis · this month</h2>
          <div className="mt-4 space-y-3">
            {cats.length === 0 && (
              <p className="text-sm text-muted-foreground">No spending recorded this month yet.</p>
            )}
            {cats.map((c) => (
              <div key={c.category} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span>
                    {categoryDef(c.category).icon} {c.category}
                    <span className="ml-2 text-xs text-muted-foreground">{c.count} tx</span>
                  </span>
                  <span className="num font-semibold">
                    {formatMoney(c.total, state.currency)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {((c.total / Math.max(total, 1)) * 100).toFixed(0)}%
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-expense"
                    style={{ width: `${Math.min(100, (c.total / Math.max(total, 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-forecast/40 bg-forecast/5 p-5">
          <h2 className="text-base font-semibold">Future forecast</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Estimates only, based on your average daily spend of{" "}
            {formatMoney(averageDailySpend(state), state.currency)}.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-surface-2/50 p-3">
              <div className="text-[11px] tracking-wide text-muted-foreground uppercase">
                In 7 days
              </div>
              <div className="num mt-1 text-xl font-semibold text-forecast">
                {in7 ? formatMoney(Math.max(0, in7.balance), state.currency) : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface-2/50 p-3">
              <div className="text-[11px] tracking-wide text-muted-foreground uppercase">
                In 30 days
              </div>
              <div className="num mt-1 text-xl font-semibold text-forecast">
                {in30 ? formatMoney(Math.max(0, in30.balance), state.currency) : "—"}
              </div>
            </div>
          </div>
          <div className="mt-4 flex h-28 items-end gap-1">
            {points.map((p) => {
              const max = Math.max(currentBalance(state), 1);
              return (
                <div
                  key={p.date}
                  title={`${p.date}: ${formatMoney(Math.max(0, p.balance), state.currency)}`}
                  className="flex-1 rounded-t bg-forecast/45"
                  style={{ height: `${Math.max(3, (Math.max(0, p.balance) / max) * 100)}%` }}
                />
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Labelled as an estimate — the projected branch also appears on your tree.
          </p>
        </div>
      </section>
    </div>
  );
}
