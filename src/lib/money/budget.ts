import {
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDate,
  getDaysInMonth,
  isSameMonth,
  parse,
  parseISO,
  startOfMonth,
} from "date-fns";
import { sum } from "./calc";
import { ALL_CATEGORIES, categoryDef } from "./types";
import type { BudgetConfig, MoneyState } from "./types";

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  overallSpendLimit: 14000,
  savingsTarget: 5000,
  categoryBudgets: {
    Food: 4500,
    Transport: 1500,
    Shopping: 2500,
    Bills: 1500,
    Entertainment: 1200,
    Health: 800,
  },
};

export const EMPTY_BUDGET_CONFIG: BudgetConfig = {
  overallSpendLimit: 0,
  savingsTarget: 0,
  categoryBudgets: {},
};

export function parseMonthKey(monthKey: string): Date {
  return parse(`${monthKey}-01`, "yyyy-MM-dd", new Date());
}

export function formatMonthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

export function resolveMonthBudget(
  config: BudgetConfig | undefined,
  monthKey: string,
): {
  overallSpendLimit: number;
  savingsTarget: number;
  categoryBudgets: Record<string, number>;
  isOverridden: boolean;
} {
  const base = config ?? DEFAULT_BUDGET_CONFIG;
  const override = base.monthOverrides?.[monthKey];

  return {
    overallSpendLimit: override?.overallSpendLimit ?? base.overallSpendLimit,
    savingsTarget: override?.savingsTarget ?? base.savingsTarget,
    categoryBudgets: {
      ...base.categoryBudgets,
      ...(override?.categoryBudgets ?? {}),
    },
    isOverridden: Boolean(override),
  };
}

export interface CategoryBudgetStatus {
  category: string;
  icon: string;
  budget: number;
  spent: number;
  remaining: number;
  pct: number;
  status: "ok" | "warning" | "exceeded" | "unbudgeted";
  txCount: number;
}

export interface MonthlyBudgetSummary {
  monthKey: string;
  monthLabel: string;
  isCurrentMonth: boolean;
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;

  // Spending tracking
  totalSpend: number;
  overallSpendLimit: number;
  spendRemaining: number;
  spendPct: number;
  dailySpendSoFar: number;
  dailySafeAllowance: number;
  isOverBudget: boolean;
  overspendAmount: number;

  // Savings tracking
  totalIncome: number;
  netSavingsSoFar: number;
  savingsTarget: number;
  savingsPct: number;
  savingsRate: number;
  savingsRemaining: number;
  isSavingsGoalMet: boolean;

  // Categories
  categoryStatuses: CategoryBudgetStatus[];
  totalCategoryBudgets: number;
  budgetHealth: "healthy" | "caution" | "critical";
}

export function calcMonthlyBudgetSummary(
  state: MoneyState,
  monthKey: string,
): MonthlyBudgetSummary {
  const monthDate = parseMonthKey(monthKey);
  const monthLabel = format(monthDate, "MMMM yyyy");
  const now = new Date();
  const isCurrentMonth = isSameMonth(monthDate, now);

  const totalDays = getDaysInMonth(monthDate);
  const daysElapsed = isCurrentMonth
    ? getDate(now)
    : monthDate > now
      ? 0
      : totalDays;
  const daysRemaining = Math.max(1, totalDays - daysElapsed);

  // Month transactions
  const monthTxs = state.transactions.filter((t) => t.date.startsWith(monthKey));
  const expenseTxs = monthTxs.filter((t) => t.type === "expense");
  const incomeTxs = monthTxs.filter((t) => t.type === "income");

  const totalSpend = sum(expenseTxs.map((t) => t.amount));
  const totalIncome = sum(incomeTxs.map((t) => t.amount));
  const netSavingsSoFar = totalIncome - totalSpend;

  // Resolved budget
  const resolved = resolveMonthBudget(state.budgetConfig, monthKey);
  const overallSpendLimit = resolved.overallSpendLimit;
  const savingsTarget = resolved.savingsTarget;

  const spendRemaining = Math.max(0, overallSpendLimit - totalSpend);
  const isOverBudget = overallSpendLimit > 0 && totalSpend > overallSpendLimit;
  const overspendAmount = Math.max(0, totalSpend - overallSpendLimit);
  const spendPct =
    overallSpendLimit > 0 ? (totalSpend / overallSpendLimit) * 100 : 0;

  const dailySpendSoFar = totalSpend / Math.max(1, daysElapsed);
  const dailySafeAllowance =
    overallSpendLimit > 0 ? spendRemaining / daysRemaining : 0;

  const savingsPct =
    savingsTarget > 0 ? (netSavingsSoFar / savingsTarget) * 100 : 0;
  const savingsRate =
    totalIncome > 0 ? Math.max(0, (netSavingsSoFar / totalIncome) * 100) : 0;
  const savingsRemaining = Math.max(0, savingsTarget - netSavingsSoFar);
  const isSavingsGoalMet = savingsTarget > 0 && netSavingsSoFar >= savingsTarget;

  // Category breakdown
  const categoryMap = new Map<string, { spent: number; count: number }>();
  expenseTxs.forEach((t) => {
    const entry = categoryMap.get(t.category) ?? { spent: 0, count: 0 };
    entry.spent += t.amount;
    entry.count += 1;
    categoryMap.set(t.category, entry);
  });

  // Combine categories defined in budget + categories spent in this month
  const categoryKeys = Array.from(
    new Set([
      ...Object.keys(resolved.categoryBudgets),
      ...Array.from(categoryMap.keys()),
    ]),
  );

  const categoryStatuses: CategoryBudgetStatus[] = categoryKeys.map((catName) => {
    const def = categoryDef(catName);
    const budget = resolved.categoryBudgets[catName] ?? 0;
    const catData = categoryMap.get(catName) ?? { spent: 0, count: 0 };
    const spent = catData.spent;
    const remaining = budget > 0 ? budget - spent : 0;
    const pct = budget > 0 ? (spent / budget) * 100 : 0;

    let status: "ok" | "warning" | "exceeded" | "unbudgeted" = "ok";
    if (budget === 0 && spent > 0) {
      status = "unbudgeted";
    } else if (budget > 0) {
      if (spent > budget) status = "exceeded";
      else if (pct >= 80) status = "warning";
      else status = "ok";
    }

    return {
      category: catName,
      icon: def.icon,
      budget,
      spent,
      remaining,
      pct,
      status,
      txCount: catData.count,
    };
  });

  // Sort categories: exceeded/warning first, then highest spend
  categoryStatuses.sort((a, b) => {
    const score = (s: CategoryBudgetStatus) => {
      if (s.status === "exceeded") return 4;
      if (s.status === "warning") return 3;
      if (s.budget > 0) return 2;
      return 1;
    };
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return b.spent - a.spent;
  });

  const totalCategoryBudgets = sum(
    Object.values(resolved.categoryBudgets).filter((v) => typeof v === "number"),
  );

  // Overall health score
  let budgetHealth: "healthy" | "caution" | "critical" = "healthy";
  if (isOverBudget || spendPct >= 100) {
    budgetHealth = "critical";
  } else if (spendPct >= 80) {
    budgetHealth = "caution";
  } else {
    budgetHealth = "healthy";
  }

  return {
    monthKey,
    monthLabel,
    isCurrentMonth,
    daysInMonth: totalDays,
    daysElapsed,
    daysRemaining,
    totalSpend,
    overallSpendLimit,
    spendRemaining,
    spendPct,
    dailySpendSoFar,
    dailySafeAllowance,
    isOverBudget,
    overspendAmount,
    totalIncome,
    netSavingsSoFar,
    savingsTarget,
    savingsPct,
    savingsRate,
    savingsRemaining,
    isSavingsGoalMet,
    categoryStatuses,
    totalCategoryBudgets,
    budgetHealth,
  };
}
