import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { currentBalance, formatMoney } from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MoneyTree" },
      {
        name: "description",
        content:
          "Set your starting balance, allow or block overdraft, switch theme and reset the MoneyTree demo data.",
      },
      { property: "og:title", content: "Settings — MoneyTree" },
      { property: "og:description", content: "Control your starting balance, theme and demo data." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { state, setStartingBalance, setOverdraft, toggleTheme, loadDemo, clearAll } = useMoney();
  const [balance, setBalance] = useState(String(state.startingBalance));

  return (
    <div className="max-w-2xl space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="text-2xl font-semibold lg:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your data lives in this browser only — nothing is uploaded anywhere.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="text-base font-semibold">Starting balance</h2>
        <p className="text-xs text-muted-foreground">
          The root of your tree. Current balance is{" "}
          {formatMoney(currentBalance(state), state.currency)}.
        </p>
        <div className="flex gap-2">
          <Input
            value={balance}
            inputMode="numeric"
            onChange={(e) => setBalance(e.target.value.replace(/[^\d]/g, ""))}
            className="num max-w-[200px]"
          />
          <Button onClick={() => setStartingBalance(Number(balance) || 0)}>Save</Button>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="text-base font-semibold">Rules & appearance</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Allow overdraft</Label>
            <p className="text-xs text-muted-foreground">
              Off means you cannot spend more than the balance available on that date.
            </p>
          </div>
          <Switch checked={state.overdraft} onCheckedChange={setOverdraft} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Dark canvas</Label>
            <p className="text-xs text-muted-foreground">The tree glows best on dark.</p>
          </div>
          <Switch checked={state.theme === "dark"} onCheckedChange={toggleTheme} />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-surface/60 p-5">
        <div>
          <h2 className="text-base font-semibold">Accent colour</h2>
          <p className="text-xs text-muted-foreground">
            Pick a hue and how strong it feels — it re-tints the whole app instantly.
          </p>
        </div>
        <AccentPicker />
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface/60 p-5">
        <h2 className="text-base font-semibold">Data</h2>
        <p className="text-xs text-muted-foreground">
          {state.isDemo
            ? "You are currently exploring demo data."
            : "You are using your own data."}{" "}
          {state.transactions.length} transactions · {state.debts.length} owed entries.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={loadDemo}>
            Reload demo tree
          </Button>
          <Button variant="destructive" onClick={clearAll}>
            Clear everything
          </Button>
        </div>
      </section>
    </div>
  );
}
