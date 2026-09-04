import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GoalCard } from "@/components/goals/GoalCard";
import {
  emptyGoalDraft,
  goalToDraft,
  GoalDialog,
  type GoalDraft,
} from "@/components/goals/GoalDialog";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money/calc";
import { goalsSummary, sortGoals } from "@/lib/money/goals";
import { useMoney } from "@/lib/money/store";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Financial Goals — MoneyTree" },
      {
        name: "description",
        content:
          "Create savings goals with targets and deadlines, track progress, add money and see the monthly saving you need.",
      },
      { property: "og:title", content: "Financial Goals — MoneyTree" },
      {
        property: "og:description",
        content: "Savings goals with progress, remaining amount, days left and monthly saving plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  const { state, ready, addGoal, updateGoal, deleteGoal, addToGoal } = useMoney();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<GoalDraft>(() => emptyGoalDraft());

  const goals = state.goals ?? [];
  const list = useMemo(() => sortGoals(goals), [goals]);
  const summary = useMemo(() => goalsSummary(goals), [goals]);

  function startCreate() {
    setEditing(null);
    setDraft(emptyGoalDraft());
    setOpen(true);
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold lg:text-3xl">Financial Goals 🎯</h1>
          <p className="text-sm text-muted-foreground">
            Set savings targets, add money as you go and watch each goal fill up.
          </p>
        </div>
        <Button onClick={startCreate}>+ Create Goal</Button>
      </header>

      {list.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Goals", value: `${summary.total}` },
            { label: "Saved", value: formatMoney(summary.saved, state.currency) },
            { label: "Total target", value: formatMoney(summary.target, state.currency) },
            {
              label: "Status",
              value: `${summary.active} active · ${summary.completed} done · ${summary.overdue} overdue`,
            },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-border bg-surface/60 p-5">
              <div className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {card.label}
              </div>
              <div className="num mt-2 text-lg font-semibold">{ready ? card.value : "—"}</div>
            </div>
          ))}
        </section>
      )}

      {list.length === 0 ? (
        <section className="rounded-[22px] border border-border bg-surface/60 p-8 text-center">
          <div className="text-4xl">🎯</div>
          <h2 className="mt-3 text-lg font-semibold">No financial goals yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Create a goal — a laptop, a trip, an emergency fund — with a target amount and date, then
            add money to it to start tracking your savings progress.
          </p>
          <Button className="mt-5" onClick={startCreate}>
            + Create Goal
          </Button>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {list.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              currency={state.currency}
              onAddMoney={(amount) => addToGoal(goal.id, amount)}
              onEdit={() => {
                setEditing(goal.id);
                setDraft(goalToDraft(goal));
                setOpen(true);
              }}
              onDelete={() => deleteGoal(goal.id)}
            />
          ))}
        </section>
      )}

      <GoalDialog
        open={open}
        onOpenChange={setOpen}
        initial={draft}
        editing={editing !== null}
        onSubmit={(payload) => (editing ? updateGoal(editing, payload) : addGoal(payload))}
      />
    </div>
  );
}
