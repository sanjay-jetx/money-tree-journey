import { createFileRoute } from "@tanstack/react-router";
import { addMonths, format, subMonths } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Pencil,
  PiggyBank,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calcMonthlyBudgetSummary,
  formatMonthKey,
  parseMonthKey,
} from "@/lib/money/budget";
import type { CategoryBudgetStatus } from "@/lib/money/budget";
import { formatMoney } from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";
import { EXPENSE_CATEGORIES } from "@/lib/money/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "Budget & Goals — MoneyTree" },
      {
        name: "description",
        content:
          "Set monthly spending limits and savings goals, and track how much you have spent or saved in real time.",
      },
      { property: "og:title", content: "Budget & Goals — MoneyTree" },
      {
        property: "og:description",
        content:
          "Take control of your monthly finances with category budgets, savings milestones and daily burn tracking.",
      },
    ],
  }),
  component: BudgetPage,
});

function BudgetPage() {
  const {
    state,
    ready,
    setMonthlyGoals,
    setCategoryBudget,
    removeCategoryBudget,
  } = useMoney();

  // Current selected month
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() =>
    formatMonthKey(new Date()),
  );
  const [categoryFilter, setCategoryFilter] = useState<"all" | "budgeted" | "attention">("all");

  // Goals Modal state
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false);
  const [spendLimitDraft, setSpendLimitDraft] = useState("");
  const [savingsTargetDraft, setSavingsTargetDraft] = useState("");
  const [applyMonthScope, setApplyMonthScope] = useState<"current" | "all">("all");

  // Category Edit Modal state
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string>("");
  const [catBudgetDraft, setCatBudgetDraft] = useState("");

  const summary = useMemo(() => {
    if (!ready) return null;
    return calcMonthlyBudgetSummary(state, selectedMonthKey);
  }, [state, ready, selectedMonthKey]);

  const currentMonthKey = formatMonthKey(new Date());
  const isViewingCurrentMonth = selectedMonthKey === currentMonthKey;

  // Month navigation
  function prevMonth() {
    const d = parseMonthKey(selectedMonthKey);
    setSelectedMonthKey(formatMonthKey(subMonths(d, 1)));
  }

  function nextMonth() {
    const d = parseMonthKey(selectedMonthKey);
    setSelectedMonthKey(formatMonthKey(addMonths(d, 1)));
  }

  function jumpToCurrentMonth() {
    setSelectedMonthKey(currentMonthKey);
  }

  // Open Main Goals Dialog
  function openGoalsDialog() {
    if (!summary) return;
    setSpendLimitDraft(summary.overallSpendLimit > 0 ? String(summary.overallSpendLimit) : "");
    setSavingsTargetDraft(summary.savingsTarget > 0 ? String(summary.savingsTarget) : "");
    setApplyMonthScope(summary.isCurrentMonth ? "all" : "current");
    setIsGoalsModalOpen(true);
  }

  function saveGoals() {
    const spendLimit = Number(spendLimitDraft) || 0;
    const savingsTarget = Number(savingsTargetDraft) || 0;
    const monthKey = applyMonthScope === "current" ? selectedMonthKey : undefined;

    setMonthlyGoals(spendLimit, savingsTarget, undefined, monthKey);
    setIsGoalsModalOpen(false);
  }

  // Preset 50/30/20 Rule: 80% spend, 20% savings based on current income
  function apply503020Rule() {
    if (!summary) return;
    const income = summary.totalIncome > 0 ? summary.totalIncome : 25000;
    const targetSavings = Math.round(income * 0.2);
    const targetSpend = Math.round(income * 0.8);
    setSpendLimitDraft(String(targetSpend));
    setSavingsTargetDraft(String(targetSavings));
  }

  // Category budget actions
  function openAddCategoryDialog(category?: string, currentLimit?: number) {
    setEditingCategory(category ?? EXPENSE_CATEGORIES[0]!.name);
    setCatBudgetDraft(currentLimit && currentLimit > 0 ? String(currentLimit) : "");
    setIsCatModalOpen(true);
  }

  function saveCategoryBudget() {
    if (!editingCategory) return;
    const limit = Number(catBudgetDraft) || 0;
    const monthKey = applyMonthScope === "current" ? selectedMonthKey : undefined;
    setCategoryBudget(editingCategory, limit, monthKey);
    setIsCatModalOpen(false);
  }

  function deleteCatBudget(category: string) {
    const monthKey = applyMonthScope === "current" ? selectedMonthKey : undefined;
    removeCategoryBudget(category, monthKey);
  }

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!summary) return [];
    if (categoryFilter === "budgeted") {
      return summary.categoryStatuses.filter((c) => c.budget > 0);
    }
    if (categoryFilter === "attention") {
      return summary.categoryStatuses.filter(
        (c) => c.status === "warning" || c.status === "exceeded" || (c.status === "unbudgeted" && c.spent > 0),
      );
    }
    return summary.categoryStatuses;
  }, [summary, categoryFilter]);

  if (!ready || !summary) {
    return (
      <div className="flex h-96 items-center justify-center p-6 text-muted-foreground">
        Loading budget data...
      </div>
    );
  }

  const {
    monthLabel,
    totalSpend,
    overallSpendLimit,
    spendRemaining,
    spendPct,
    dailySafeAllowance,
    dailySpendSoFar,
    isOverBudget,
    overspendAmount,
    totalIncome,
    netSavingsSoFar,
    savingsTarget,
    savingsPct,
    savingsRate,
    savingsRemaining,
    isSavingsGoalMet,
    daysRemaining,
    isCurrentMonth,
  } = summary;

  // Visual status pill
  const getStatusColor = (status: CategoryBudgetStatus["status"]) => {
    switch (status) {
      case "exceeded":
        return "bg-destructive/15 text-destructive border-destructive/30";
      case "warning":
        return "bg-pending/15 text-pending border-pending/30";
      case "ok":
        return "bg-income/15 text-income border-income/30";
      case "unbudgeted":
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusText = (cat: CategoryBudgetStatus) => {
    if (cat.status === "exceeded") return "Exceeded";
    if (cat.status === "warning") return "Near limit";
    if (cat.status === "ok") return "On track";
    return "No limit set";
  };

  return (
    <div className="space-y-7 p-4 lg:p-7 max-w-7xl mx-auto">
      {/* Header & Month Navigator */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="accent-gradient flex size-9 items-center justify-center rounded-xl text-lg shadow-sm">
              🎯
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl font-display">
              Budget & Goals
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Set monthly targets and track how much you have spent or saved so far.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Month Switcher */}
          <div className="flex items-center rounded-2xl border border-border bg-surface/80 p-1 backdrop-blur shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl hover:bg-surface-2"
              onClick={prevMonth}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-2 px-2.5 py-1 text-xs font-semibold">
              <Calendar className="size-3.5 text-muted-foreground" />
              <span>{monthLabel}</span>
              {isCurrentMonth && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                  Current
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl hover:bg-surface-2"
              onClick={nextMonth}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {!isViewingCurrentMonth && (
            <Button
              variant="outline"
              size="sm"
              onClick={jumpToCurrentMonth}
              className="rounded-2xl text-xs h-9"
            >
              Jump to This Month
            </Button>
          )}

          <Button
            onClick={openGoalsDialog}
            className="accent-gradient gap-1.5 rounded-2xl text-xs sm:text-sm font-semibold shadow-[0_10px_20px_-8px_var(--glow)] h-9"
          >
            <Target className="size-4" />
            Edit Monthly Goals
          </Button>
        </div>
      </header>

      {/* Hero Stats Grid: 4 Metric Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Monthly Spending Progress */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface/75 p-5 backdrop-blur transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Monthly Spend
            </span>
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                isOverBudget
                  ? "bg-destructive/15 text-destructive border-destructive/30"
                  : spendPct >= 80
                    ? "bg-pending/15 text-pending border-pending/30"
                    : "bg-income/15 text-income border-income/30",
              )}
            >
              {isOverBudget ? (
                <>
                  <AlertTriangle className="size-3" /> Over budget
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3" /> {spendPct.toFixed(0)}% used
                </>
              )}
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="num text-2xl font-bold tracking-tight lg:text-3xl">
              {formatMoney(totalSpend, state.currency)}
            </span>
            <span className="text-xs text-muted-foreground">
              / {overallSpendLimit > 0 ? formatMoney(overallSpendLimit, state.currency) : "No limit"}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isOverBudget
                  ? "bg-destructive"
                  : spendPct >= 80
                    ? "bg-pending"
                    : "accent-gradient",
              )}
              style={{ width: `${Math.min(100, overallSpendLimit > 0 ? spendPct : 0)}%` }}
            />
          </div>

          <p className="mt-2.5 text-xs text-muted-foreground">
            {overallSpendLimit === 0 ? (
              <span className="italic">Click "Edit Monthly Goals" to set a limit</span>
            ) : isOverBudget ? (
              <span className="font-semibold text-destructive">
                Exceeded by {formatMoney(overspendAmount, state.currency)}
              </span>
            ) : (
              <span>
                <strong className="text-foreground font-semibold">
                  {formatMoney(spendRemaining, state.currency)}
                </strong>{" "}
                safe to spend
              </span>
            )}
          </p>
        </div>

        {/* Card 2: Net Saved So Far */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface/75 p-5 backdrop-blur transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Net Saved So Far
            </span>
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                isSavingsGoalMet
                  ? "bg-income/15 text-income border-income/30"
                  : netSavingsSoFar > 0
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-muted text-muted-foreground border-border",
              )}
            >
              <PiggyBank className="size-3" />
              {savingsRate > 0 ? `${savingsRate.toFixed(1)}% rate` : "0% rate"}
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={cn(
                "num text-2xl font-bold tracking-tight lg:text-3xl",
                netSavingsSoFar >= 0 ? "text-income" : "text-destructive",
              )}
            >
              {netSavingsSoFar >= 0 ? "+" : ""}
              {formatMoney(netSavingsSoFar, state.currency)}
            </span>
            <span className="text-xs text-muted-foreground">
              / {savingsTarget > 0 ? formatMoney(savingsTarget, state.currency) : "No target"}
            </span>
          </div>

          {/* Progress bar towards savings goal */}
          <div className="mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-income transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, savingsTarget > 0 ? savingsPct : 0))}%`,
              }}
            />
          </div>

          <p className="mt-2.5 text-xs text-muted-foreground">
            {savingsTarget === 0 ? (
              <span className="italic">Set a savings target to track milestones</span>
            ) : isSavingsGoalMet ? (
              <span className="font-semibold text-income">
                Goal achieved! 🎉 Saved {savingsPct.toFixed(0)}%
              </span>
            ) : (
              <span>
                <strong className="text-foreground font-semibold">
                  {formatMoney(savingsRemaining, state.currency)}
                </strong>{" "}
                more to reach target
              </span>
            )}
          </p>
        </div>

        {/* Card 3: Daily Safe Burn Rate */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface/75 p-5 backdrop-blur transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Daily Safe Spend
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
            </span>
          </div>

          <div className="mt-3">
            <div className="num text-2xl font-bold tracking-tight lg:text-3xl text-foreground">
              {overallSpendLimit > 0
                ? formatMoney(dailySafeAllowance, state.currency)
                : "—"}
              <span className="text-xs font-normal text-muted-foreground ml-1">/ day</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>Spent so far avg:</span>
            <span className="num font-semibold text-foreground">
              {formatMoney(dailySpendSoFar, state.currency)} / day
            </span>
          </div>
        </div>

        {/* Card 4: Monthly Cash Flow Velocity */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface/75 p-5 backdrop-blur transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Monthly Cash Flow
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Income {formatMoney(totalIncome, state.currency)}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1 text-expense">
                <TrendingDown className="size-3" /> Spent:
              </span>
              <span className="num font-semibold">
                {formatMoney(totalSpend, state.currency)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1 text-income">
                <TrendingUp className="size-3" /> Saved:
              </span>
              <span className="num font-semibold">
                {formatMoney(Math.max(0, netSavingsSoFar), state.currency)}
              </span>
            </div>
          </div>

          {/* Stacked visualization bar */}
          <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
            {totalIncome > 0 && (
              <>
                <div
                  className="h-full bg-expense"
                  style={{ width: `${Math.min(100, (totalSpend / totalIncome) * 100)}%` }}
                  title={`Spent: ${((totalSpend / totalIncome) * 100).toFixed(0)}%`}
                />
                <div
                  className="h-full bg-income"
                  style={{
                    width: `${Math.min(100, (Math.max(0, netSavingsSoFar) / totalIncome) * 100)}%`,
                  }}
                  title={`Saved: ${((Math.max(0, netSavingsSoFar) / totalIncome) * 100).toFixed(0)}%`}
                />
              </>
            )}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>
              {totalIncome > 0 ? `${((totalSpend / totalIncome) * 100).toFixed(0)}% spent` : "0%"}
            </span>
            <span>
              {totalIncome > 0
                ? `${((Math.max(0, netSavingsSoFar) / totalIncome) * 100).toFixed(0)}% saved`
                : "0%"}
            </span>
          </div>
        </div>
      </section>

      {/* Income & Spending Distribution Banner */}
      <section className="rounded-3xl border border-border bg-surface-2/40 p-5 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Monthly Goal Health & Projections
            </h2>
            <p className="text-xs text-muted-foreground">
              {isOverBudget
                ? `You have exceeded your spending budget by ${formatMoney(overspendAmount, state.currency)}. Slow down expenses to recover next month.`
                : overallSpendLimit > 0
                  ? `You are on track! If you keep daily spending under ${formatMoney(dailySafeAllowance, state.currency)}, you will finish within your budget.`
                  : "Set a spending limit and category limits to get real-time recommendations."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openAddCategoryDialog()}
              className="gap-1.5 rounded-2xl text-xs h-9 bg-surface"
            >
              <Plus className="size-3.5" />
              Add Category Budget
            </Button>
          </div>
        </div>
      </section>

      {/* Category Budget Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Category Allocations</h2>
            <p className="text-xs text-muted-foreground">
              Track spending per category against limits for {monthLabel}.
            </p>
          </div>

          <Tabs
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}
            className="w-auto"
          >
            <TabsList className="bg-surface border border-border rounded-2xl p-0.5 h-9">
              <TabsTrigger value="all" className="rounded-xl text-xs py-1 px-3">
                All Categories ({summary.categoryStatuses.length})
              </TabsTrigger>
              <TabsTrigger value="budgeted" className="rounded-xl text-xs py-1 px-3">
                Budgeted ({summary.categoryStatuses.filter((c) => c.budget > 0).length})
              </TabsTrigger>
              <TabsTrigger value="attention" className="rounded-xl text-xs py-1 px-3">
                Attention ({summary.categoryStatuses.filter((c) => c.status === "warning" || c.status === "exceeded").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border p-10 text-center bg-surface/40">
            <div className="text-3xl mb-2">🎯</div>
            <div className="font-semibold text-foreground text-sm">No category budgets found</div>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {categoryFilter === "budgeted"
                ? "You haven't set any specific category limits yet. Click '+ Add Category Budget' above to allocate limits."
                : "No categories match the active filter for this month."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openAddCategoryDialog()}
              className="mt-4 gap-1 rounded-2xl text-xs"
            >
              <Plus className="size-3.5" /> Set First Category Budget
            </Button>
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCategories.map((cat) => {
              const isExceeded = cat.status === "exceeded";
              const isWarning = cat.status === "warning";

              return (
                <div
                  key={cat.category}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-3xl border bg-surface/80 p-5 backdrop-blur transition-all duration-200 hover:shadow-md hover:border-border-strong",
                    isExceeded
                      ? "border-destructive/40 bg-destructive/5"
                      : isWarning
                        ? "border-pending/40 bg-pending/5"
                        : "border-border",
                  )}
                >
                  {/* Top line: Icon, Name, Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-2xl bg-surface-2 text-xl shadow-xs">
                          {cat.icon}
                        </span>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground leading-snug">
                            {cat.category}
                          </h3>
                          <span className="text-[11px] text-muted-foreground">
                            {cat.txCount} {cat.txCount === 1 ? "expense" : "expenses"}
                          </span>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                          getStatusColor(cat.status),
                        )}
                      >
                        {getStatusText(cat)}
                      </span>
                    </div>

                    {/* Spend figures */}
                    <div className="mt-4 flex items-baseline justify-between">
                      <div>
                        <span className="text-[11px] text-muted-foreground">Spent</span>
                        <div className="num font-bold text-lg text-foreground">
                          {formatMoney(cat.spent, state.currency)}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-muted-foreground">Limit</span>
                        <div className="num font-semibold text-sm text-muted-foreground">
                          {cat.budget > 0 ? formatMoney(cat.budget, state.currency) : "No limit"}
                        </div>
                      </div>
                    </div>

                    {/* Category progress bar */}
                    {cat.budget > 0 ? (
                      <div className="mt-3 space-y-1.5">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isExceeded
                                ? "bg-destructive"
                                : isWarning
                                  ? "bg-pending"
                                  : "bg-income",
                            )}
                            style={{ width: `${Math.min(100, cat.pct)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>{cat.pct.toFixed(0)}% used</span>
                          <span>
                            {isExceeded ? (
                              <span className="font-semibold text-destructive">
                                +{formatMoney(Math.abs(cat.remaining), state.currency)} over
                              </span>
                            ) : (
                              <span>{formatMoney(cat.remaining, state.currency)} left</span>
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl bg-surface-2/60 p-2 text-center text-[11px] text-muted-foreground">
                        Uncapped category · {formatMoney(cat.spent, state.currency)} spent
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openAddCategoryDialog(cat.category, cat.budget)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 rounded-xl"
                    >
                      <Pencil className="size-3" />
                      {cat.budget > 0 ? "Edit limit" : "Set limit"}
                    </Button>

                    {cat.budget > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCatBudget(cat.category)}
                        className="h-7 px-2 text-xs text-destructive/80 hover:text-destructive hover:bg-destructive/10 gap-1 rounded-xl"
                        title="Remove budget limit"
                      >
                        <Trash2 className="size-3" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Main Monthly Goals Dialog */}
      <Dialog open={isGoalsModalOpen} onOpenChange={setIsGoalsModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-display flex items-center gap-2">
              <span>🎯</span> Set Monthly Budget Goals
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define your monthly spending ceiling and how much you plan to save.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Quick 50/30/20 Preset */}
            <div className="rounded-2xl border border-border bg-surface-2/50 p-3.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" /> 50/30/20 Smart Preset
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Allocate 80% to spending and 20% to savings automatically.
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={apply503020Rule}
                className="text-xs shrink-0 rounded-xl h-8"
              >
                Apply
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="spendLimit" className="text-xs font-semibold">
                Monthly Spending Ceiling ({state.currency})
              </Label>
              <Input
                id="spendLimit"
                type="number"
                placeholder="e.g. 15000"
                value={spendLimitDraft}
                onChange={(e) => setSpendLimitDraft(e.target.value)}
                className="rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                Maximum expenses you wish to allow in a month.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="savingsTarget" className="text-xs font-semibold">
                Monthly Savings Goal ({state.currency})
              </Label>
              <Input
                id="savingsTarget"
                type="number"
                placeholder="e.g. 5000"
                value={savingsTargetDraft}
                onChange={(e) => setSavingsTargetDraft(e.target.value)}
                className="rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                Target amount you want left over as net savings (Income − Expenses).
              </p>
            </div>

            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold">Apply Scope</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setApplyMonthScope("all")}
                  className={cn(
                    "rounded-xl border p-2.5 text-left text-xs transition-colors",
                    applyMonthScope === "all"
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border bg-surface text-muted-foreground",
                  )}
                >
                  Default (All months)
                </button>
                <button
                  type="button"
                  onClick={() => setApplyMonthScope("current")}
                  className={cn(
                    "rounded-xl border p-2.5 text-left text-xs transition-colors",
                    applyMonthScope === "current"
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border bg-surface text-muted-foreground",
                  )}
                >
                  {monthLabel} only
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              variant="outline"
              onClick={() => setIsGoalsModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={saveGoals}
              className="accent-gradient rounded-xl shadow-sm"
            >
              Save Goals
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Edit Dialog */}
      <Dialog open={isCatModalOpen} onOpenChange={setIsCatModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-display flex items-center gap-2">
              <span>📊</span> Set Category Monthly Limit
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Cap monthly spending for a specific category.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="catSelect" className="text-xs font-semibold">
                Category
              </Label>
              <Select
                value={editingCategory}
                onValueChange={setEditingCategory}
              >
                <SelectTrigger id="catSelect" className="rounded-xl">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>
                      <span className="mr-2">{cat.icon}</span>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="catLimit" className="text-xs font-semibold">
                Monthly Limit ({state.currency})
              </Label>
              <Input
                id="catLimit"
                type="number"
                placeholder="e.g. 3000"
                value={catBudgetDraft}
                onChange={(e) => setCatBudgetDraft(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              variant="outline"
              onClick={() => setIsCatModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={saveCategoryBudget}
              className="accent-gradient rounded-xl shadow-sm"
            >
              Save Category Limit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
