import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, todayISO } from "@/lib/money/calc";
import {
  investmentGainPct,
  investmentValue,
  portfolioSummary,
  sortInvestments,
  yearsHeld,
} from "@/lib/money/investments";
import { useMoney } from "@/lib/money/store";
import { INVESTMENT_KINDS, investmentKindDef } from "@/lib/money/types";
import type { InterestMode, Investment, InvestmentKind } from "@/lib/money/types";

export const Route = createFileRoute("/investments")({
  head: () => ({
    meta: [
      { title: "Investments — MoneyTree" },
      {
        name: "description",
        content:
          "Track gold, stocks, funds and deposits with invested amount, interest rate and live growth on your money tree.",
      },
      { property: "og:title", content: "Investments — MoneyTree" },
      {
        property: "og:description",
        content: "Real investment balances with simple or compound interest growth.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestmentsPage,
});

interface Draft {
  name: string;
  kind: InvestmentKind;
  principal: string;
  annualRate: string;
  interestMode: InterestMode;
  startDate: string;
  currentValue: string;
  notes: string;
}

function emptyDraft(): Draft {
  return {
    name: "",
    kind: "gold",
    principal: "",
    annualRate: "8",
    interestMode: "compound",
    startDate: todayISO(),
    currentValue: "",
    notes: "",
  };
}

function toDraft(inv: Investment): Draft {
  return {
    name: inv.name,
    kind: inv.kind,
    principal: String(inv.principal),
    annualRate: String(inv.annualRate),
    interestMode: inv.interestMode,
    startDate: inv.startDate,
    currentValue: inv.currentValue ? String(inv.currentValue) : "",
    notes: inv.notes ?? "",
  };
}

function InvestmentsPage() {
  const { state, ready, addInvestment, updateInvestment, deleteInvestment } = useMoney();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const list = sortInvestments(state.investments);
  const summary = portfolioSummary(state.investments);

  function startAdd() {
    setEditing(null);
    setDraft(emptyDraft());
    setOpen(true);
  }

  function startEdit(inv: Investment) {
    setEditing(inv.id);
    setDraft(toDraft(inv));
    setOpen(true);
  }

  function save() {
    const payload = {
      name: draft.name.trim() || investmentKindDef(draft.kind).label,
      kind: draft.kind,
      principal: Number(draft.principal) || 0,
      annualRate: Number(draft.annualRate) || 0,
      interestMode: draft.interestMode,
      startDate: draft.startDate,
      currentValue: draft.currentValue ? Number(draft.currentValue) : undefined,
      notes: draft.notes.trim() || undefined,
    };
    if (editing) updateInvestment(editing, payload);
    else addInvestment(payload);
    setOpen(false);
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">Investments</h1>
          <p className="text-sm text-muted-foreground">
            Real holdings with interest — they grow their own branch on your tree.
          </p>
        </div>
        <Button onClick={startAdd}>+ Add investment</Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Invested", value: formatMoney(summary.principal, state.currency) },
          { label: "Current value", value: formatMoney(summary.value, state.currency) },
          {
            label: "Growth",
            value: `${summary.gain >= 0 ? "+" : ""}${formatMoney(summary.gain, state.currency)} · ${summary.gainPct.toFixed(1)}%`,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-border bg-surface/60 p-5">
            <div className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              {card.label}
            </div>
            <div className="num mt-2 text-xl font-semibold">{ready ? card.value : "—"}</div>
          </div>
        ))}
      </section>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No investments yet — add gold, stocks, a fund or a deposit and the tree will show it.
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((inv) => {
            const def = investmentKindDef(inv.kind);
            const value = investmentValue(inv);
            const gain = value - inv.principal;
            const pct = investmentGainPct(inv);
            return (
              <article
                key={inv.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface/60 p-4"
              >
                <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-2 text-xl">
                  {def.icon}
                </span>
                <div className="min-w-[180px] flex-1">
                  <div className="font-semibold">{inv.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {def.label} · {inv.annualRate}% {inv.interestMode === "none" ? "flat" : inv.interestMode} ·
                    since {format(parseISO(inv.startDate), "MMM d, yyyy")} ({yearsHeld(inv).toFixed(1)}y)
                    {inv.currentValue ? " · manual value" : ""}
                  </div>
                  {inv.notes && (
                    <div className="mt-1 text-xs text-muted-foreground italic">{inv.notes}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="num text-lg font-semibold">
                    {formatMoney(value, state.currency)}
                  </div>
                  <div
                    className={`num text-xs ${gain >= 0 ? "text-income" : "text-expense"}`}
                  >
                    {gain >= 0 ? "+" : ""}
                    {formatMoney(gain, state.currency)} · {pct.toFixed(1)}%
                  </div>
                  <div className="num text-[11px] text-muted-foreground">
                    invested {formatMoney(inv.principal, state.currency)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => startEdit(inv)}>
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteInvestment(inv.id)}>
                    Remove
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit investment" : "Add investment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={draft.name}
                placeholder="Sovereign gold bond"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={draft.kind}
                  onValueChange={(v) => setDraft({ ...draft, kind: v as InvestmentKind })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVESTMENT_KINDS.map((k) => (
                      <SelectItem key={k.kind} value={k.kind}>
                        {k.icon} {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Invested amount</Label>
                <Input
                  className="num"
                  inputMode="numeric"
                  value={draft.principal}
                  onChange={(e) =>
                    setDraft({ ...draft, principal: e.target.value.replace(/[^\d]/g, "") })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Annual rate (%)</Label>
                <Input
                  className="num"
                  inputMode="decimal"
                  value={draft.annualRate}
                  onChange={(e) =>
                    setDraft({ ...draft, annualRate: e.target.value.replace(/[^\d.]/g, "") })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Interest</Label>
                <Select
                  value={draft.interestMode}
                  onValueChange={(v) => setDraft({ ...draft, interestMode: v as InterestMode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compound">Compound</SelectItem>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="none">No interest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Invested on</Label>
                <Input
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Current value (optional)</Label>
                <Input
                  className="num"
                  inputMode="numeric"
                  placeholder="auto from interest"
                  value={draft.currentValue}
                  onChange={(e) =>
                    setDraft({ ...draft, currentValue: e.target.value.replace(/[^\d]/g, "") })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editing ? "Save changes" : "Add investment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
