import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import { TxRow } from "@/components/tree/NodeDetailPanel";
import { useTxDialog } from "@/components/transactions/TransactionDialog";
import { Button } from "@/components/ui/button";
import { categoryTotals, formatMoney, sortTx, sum } from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";
import { categoryDef } from "@/lib/money/types";
import type { TxType } from "@/lib/money/types";

interface Props {
  type: TxType;
  title: string;
  subtitle: string;
}

export function TransactionLedger({ type, title, subtitle }: Props) {
  const { state, ready } = useMoney();
  const { openEdit, openDialog } = useTxDialog();

  const list = useMemo(
    () => sortTx(state.transactions.filter((t) => t.type === type)).reverse(),
    [state.transactions, type],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, typeof list>();
    list.forEach((t) => map.set(t.date, [...(map.get(t.date) ?? []), t]));
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [list]);

  const total = sum(list.map((t) => t.amount));
  const cats = categoryTotals(list, type);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              All time
            </div>
            <div
              className={`num text-xl font-semibold ${type === "income" ? "text-income" : "text-expense"}`}
            >
              {ready ? formatMoney(total, state.currency) : "—"}
            </div>
          </div>
          <Button onClick={() => openDialog({ kind: type })}>+ Add {type}</Button>
        </div>
      </header>

      {cats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <div
              key={c.category}
              className="rounded-xl border border-border bg-surface-2/50 px-3 py-2 text-xs"
            >
              <span className="mr-1.5">{categoryDef(c.category).icon}</span>
              {c.category}
              <span className="num ml-2 font-semibold">
                {formatMoney(c.total, state.currency)}
              </span>
              <span className="ml-1.5 text-muted-foreground">{c.count} tx</span>
            </div>
          ))}
        </div>
      )}

      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, items]) => (
            <section key={date} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">
                  {format(parseISO(date), "EEEE, MMMM d, yyyy")}
                </h2>
                <span className="num text-xs text-muted-foreground">
                  {formatMoney(sum(items.map((t) => t.amount)), state.currency)}
                </span>
              </div>
              {items.map((t) => (
                <TxRow key={t.id} tx={t} currency={state.currency} onEdit={() => openEdit(t)} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
