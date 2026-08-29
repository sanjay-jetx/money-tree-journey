import { format } from "date-fns";
import {
  ISO,
  averageDailySpend,
  currentBalance,
  debtTotals,
  formatMoney,
  sum,
} from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";

export function StatsBar() {
  const { state } = useMoney();
  const monthPrefix = format(new Date(), "yyyy-MM");
  const monthTx = state.transactions.filter((t) => t.date.startsWith(monthPrefix));
  const spent = sum(monthTx.filter((t) => t.type === "expense").map((t) => t.amount));
  const received = sum(monthTx.filter((t) => t.type === "income").map((t) => t.amount));
  const savingsRate = received > 0 ? ((received - spent) / received) * 100 : 0;
  const debts = debtTotals(state.debts);
  void ISO;

  const items = [
    {
      label: "Current balance",
      value: formatMoney(currentBalance(state), state.currency),
      tone: "text-balance",
    },
    {
      label: "Spent this month",
      value: formatMoney(spent, state.currency),
      tone: "text-expense",
    },
    {
      label: "Received this month",
      value: formatMoney(received, state.currency),
      tone: "text-income",
    },
    {
      label: "Savings rate",
      value: `${savingsRate.toFixed(0)}%`,
      tone: savingsRate >= 0 ? "text-income" : "text-expense",
    },
    {
      label: "Avg daily spend",
      value: formatMoney(averageDailySpend(state), state.currency),
      tone: "text-foreground",
    },
    {
      label: "Pending with people",
      value: formatMoney(debts.owedToMe - debts.iOwe, state.currency),
      tone: "text-pending",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="card-soft px-5 py-5"
        >
          <div className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {item.label}
          </div>
          <div className={`stat-figure mt-2.5 text-[26px] leading-none ${item.tone}`}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
