import { createFileRoute } from "@tanstack/react-router";
import { Check, RotateCcw, Trash2 } from "lucide-react";
import { useTxDialog } from "@/components/transactions/TransactionDialog";
import { Button } from "@/components/ui/button";
import { debtTotals, formatFullDate, formatMoney } from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";
import type { Debt } from "@/lib/money/types";

export const Route = createFileRoute("/owed")({
  head: () => ({
    meta: [
      { title: "Owed & Lending — MoneyTree" },
      {
        name: "description",
        content:
          "Track money people owe you and money you owe others, with reason, date and pending or paid status.",
      },
      { property: "og:title", content: "Owed & Lending — MoneyTree" },
      { property: "og:description", content: "Keep informal loans separate from real expenses." },
    ],
  }),
  component: OwedPage,
});

function OwedPage() {
  const { state, ready, updateDebt, deleteDebt } = useMoney();
  const { openDialog } = useTxDialog();
  const totals = debtTotals(state.debts);

  const owedToMe = state.debts.filter((d) => d.direction === "owed_to_me");
  const iOwe = state.debts.filter((d) => d.direction === "i_owe");

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">Owed & lending</h1>
          <p className="text-sm text-muted-foreground">
            Money in motion between you and other people — kept apart from completed expenses.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openDialog({ kind: "owed_to_me" })}>
            + Owed to me
          </Button>
          <Button variant="secondary" onClick={() => openDialog({ kind: "i_owe" })}>
            + I owe
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric
          label="Pending owed to me"
          value={ready ? formatMoney(totals.owedToMe, state.currency) : "—"}
          tone="text-income"
        />
        <Metric
          label="Pending I owe"
          value={ready ? formatMoney(totals.iOwe, state.currency) : "—"}
          tone="text-debt"
        />
        <Metric
          label="Net position"
          value={ready ? formatMoney(totals.owedToMe - totals.iOwe, state.currency) : "—"}
          tone="text-pending"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DebtList
          title="Owed to me"
          debts={owedToMe}
          currency={state.currency}
          onToggle={(d) =>
            updateDebt(d.id, { status: d.status === "pending" ? "paid" : "pending" })
          }
          onDelete={(d) => deleteDebt(d.id)}
        />
        <DebtList
          title="I owe"
          debts={iOwe}
          currency={state.currency}
          onToggle={(d) =>
            updateDebt(d.id, { status: d.status === "pending" ? "paid" : "pending" })
          }
          onDelete={(d) => deleteDebt(d.id)}
        />
      </div>
    </div>
  );
}

function DebtList({
  title,
  debts,
  currency,
  onToggle,
  onDelete,
}: {
  title: string;
  debts: Debt[];
  currency: string;
  onToggle: (d: Debt) => void;
  onDelete: (d: Debt) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {debts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {debts.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {d.person}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      d.status === "pending"
                        ? "bg-pending-soft text-pending"
                        : "bg-income-soft text-income"
                    }`}
                  >
                    {d.status}
                  </span>
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {formatFullDate(d.date)}
                  {d.reason ? ` · ${d.reason}` : ""}
                </div>
              </div>
              <span className="num text-sm font-semibold">{formatMoney(d.amount, currency)}</span>
              <button
                type="button"
                onClick={() => onToggle(d)}
                aria-label="Toggle status"
                className="text-muted-foreground hover:text-foreground"
              >
                {d.status === "pending" ? (
                  <Check className="size-4" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onDelete(d)}
                aria-label="Delete entry"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
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
