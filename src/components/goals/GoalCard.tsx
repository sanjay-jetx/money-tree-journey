import { format, parseISO } from "date-fns";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { formatMoney } from "@/lib/money/calc";
import {
  goalDaysRemaining,
  goalMonthlySaving,
  goalMonthsRemaining,
  goalProgressPct,
  goalRemaining,
  goalStatus,
} from "@/lib/money/goals";
import type { Goal } from "@/lib/money/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL = { active: "Active", completed: "Completed", overdue: "Overdue" } as const;

export function GoalCard({
  goal,
  currency,
  onAddMoney,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  currency: string;
  onAddMoney: (amount: number) => boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const status = goalStatus(goal);
  const pct = goalProgressPct(goal);
  const remaining = goalRemaining(goal);
  const days = goalDaysRemaining(goal);
  const monthly = goalMonthlySaving(goal);

  function submitAdd() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setAddError("Enter an amount greater than 0.");
      return;
    }
    if (onAddMoney(value)) {
      setAmount("");
      setAddError(null);
      setAddOpen(false);
    }
  }

  return (
    <article className="flex flex-col gap-4 rounded-[22px] border border-border bg-surface/60 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{goal.name}</h2>
          {goal.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{goal.description}</p>
          )}
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase",
            status === "completed" && "bg-income-soft text-income",
            status === "overdue" && "bg-expense-soft text-expense",
            status === "active" && "bg-pending-soft text-pending",
          )}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="num text-xl font-semibold">
            {formatMoney(goal.savedAmount, currency)}
            <span className="text-sm font-medium text-muted-foreground">
              {" / "}
              {formatMoney(goal.targetAmount, currency)}
            </span>
          </div>
          <div className="num text-sm font-semibold">{pct.toFixed(0)}% complete</div>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="accent-gradient h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Remaining</dt>
          <dd className="num font-semibold">{formatMoney(remaining, currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Target date</dt>
          <dd className="font-semibold">{format(parseISO(goal.targetDate), "MMMM yyyy")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Days remaining</dt>
          <dd className="num font-semibold">
            {status === "completed"
              ? "Reached"
              : days < 0
                ? `${Math.abs(days)} days overdue`
                : `${days} days`}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">
        {status === "completed"
          ? "Goal reached — nothing more to save."
          : status === "overdue"
            ? `Target date passed with ${formatMoney(remaining, currency)} still to go — edit the date to keep going.`
            : monthly !== null
              ? `${formatMoney(remaining, currency)} remaining · ${goalMonthsRemaining(goal)} months left — save about ${formatMoney(monthly, currency)}/month to reach this goal.`
              : `${formatMoney(remaining, currency)} remaining — target date is today.`}
      </p>

      <div className="flex flex-wrap gap-2">
        {status !== "completed" && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            + Add money
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
          Delete
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Add money to {goal.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                className="num"
                inputMode="numeric"
                autoFocus
                value={amount}
                placeholder="5000"
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && submitAdd()}
              />
            </div>
            <p className="num text-xs text-muted-foreground">
              {formatMoney(remaining, currency)} left to reach {formatMoney(goal.targetAmount, currency)}
            </p>
            {addError && <p className="text-sm text-expense">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitAdd}>Add money</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{goal.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the goal and its saved progress. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete goal</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
