import { createFileRoute } from "@tanstack/react-router";
import { Check, Cloud, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AccentPicker } from "@/components/settings/AccentPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { currentBalance, formatMoney, formatTime } from "@/lib/money/calc";
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
  const {
    state,
    setStartingBalance,
    setOverdraft,
    toggleTheme,
    loadDemo,
    clearAll,
    syncKey,
    setSyncKey,
    syncStatus,
    lastSyncedAt,
    syncToCloud,
    restoreFromCloud,
  } = useMoney();
  const [balance, setBalance] = useState(String(state.startingBalance));
  const [pairKeyInput, setPairKeyInput] = useState("");
  const [copied, setCopied] = useState(false);

  function copyKey() {
    navigator.clipboard.writeText(syncKey);
    setCopied(true);
    toast.success("Sync key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="text-2xl font-semibold lg:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your balance, rules, appearance and cross-device cloud sync.
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

      <section className="space-y-4 rounded-2xl border border-border bg-surface/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Cloud className="size-4 text-primary" /> Cloud Backend & Cross-Device Sync
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Persist your money tree across your phone, laptop, and other browsers.
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold border ${
              syncStatus === "synced"
                ? "bg-income-soft text-income border-income/30"
                : syncStatus === "syncing"
                  ? "bg-pending-soft text-pending border-pending/30 animate-pulse"
                  : "bg-surface-2 text-muted-foreground border-border"
            }`}
          >
            {syncStatus === "synced"
              ? "● Cloud Synced"
              : syncStatus === "syncing"
                ? "○ Syncing..."
                : "● Ready to Sync"}
          </span>
        </div>

        {lastSyncedAt && (
          <p className="text-[11px] text-muted-foreground">
            Last synced: {formatTime(lastSyncedAt.slice(11, 16))}
          </p>
        )}

        <div className="space-y-2 rounded-xl border border-border bg-surface-2/40 p-3.5">
          <Label className="text-xs font-semibold">Your Device Sync Key</Label>
          <div className="flex items-center gap-2">
            <Input value={syncKey} readOnly className="font-mono text-xs bg-surface" />
            <Button variant="secondary" size="sm" onClick={copyKey} className="gap-1 text-xs">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncToCloud()}
              className="gap-1 text-xs"
            >
              <RefreshCw className="size-3.5" /> Sync Now
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Share or enter this key on your other devices to access the exact same money tree.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <Label className="text-xs font-semibold">Pair / Restore from Another Key</Label>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Paste sync key (e.g. tree-xxxxxx)"
              value={pairKeyInput}
              onChange={(e) => setPairKeyInput(e.target.value)}
              className="text-xs"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!pairKeyInput.trim()}
              onClick={() => {
                restoreFromCloud(pairKeyInput.trim());
                setPairKeyInput("");
              }}
              className="text-xs shrink-0"
            >
              Restore Tree
            </Button>
          </div>
        </div>
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
