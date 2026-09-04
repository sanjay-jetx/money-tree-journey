import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Filter, Search, TreePine, X } from "lucide-react";
import { useMemo, useState } from "react";
import { TxRow } from "@/components/tree/NodeDetailPanel";
import { useTxDialog } from "@/components/transactions/TransactionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categoryTotals, formatMoney, sortTx, sum } from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";
import { categoryDef } from "@/lib/money/types";
import type { TxType } from "@/lib/money/types";
import { cn } from "@/lib/utils";

interface Props {
  type: TxType;
  title: string;
  subtitle: string;
}

export function TransactionLedger({ type, title, subtitle }: Props) {
  const { state, ready } = useMoney();
  const { openEdit, openDialog } = useTxDialog();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const list = useMemo(
    () => sortTx(state.transactions.filter((t) => t.type === type)).reverse(),
    [state.transactions, type],
  );

  const cats = useMemo(() => categoryTotals(list, type), [list, type]);

  const filteredList = useMemo(() => {
    return list.filter((t) => {
      if (selectedCategory && t.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCat = t.category.toLowerCase().includes(q);
        const matchesSubcat = t.subcategory?.toLowerCase().includes(q);
        const matchesMerchant = t.merchant?.toLowerCase().includes(q);
        const matchesNotes = t.notes?.toLowerCase().includes(q);
        const matchesAmount = String(t.amount).includes(q);
        const matchesPayment = t.paymentMethod.toLowerCase().includes(q);
        return Boolean(
          matchesCat ||
            matchesSubcat ||
            matchesMerchant ||
            matchesNotes ||
            matchesAmount ||
            matchesPayment,
        );
      }
      return true;
    });
  }, [list, selectedCategory, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredList>();
    filteredList.forEach((t) => map.set(t.date, [...(map.get(t.date) ?? []), t]));
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredList]);

  const total = sum(list.map((t) => t.amount));
  const filteredTotal = sum(filteredList.map((t) => t.amount));
  const isFiltering = Boolean(selectedCategory || searchQuery.trim());

  function clearFilters() {
    setSearchQuery("");
    setSelectedCategory(null);
  }

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
              {isFiltering ? "Filtered total" : "All time"}
            </div>
            <div
              className={`num text-xl font-semibold ${type === "income" ? "text-income" : "text-expense"}`}
            >
              {ready ? formatMoney(isFiltering ? filteredTotal : total, state.currency) : "—"}
            </div>
          </div>
          <Button onClick={() => openDialog({ kind: type })}>+ Add {type}</Button>
        </div>
      </header>

      {/* Search & Category Filter Section */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={`Search ${type}s (notes, merchant, category)...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 text-xs bg-surface"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {isFiltering && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1 text-xs text-muted-foreground hover:text-foreground h-9"
            >
              <X className="size-3.5" /> Clear filters
            </Button>
          )}

          <div className="text-xs text-muted-foreground ml-auto">
            {filteredList.length} of {list.length} {list.length === 1 ? "entry" : "entries"}
          </div>
        </div>

        {cats.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs transition-all flex items-center gap-1.5 cursor-pointer",
                selectedCategory === null
                  ? "border-primary bg-primary/10 font-semibold text-foreground shadow-sm"
                  : "border-border bg-surface-2/40 text-muted-foreground hover:text-foreground hover:bg-surface-2/80",
              )}
            >
              <Filter className="size-3" /> All categories
            </button>
            {cats.map((c) => {
              const isSelected = selectedCategory === c.category;
              return (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? null : c.category)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-xs transition-all flex items-center gap-1.5 cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/10 font-semibold text-foreground shadow-sm"
                      : "border-border bg-surface-2/40 text-muted-foreground hover:text-foreground hover:bg-surface-2/80",
                  )}
                >
                  <span>{categoryDef(c.category).icon}</span>
                  <span>{c.category}</span>
                  <span className="num font-semibold text-foreground">
                    {formatMoney(c.total, state.currency)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">({c.count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            {isFiltering
              ? "No entries match your active search or category filter."
              : `No ${type} recorded yet.`}
          </p>
          {isFiltering ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Reset filters
            </Button>
          ) : (
            <Button size="sm" onClick={() => openDialog({ kind: type })}>
              Add your first {type}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, items]) => (
            <section key={date} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">
                    {format(parseISO(date), "EEEE, MMMM d, yyyy")}
                  </h2>
                  <Link
                    to="/"
                    search={{ date }}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors"
                    title="View this day on the money tree"
                  >
                    <TreePine className="size-3 text-income" />
                    <span>View day on tree</span>
                  </Link>
                </div>
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
