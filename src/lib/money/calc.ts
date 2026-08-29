import { addDays, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import type { Debt, Filters, MoneyState, Transaction, ViewMode } from "./types";

export const ISO = "yyyy-MM-dd";

export function todayISO() {
  return format(new Date(), ISO);
}

export function formatMoney(amount: number, currency = "₹") {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(Math.round(amount));
  return `${sign}${currency}${abs.toLocaleString("en-IN")}`;
}

export function formatCompact(amount: number, currency = "₹") {
  const abs = Math.abs(amount);
  if (abs >= 10000000) return `${currency}${(amount / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${currency}${(amount / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${currency}${(amount / 1000).toFixed(1)}k`;
  return formatMoney(amount, currency);
}

export function formatDayLabel(date: string) {
  return format(parseISO(date), "MMM d").toUpperCase();
}

export function formatFullDate(date: string) {
  return format(parseISO(date), "MMMM d, yyyy");
}

export function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export interface DaySummary {
  date: string;
  opening: number;
  income: number;
  spent: number;
  closing: number;
  transactions: Transaction[];
}

export function sortTx(txs: Transaction[]) {
  return [...txs].sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
  );
}

/** Continuous day-by-day money flow from the starting balance forward. */
export function buildDays(state: MoneyState, txs?: Transaction[]): DaySummary[] {
  const list = sortTx(txs ?? state.transactions);
  const dates = Array.from(new Set(list.map((t) => t.date))).sort();
  if (dates.length === 0) return [];
  let running = state.startingBalance;
  return dates.map((date) => {
    const dayTx = list.filter((t) => t.date === date);
    const income = sum(dayTx.filter((t) => t.type === "income").map((t) => t.amount));
    const spent = sum(dayTx.filter((t) => t.type === "expense").map((t) => t.amount));
    const opening = running;
    const closing = opening + income - spent;
    running = closing;
    return { date, opening, income, spent, closing, transactions: dayTx };
  });
}

export function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

export function currentBalance(state: MoneyState) {
  const income = sum(state.transactions.filter((t) => t.type === "income").map((t) => t.amount));
  const spent = sum(state.transactions.filter((t) => t.type === "expense").map((t) => t.amount));
  return state.startingBalance + income - spent;
}

export function balanceOn(state: MoneyState, date: string) {
  const days = buildDays(state);
  const before = days.filter((d) => d.date <= date);
  return before.length ? before[before.length - 1].closing : state.startingBalance;
}

export function openingOn(state: MoneyState, date: string) {
  const days = buildDays(state);
  const day = days.find((d) => d.date === date);
  if (day) return day.opening;
  return balanceOn(state, date);
}

export function categoryTotals(txs: Transaction[], type: "expense" | "income" = "expense") {
  const map = new Map<string, { category: string; total: number; count: number }>();
  txs
    .filter((t) => t.type === type)
    .forEach((t) => {
      const entry = map.get(t.category) ?? { category: t.category, total: 0, count: 0 };
      entry.total += t.amount;
      entry.count += 1;
      map.set(t.category, entry);
    });
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}

export function periodRange(view: ViewMode, anchor: string): { from: string; to: string } {
  const d = parseISO(anchor);
  if (view === "day") return { from: anchor, to: anchor };
  if (view === "week") {
    const start = startOfWeek(d, { weekStartsOn: 1 });
    return { from: format(start, ISO), to: format(addDays(start, 6), ISO) };
  }
  if (view === "month") {
    const start = startOfMonth(d);
    return { from: format(start, ISO), to: format(addDays(startOfMonth(addDays(start, 40)), -1), ISO) };
  }
  return { from: `${format(d, "yyyy")}-01-01`, to: `${format(d, "yyyy")}-12-31` };
}

export function applyFilters(txs: Transaction[], f: Filters) {
  const q = f.query.trim().toLowerCase();
  return txs.filter((t) => {
    if (f.type !== "all" && t.type !== f.type) return false;
    if (f.categories.length && !f.categories.includes(t.category)) return false;
    if (f.paymentMethods.length && !f.paymentMethods.includes(t.paymentMethod)) return false;
    if (f.minAmount != null && t.amount < f.minAmount) return false;
    if (f.maxAmount != null && t.amount > f.maxAmount) return false;
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (q) {
      const haystack = [
        t.category,
        t.subcategory,
        t.description,
        t.merchant,
        t.paymentMethod,
        t.notes,
        String(t.amount),
        formatFullDate(t.date),
        formatDayLabel(t.date),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q.replace("₹", ""))) return false;
    }
    return true;
  });
}

export function debtTotals(debts: Debt[]) {
  const pending = debts.filter((d) => d.status === "pending");
  return {
    owedToMe: sum(pending.filter((d) => d.direction === "owed_to_me").map((d) => d.amount)),
    iOwe: sum(pending.filter((d) => d.direction === "i_owe").map((d) => d.amount)),
    pendingCount: pending.length,
  };
}

export interface BranchStats {
  total: number;
  share: number;
  count: number;
  average: number;
  largest: number;
  smallest: number;
  changePct: number | null;
}

export function branchStats(
  txs: Transaction[],
  allTxs: Transaction[],
  previousTxs?: Transaction[],
): BranchStats {
  const amounts = txs.map((t) => t.amount);
  const total = sum(amounts);
  const totalAll = sum(allTxs.filter((t) => t.type === "expense").map((t) => t.amount));
  const prevTotal = previousTxs ? sum(previousTxs.map((t) => t.amount)) : null;
  return {
    total,
    share: totalAll > 0 ? (total / totalAll) * 100 : 0,
    count: txs.length,
    average: amounts.length ? total / amounts.length : 0,
    largest: amounts.length ? Math.max(...amounts) : 0,
    smallest: amounts.length ? Math.min(...amounts) : 0,
    changePct: prevTotal && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null,
  };
}

export function averageDailySpend(state: MoneyState) {
  const days = buildDays(state);
  if (!days.length) return 0;
  return sum(days.map((d) => d.spent)) / days.length;
}

export interface ForecastPoint {
  date: string;
  balance: number;
}

export function forecast(state: MoneyState, horizonDays: number): ForecastPoint[] {
  const perDay = averageDailySpend(state);
  const days = buildDays(state);
  const last = days.length ? days[days.length - 1].date : todayISO();
  let balance = currentBalance(state);
  const points: ForecastPoint[] = [];
  for (let i = 1; i <= horizonDays; i++) {
    balance -= perDay;
    points.push({ date: format(addDays(parseISO(last), i), ISO), balance });
  }
  return points;
}

export function daysUntilBelow(state: MoneyState, threshold: number) {
  const perDay = averageDailySpend(state);
  if (perDay <= 0) return null;
  const balance = currentBalance(state);
  if (balance <= threshold) return 0;
  return Math.floor((balance - threshold) / perDay);
}
