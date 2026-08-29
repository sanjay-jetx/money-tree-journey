import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import {
  ISO,
  averageDailySpend,
  buildDays,
  categoryTotals,
  currentBalance,
  daysUntilBelow,
  formatMoney,
  sum,
} from "./calc";
import type { MoneyState, Transaction } from "./types";

export interface Insight {
  id: string;
  title: string;
  detail: string;
  tone: "income" | "expense" | "balance" | "pending" | "neutral";
  metric?: string | undefined;
}

function between(txs: Transaction[], from: string, to: string) {
  return txs.filter((t) => t.date >= from && t.date <= to);
}

function expenses(txs: Transaction[]) {
  return txs.filter((t) => t.type === "expense");
}

export function generateInsights(state: MoneyState): Insight[] {
  const txs = state.transactions;
  if (!txs.length) return [];
  const today = new Date();
  const iso = (d: Date) => format(d, ISO);
  const thisWeek = expenses(between(txs, iso(subDays(today, 6)), iso(today)));
  const lastWeek = expenses(between(txs, iso(subDays(today, 13)), iso(subDays(today, 7))));
  const monthStart = format(today, "yyyy-MM") + "-01";
  const monthTx = between(txs, monthStart, iso(today));
  const monthExp = expenses(monthTx);
  const monthIncome = monthTx.filter((t) => t.type === "income");
  const out: Insight[] = [];

  const weekTotal = sum(thisWeek.map((t) => t.amount));
  const lastTotal = sum(lastWeek.map((t) => t.amount));
  if (lastTotal > 0) {
    const change = ((weekTotal - lastTotal) / lastTotal) * 100;
    out.push({
      id: "week-change",
      title: change >= 0 ? "Spending is up this week" : "Spending is down this week",
      detail: `You spent ${formatMoney(weekTotal, state.currency)} in the last 7 days versus ${formatMoney(lastTotal, state.currency)} the week before.`,
      tone: change >= 0 ? "expense" : "income",
      metric: `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`,
    });
  }

  const avg = averageDailySpend(state);
  out.push({
    id: "daily-avg",
    title: "Average daily spending",
    detail: `Across ${buildDays(state).length} active days your money leaves the tree at a steady pace.`,
    tone: "neutral",
    metric: formatMoney(avg, state.currency),
  });

  const largest = [...monthExp].sort((a, b) => b.amount - a.amount)[0];
  if (largest) {
    out.push({
      id: "largest",
      title: "Largest expense this month",
      detail: `${largest.subcategory || largest.category} at ${largest.merchant ?? "unknown place"} on ${format(parseISO(largest.date), "MMM d")}.`,
      tone: "expense",
      metric: formatMoney(largest.amount, state.currency),
    });
  }

  out.push({
    id: "frequency",
    title: "Transaction frequency",
    detail: `You recorded ${monthExp.length} expenses and ${monthIncome.length} income entries this month.`,
    tone: "neutral",
    metric: `${monthTx.length} tx`,
  });

  const received = sum(monthIncome.map((t) => t.amount));
  const spentMonth = sum(monthExp.map((t) => t.amount));
  if (received + state.startingBalance > 0) {
    const retained = ((received - spentMonth) / Math.max(received, 1)) * 100;
    out.push({
      id: "savings",
      title: retained >= 0 ? "You are retaining money" : "You are spending your reserves",
      detail: `Received ${formatMoney(received, state.currency)} and spent ${formatMoney(spentMonth, state.currency)} this month.`,
      tone: retained >= 0 ? "income" : "expense",
      metric: `${retained.toFixed(0)}%`,
    });
  }

  const top = categoryTotals(monthExp)[0];
  if (top) {
    out.push({
      id: "top-category",
      title: `${top.category} is your biggest branch`,
      detail: `${top.count} transactions this month, ${((top.total / Math.max(spentMonth, 1)) * 100).toFixed(0)}% of everything you spent.`,
      tone: "expense",
      metric: formatMoney(top.total, state.currency),
    });
  }

  const small = thisWeek.filter((t) => t.amount < 100);
  if (small.length >= 3) {
    out.push({
      id: "small-purchases",
      title: "Frequent small purchases",
      detail: `${small.length} purchases under ${formatMoney(100, state.currency)} in the last 7 days add up quietly.`,
      tone: "pending",
      metric: formatMoney(
        sum(small.map((t) => t.amount)),
        state.currency,
      ),
    });
  }

  const hourBuckets = new Map<number, number>();
  expenses(txs).forEach((t) => {
    const hour = Number(t.time.slice(0, 2));
    hourBuckets.set(hour, (hourBuckets.get(hour) ?? 0) + 1);
  });
  const busiest = [...hourBuckets.entries()].sort((a, b) => b[1] - a[1])[0];
  if (busiest) {
    const h = busiest[0];
    const label = `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`;
    out.push({
      id: "time-of-day",
      title: "Your spending hour",
      detail: `Most of your transactions happen around ${label} — ${busiest[1]} of them so far.`,
      tone: "neutral",
      metric: label,
    });
  }

  const weekendExp = expenses(txs).filter((t) => [0, 6].includes(parseISO(t.date).getDay()));
  const weekdayExp = expenses(txs).filter((t) => ![0, 6].includes(parseISO(t.date).getDay()));
  const weekendDays = new Set(weekendExp.map((t) => t.date)).size || 1;
  const weekdayDays = new Set(weekdayExp.map((t) => t.date)).size || 1;
  const weekendAvg = sum(weekendExp.map((t) => t.amount)) / weekendDays;
  const weekdayAvg = sum(weekdayExp.map((t) => t.amount)) / weekdayDays;
  if (weekendAvg > weekdayAvg * 1.1) {
    out.push({
      id: "weekend",
      title: "Weekends cost you more",
      detail: `Weekend days average ${formatMoney(weekendAvg, state.currency)} against ${formatMoney(weekdayAvg, state.currency)} on weekdays.`,
      tone: "pending",
      metric: `+${(((weekendAvg - weekdayAvg) / Math.max(weekdayAvg, 1)) * 100).toFixed(0)}%`,
    });
  }

  const merchants = new Map<string, number>();
  expenses(txs).forEach((t) => {
    if (!t.merchant) return;
    merchants.set(t.merchant, (merchants.get(t.merchant) ?? 0) + 1);
  });
  const repeat = [...merchants.entries()].sort((a, b) => b[1] - a[1])[0];
  if (repeat && repeat[1] > 2) {
    out.push({
      id: "repeat-merchant",
      title: "A place you keep returning to",
      detail: `${repeat[0]} appears ${repeat[1]} times in your tree.`,
      tone: "neutral",
      metric: `${repeat[1]}×`,
    });
  }

  const runway = daysUntilBelow(state, 2000);
  if (runway != null) {
    out.push({
      id: "runway",
      title: "Low-balance projection",
      detail: `At your current pace your balance of ${formatMoney(currentBalance(state), state.currency)} may fall below ${formatMoney(2000, state.currency)}.`,
      tone: runway < 10 ? "expense" : "balance",
      metric: `${runway} days`,
    });
  }

  const days = buildDays(state);
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]!;
    if (d.spent > 0 && (i === days.length - 1 || differenceInCalendarDays(parseISO(days[i + 1]!.date), parseISO(d.date)) === 1)) {
      streak++;
    } else break;
  }
  if (streak >= 3) {
    out.push({
      id: "streak",
      title: "Spending streak",
      detail: "You have spent money on consecutive days without a no-spend break.",
      tone: "pending",
      metric: `${streak} days`,
    });
  }

  return out;
}
