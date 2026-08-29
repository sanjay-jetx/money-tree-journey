import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ISO, formatMoney } from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  categoryDef,
} from "@/lib/money/types";
import type { DebtDirection, PaymentMethod, Transaction, TxType } from "@/lib/money/types";
import { cn } from "@/lib/utils";

type Kind = TxType | "owed_to_me" | "i_owe";

interface DialogState {
  open: boolean;
  kind: Kind;
  date?: string | undefined;
  editing?: Transaction | undefined;
}

interface TxDialogApi {
  openDialog: (options?: Partial<Omit<DialogState, "open">>) => void;
  openEdit: (tx: Transaction) => void;
}

const Ctx = createContext<TxDialogApi | null>(null);

export function useTxDialog() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTxDialog must be used inside TransactionDialogProvider");
  return ctx;
}

const KINDS: Array<{ id: Kind; label: string; hint: string }> = [
  { id: "expense", label: "Expense", hint: "Money leaving the tree" },
  { id: "income", label: "Income", hint: "Money joining the tree" },
  { id: "owed_to_me", label: "Owed to me", hint: "Someone will pay you back" },
  { id: "i_owe", label: "I owe", hint: "You will pay someone back" },
];

export function TransactionDialogProvider({ children }: { children: ReactNode }) {
  const { addTransaction, updateTransaction, addDebt, state } = useMoney();
  const [dialog, setDialog] = useState<DialogState>({ open: false, kind: "expense" });

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [subcategory, setSubcategory] = useState("");
  const [date, setDate] = useState(() => format(new Date(), ISO));
  const [time, setTime] = useState(() => format(new Date(), "HH:mm"));
  const [method, setMethod] = useState<PaymentMethod>("GPay");
  const [place, setPlace] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [person, setPerson] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const api = useMemo<TxDialogApi>(
    () => ({
      openDialog: (options) =>
        setDialog({ open: true, kind: options?.kind ?? "expense", ...options }),
      openEdit: (tx) => setDialog({ open: true, kind: tx.type, editing: tx, date: tx.date }),
    }),
    [],
  );

  useEffect(() => {
    if (!dialog.open) return;
    const tx = dialog.editing;
    setError(null);
    if (tx) {
      setAmount(String(tx.amount));
      setCategory(tx.category);
      setSubcategory(tx.subcategory ?? "");
      setDate(tx.date);
      setTime(tx.time);
      setMethod(tx.paymentMethod);
      setPlace(tx.merchant ?? "");
      setDescription(tx.description ?? "");
      setNotes(tx.notes ?? "");
      return;
    }
    setAmount("");
    setCategory(dialog.kind === "income" ? "Salary" : "Food");
    setSubcategory("");
    setDate(dialog.date ?? format(new Date(), ISO));
    setTime(format(new Date(), "HH:mm"));
    setMethod("GPay");
    setPlace("");
    setDescription("");
    setNotes("");
    setPerson("");
    setReason("");
  }, [dialog]);

  const isDebt = dialog.kind === "owed_to_me" || dialog.kind === "i_owe";
  const categories = dialog.kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const subs = categoryDef(category).subcategories;
  const parsedAmount = Number(amount);

  function close() {
    setDialog((d) => ({ ...d, open: false }));
  }

  function submit() {
    setError(null);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!date) {
      setError("Pick a valid date.");
      return;
    }
    if (isDebt) {
      if (!person.trim()) {
        setError("Who is this with? Add a name.");
        return;
      }
      addDebt({
        person: person.trim(),
        amount: parsedAmount,
        date,
        direction: dialog.kind as DebtDirection,
        reason: reason.trim() || undefined,
        status: "pending",
      });
      toast.success(
        dialog.kind === "owed_to_me"
          ? `${person} owes you ${formatMoney(parsedAmount, state.currency)}`
          : `You owe ${person} ${formatMoney(parsedAmount, state.currency)}`,
      );
      close();
      return;
    }

    const payload = {
      type: dialog.kind as TxType,
      amount: Math.round(parsedAmount),
      category,
      subcategory: subcategory.trim() || undefined,
      description: description.trim() || undefined,
      merchant: place.trim() || undefined,
      paymentMethod: method,
      date,
      time,
      notes: notes.trim() || undefined,
    };

    if (dialog.editing) {
      updateTransaction(dialog.editing.id, payload);
      toast.success("Transaction updated");
      close();
      return;
    }
    const ok = addTransaction(payload);
    if (ok) {
      toast.success(
        `${dialog.kind === "income" ? "Added" : "Spent"} ${formatMoney(parsedAmount, state.currency)}`,
        { description: `${category}${subcategory ? ` · ${subcategory}` : ""} · ${date}` },
      );
      close();
    }
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      <Dialog open={dialog.open} onOpenChange={(o) => (o ? null : close())}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {dialog.editing ? "Edit transaction" : "Add to your money tree"}
            </DialogTitle>
            <DialogDescription>
              Every entry becomes a branch on the date it belongs to.
            </DialogDescription>
          </DialogHeader>

          {!dialog.editing && (
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setDialog((d) => ({ ...d, kind: k.id }))}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    dialog.kind === k.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface-2/50 hover:border-primary/50",
                  )}
                >
                  <div className="text-sm font-semibold">{k.label}</div>
                  <div className="text-[11px] text-muted-foreground">{k.hint}</div>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                  {state.currency}
                </span>
                <Input
                  id="amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0"
                  className="num pl-8 text-lg"
                />
              </div>
            </div>

            {isDebt ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="person">Person</Label>
                  <Input
                    id="person"
                    value={person}
                    onChange={(e) => setPerson(e.target.value)}
                    placeholder="Arun"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="debt-date">Date</Label>
                  <Input
                    id="debt-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Input
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Movie tickets"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => {
                          setCategory(c.name);
                          setSubcategory("");
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          category === c.name
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border text-muted-foreground hover:border-primary/50",
                        )}
                      >
                        <span className="mr-1">{c.icon}</span>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sub">Subcategory</Label>
                  <Input
                    id="sub"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    placeholder={subs[0] ? `e.g. ${subs[0]}` : "Optional"}
                  />
                  {subs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {subs.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSubcategory(s)}
                          className="rounded-md bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Payment method</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          method === m
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border text-muted-foreground hover:border-primary/50",
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="place">Place / merchant</Label>
                    <Input
                      id="place"
                      value={place}
                      onChange={(e) => setPlace(e.target.value)}
                      placeholder="College canteen"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="desc">Description</Label>
                    <Input
                      id="desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Lunch with friends"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Anything worth remembering"
                  />
                </div>
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button onClick={submit}>{dialog.editing ? "Save changes" : "Add to tree"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
