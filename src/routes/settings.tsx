import { createFileRoute } from "@tanstack/react-router";
import { Check, Cloud, Copy, Download, FileSpreadsheet, RefreshCw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AccentPicker } from "@/components/settings/AccentPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { currentBalance, formatMoney, formatTime } from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";

const CURRENCIES = [
  { symbol: "₹", label: "₹ INR (Rupee)" },
  { symbol: "$", label: "$ USD (Dollar)" },
  { symbol: "€", label: "€ EUR (Euro)" },
  { symbol: "£", label: "£ GBP (Pound)" },
  { symbol: "¥", label: "¥ JPY (Yen)" },
  { symbol: "A$", label: "A$ AUD (Aus Dollar)" },
  { symbol: "C$", label: "C$ CAD (Can Dollar)" },
  { symbol: "CHF", label: "CHF (Franc)" },
  { symbol: "AED", label: "AED (Dirham)" },
  { symbol: "SGD", label: "SGD (Sing Dollar)" },
];

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
    setCurrency,
    setOverdraft,
    toggleTheme,
    loadDemo,
    clearAll,
    importState,
  } = useMoney();
  const [balance, setBalance] = useState(String(state.startingBalance));
  const [copied, setCopied] = useState(false);
  void copied;
  const fileInputRef = useRef<HTMLInputElement>(null);


  function exportJsonBackup() {
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `moneytree-backup-${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("JSON backup downloaded");
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        importState(parsed);
      } catch {
        toast.error("Failed to parse backup JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function exportCsv() {
    if (state.transactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }
    const headers = [
      "Date",
      "Time",
      "Type",
      "Category",
      "Subcategory",
      "Amount",
      "Payment Method",
      "Merchant",
      "Notes",
    ];
    const rows = state.transactions.map((tx) => [
      tx.date,
      tx.time,
      tx.type,
      `"${(tx.category || "").replace(/"/g, '""')}"`,
      `"${(tx.subcategory || "").replace(/"/g, '""')}"`,
      tx.amount,
      `"${(tx.paymentMethod || "").replace(/"/g, '""')}"`,
      `"${(tx.merchant || "").replace(/"/g, '""')}"`,
      `"${(tx.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const downloadAnchor = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `moneytree-transactions-${dateStr}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success(`Exported ${state.transactions.length} transactions as CSV`);
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
            <Label>Currency</Label>
            <p className="text-xs text-muted-foreground">
              Applied everywhere across tree nodes, toolbars, and summaries.
            </p>
          </div>
          <div className="w-[180px]">
            <Select value={state.currency} onValueChange={setCurrency}>
              <SelectTrigger className="text-xs bg-surface">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.symbol} value={c.symbol}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
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
              <Cloud className="size-4 text-primary" /> Cloud Storage
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your money tree is automatically saved to the cloud after every change. No action needed.
            </p>
          </div>
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold border bg-income-soft text-income border-income/30">
            ● Auto-saving
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Data is stored securely in Supabase and restored automatically each time you sign in. Export a JSON backup below for extra safety.
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-surface/60 p-5">
        <div>
          <h2 className="text-base font-semibold">Data & Backups</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Export your data for offline safety, restore an existing backup, or download a CSV spreadsheet.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" size="sm" onClick={exportJsonBackup} className="gap-1.5 text-xs">
            <Download className="size-3.5" /> Export JSON Backup
          </Button>

          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-xs"
          >
            <Upload className="size-3.5" /> Restore JSON Backup
          </Button>

          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 text-xs">
            <FileSpreadsheet className="size-3.5" /> Export CSV
          </Button>
        </div>

        <div className="border-t border-border/80 pt-3">
          <p className="text-xs text-muted-foreground mb-3">
            {state.isDemo
              ? "You are currently exploring demo data."
              : "You are using your own data."}{" "}
            {state.transactions.length} transactions · {state.debts.length} owed entries ·{" "}
            {state.investments.length} investments.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={loadDemo}>
              Reload demo tree
            </Button>
            <Button variant="destructive" size="sm" onClick={clearAll}>
              Clear everything
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
