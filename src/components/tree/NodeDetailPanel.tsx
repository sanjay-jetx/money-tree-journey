import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTxDialog } from "@/components/transactions/TransactionDialog";
import {
  branchStats,
  buildDays,
  categoryTotals,
  formatFullDate,
  formatMoney,
  formatTime,
  sum,
} from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";
import type { PositionedNode } from "@/lib/money/tree";
import { categoryDef } from "@/lib/money/types";
import type { Transaction } from "@/lib/money/types";

interface Props {
  node: PositionedNode | null;
  onClose: () => void;
}

export function NodeDetailPanel({ node, onClose }: Props) {
  const { state, deleteTransaction } = useMoney();
  const { openEdit, openDialog } = useTxDialog();
  const currency = state.currency;

  const txs = node ? state.transactions.filter((t) => node.txIds.includes(t.id)) : [];
  const single = node?.txId ? state.transactions.find((t) => t.id === node.txId) : undefined;

  return (
    <Sheet open={!!node} onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-lg">
            {node?.icon && <span>{node.icon}</span>}
            {node?.label ?? ""}
          </SheetTitle>
        </SheetHeader>

        {node && (
          <div className="space-y-6 px-4 pb-10">
            <div className="rounded-2xl border border-border bg-surface-2/60 p-4">
              <div className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                {node.kind === "left" ? "Balance carried forward" : "Amount"}
              </div>
              <div className="num mt-1 text-3xl font-semibold">
                {formatMoney(node.amount, currency)}
              </div>
              {node.date && (
                <div className="mt-1 text-sm text-muted-foreground">{formatFullDate(node.date)}</div>
              )}
              {node.balanceBefore !== undefined && node.balanceAfter !== undefined && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
                  <div>
                    <div className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                      Before
                    </div>
                    <div className="num text-base font-semibold">
                      {formatMoney(node.balanceBefore, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                      After
                    </div>
                    <div
                      className={
                        node.balanceAfter >= node.balanceBefore
                          ? "num text-base font-semibold text-income"
                          : "num text-base font-semibold text-expense"
                      }
                    >
                      {formatMoney(node.balanceAfter, currency)}
                    </div>
                  </div>
                </div>
              )}
            </div>


            {single ? (
              <TransactionDetail
                tx={single}
                currency={currency}
                onEdit={() => openEdit(single)}
                onDelete={() => {
                  deleteTransaction(single.id);
                  onClose();
                }}
              />
            ) : null}

            {node.kind === "date" && node.date && <DayBreakdown date={node.date} />}

            {(node.kind === "category" || node.kind === "spent" || node.kind === "income") && (
              <BranchAnalytics node={node} txs={txs} />
            )}

            {!single && txs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Transactions in this branch</h3>
                {[...txs]
                  .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                  .map((t) => (
                    <TxRow key={t.id} tx={t} currency={currency} onEdit={() => openEdit(t)} />
                  ))}
              </div>
            )}

            {node.date && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openDialog({ kind: "expense", date: node.date })}
                >
                  + Expense on this date
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openDialog({ kind: "income", date: node.date })}
                >
                  + Income
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TransactionDetail({
  tx,
  currency,
  onEdit,
  onDelete,
}: {
  tx: Transaction;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const rows: Array<[string, string]> = [
    ["Type", tx.type === "income" ? "Income" : "Expense"],
    ["Category", `${categoryDef(tx.category).icon} ${tx.category}`],
    ["Subcategory", tx.subcategory ?? "—"],
    ["Date", formatFullDate(tx.date)],
    ["Time", formatTime(tx.time)],
    ["Payment", tx.paymentMethod],
    ["Place", tx.merchant ?? "—"],
    ["Description", tx.description ?? "—"],
    ["Notes", tx.notes ?? "—"],
  ];
  void currency;
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="max-w-[60%] text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="gap-1.5" onClick={onEdit}>
          <Pencil className="size-3.5" /> Edit
        </Button>
        <Button size="sm" variant="destructive" className="gap-1.5" onClick={onDelete}>
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
}

function DayBreakdown({ date }: { date: string }) {
  const { state } = useMoney();
  const day = buildDays(state).find((d) => d.date === date);
  if (!day) return null;
  const cats = categoryTotals(day.transactions);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Opening" value={formatMoney(day.opening, state.currency)} />
        <Stat label="Spent" value={formatMoney(day.spent, state.currency)} tone="text-expense" />
        <Stat label="Left" value={formatMoney(day.closing, state.currency)} tone="text-balance" />
      </div>
      {cats.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Spending breakdown</h3>
          {cats.map((c) => (
            <div key={c.category} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>
                  {categoryDef(c.category).icon} {c.category}
                </span>
                <span className="num">{formatMoney(c.total, state.currency)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-expense"
                  style={{ width: `${Math.min(100, (c.total / Math.max(day.spent, 1)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BranchAnalytics({ node, txs }: { node: PositionedNode; txs: Transaction[] }) {
  const { state } = useMoney();
  const stats = branchStats(txs, state.transactions);
  const rows: Array<[string, string]> = [
    ["Total", formatMoney(stats.total, state.currency)],
    ["Share of spending", `${stats.share.toFixed(1)}%`],
    ["Transactions", String(stats.count)],
    ["Average", formatMoney(stats.average, state.currency)],
    ["Largest", formatMoney(stats.largest, state.currency)],
    ["Smallest", formatMoney(stats.smallest, state.currency)],
  ];
  void node;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Branch analytics</h3>
      <dl className="grid grid-cols-2 gap-2">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-surface-2/50 px-3 py-2">
            <dt className="text-[11px] text-muted-foreground">{k}</dt>
            <dd className="num text-sm font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/50 px-2 py-2">
      <div className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={`num text-sm font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

export function TxRow({
  tx,
  currency,
  onEdit,
}: {
  tx: Transaction;
  currency: string;
  onEdit: () => void;
}) {
  const { deleteTransaction } = useMoney();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-3 py-2">
      <span className="text-base">{categoryDef(tx.category).icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {tx.subcategory || tx.description || tx.category}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {formatTime(tx.time)} · {tx.paymentMethod}
          {tx.merchant ? ` · ${tx.merchant}` : ""}
        </div>
      </div>
      <span
        className={`num text-sm font-semibold ${tx.type === "income" ? "text-income" : "text-expense"}`}
      >
        {tx.type === "income" ? "+" : "−"}
        {formatMoney(tx.amount, currency)}
      </span>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit transaction"
        className="text-muted-foreground hover:text-foreground"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => deleteTransaction(tx.id)}
        aria-label="Delete transaction"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function totalOf(txs: Transaction[]) {
  return sum(txs.map((t) => t.amount));
}
