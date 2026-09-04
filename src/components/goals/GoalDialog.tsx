import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/money/calc";
import type { Goal } from "@/lib/money/types";

export interface GoalDraft {
  name: string;
  targetAmount: string;
  savedAmount: string;
  targetDate: string;
  description: string;
}

export function emptyGoalDraft(): GoalDraft {
  return { name: "", targetAmount: "", savedAmount: "", targetDate: todayISO(), description: "" };
}

export function goalToDraft(goal: Goal): GoalDraft {
  return {
    name: goal.name,
    targetAmount: String(goal.targetAmount),
    savedAmount: String(goal.savedAmount),
    targetDate: goal.targetDate,
    description: goal.description ?? "",
  };
}

export function GoalDialog({
  open,
  onOpenChange,
  initial,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: GoalDraft;
  editing: boolean;
  onSubmit: (payload: {
    name: string;
    targetAmount: number;
    savedAmount: number;
    targetDate: string;
    description?: string | undefined;
  }) => boolean;
}) {
  const [draft, setDraft] = useState<GoalDraft>(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setError(null);
    }
  }, [open, initial]);

  function submit() {
    const target = Number(draft.targetAmount);
    const saved = draft.savedAmount === "" ? 0 : Number(draft.savedAmount);
    if (!draft.name.trim()) return setError("Goal name is required.");
    if (!Number.isFinite(target) || target <= 0)
      return setError("Target amount must be greater than 0.");
    if (!Number.isFinite(saved) || saved < 0) return setError("Saved amount cannot be negative.");
    if (!draft.targetDate || Number.isNaN(Date.parse(draft.targetDate)))
      return setError("Pick a valid target date.");
    setError(null);
    const ok = onSubmit({
      name: draft.name.trim(),
      targetAmount: target,
      savedAmount: saved,
      targetDate: draft.targetDate,
      description: draft.description.trim() || undefined,
    });
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit goal" : "Create goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Goal name</Label>
            <Input
              value={draft.name}
              placeholder="New Laptop"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Target amount</Label>
              <Input
                className="num"
                inputMode="numeric"
                placeholder="70000"
                value={draft.targetAmount}
                onChange={(e) =>
                  setDraft({ ...draft, targetAmount: e.target.value.replace(/[^\d]/g, "") })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Already saved</Label>
              <Input
                className="num"
                inputMode="numeric"
                placeholder="0"
                value={draft.savedAmount}
                onChange={(e) =>
                  setDraft({ ...draft, savedAmount: e.target.value.replace(/[^\d]/g, "") })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Target date</Label>
            <Input
              type="date"
              value={draft.targetDate}
              onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              rows={2}
              value={draft.description}
              placeholder="Why this goal matters"
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-expense">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? "Save goal" : "Create goal"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
