import { addDays, format, subDays } from "date-fns";
import { DEFAULT_BUDGET_CONFIG, EMPTY_BUDGET_CONFIG } from "./budget";
import { ISO } from "./calc";
import type { Debt, Goal, Investment, MoneyState, PaymentMethod, Transaction } from "./types";

let seed = 20260829;
function rnd() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)] as T;
}
function id(prefix: string) {
  return `${prefix}_${Math.floor(rnd() * 1e9).toString(36)}${Date.now().toString(36).slice(-4)}`;
}

interface Template {
  category: string;
  subcategory: string;
  merchant: string;
  min: number;
  max: number;
  time: string;
  weight: number;
}

const EXPENSE_TEMPLATES: Template[] = [
  { category: "Food", subcategory: "Lunch", merchant: "Campus Canteen", min: 90, max: 220, time: "13:15", weight: 5 },
  { category: "Food", subcategory: "Snacks", merchant: "Tea Point", min: 30, max: 90, time: "17:40", weight: 4 },
  { category: "Food", subcategory: "Dinner", merchant: "Zomato", min: 180, max: 420, time: "20:45", weight: 2 },
  { category: "Food", subcategory: "Coffee", merchant: "Third Wave", min: 120, max: 260, time: "10:20", weight: 2 },
  { category: "Transport", subcategory: "Bus", merchant: "City Transit", min: 20, max: 60, time: "08:35", weight: 4 },
  { category: "Transport", subcategory: "Auto", merchant: "Auto Stand", min: 60, max: 160, time: "19:10", weight: 3 },
  { category: "Transport", subcategory: "Metro", merchant: "Metro Rail", min: 30, max: 80, time: "09:05", weight: 2 },
  { category: "Education", subcategory: "Printing", merchant: "Xerox Hub", min: 30, max: 120, time: "11:30", weight: 2 },
  { category: "Education", subcategory: "Stationery", merchant: "Book Corner", min: 60, max: 220, time: "16:05", weight: 1 },
  { category: "Shopping", subcategory: "Clothes", merchant: "Urban Threads", min: 400, max: 1400, time: "18:20", weight: 1 },
  { category: "Shopping", subcategory: "Gadgets", merchant: "Tech Bazaar", min: 300, max: 1600, time: "15:50", weight: 1 },
  { category: "Bills", subcategory: "Mobile", merchant: "Airtel", min: 199, max: 399, time: "09:40", weight: 1 },
  { category: "Bills", subcategory: "Subscriptions", merchant: "Spotify", min: 119, max: 199, time: "07:55", weight: 1 },
  { category: "Entertainment", subcategory: "Movies", merchant: "PVR", min: 250, max: 600, time: "21:10", weight: 1 },
  { category: "Entertainment", subcategory: "Outing", merchant: "Riverside Cafe", min: 200, max: 700, time: "19:35", weight: 1 },
  { category: "Health", subcategory: "Medicine", merchant: "Apollo Pharmacy", min: 80, max: 340, time: "12:25", weight: 1 },
];

const METHODS: PaymentMethod[] = ["GPay", "Cash", "Card", "UPI" as PaymentMethod, "Bank"];
const SAFE_METHODS: PaymentMethod[] = ["GPay", "Cash", "Card", "Bank", "Other"];

function weighted(): Template {
  const pool: Template[] = [];
  EXPENSE_TEMPLATES.forEach((t) => {
    for (let i = 0; i < t.weight; i++) pool.push(t);
  });
  return pick(pool);
}

export function createDemoState(): MoneyState {
  seed = 20260829;
  void METHODS;
  const days = 18;
  const start = subDays(new Date(), days - 1);
  const startDate = format(start, ISO);
  const transactions: Transaction[] = [];

  for (let i = 0; i < days; i++) {
    const date = format(addDays(start, i), ISO);
    const weekday = addDays(start, i).getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const count = Math.max(1, Math.round((isWeekend ? 4.4 : 3.1) * (0.7 + rnd() * 0.8)));
    const used = new Set<string>();
    for (let j = 0; j < count; j++) {
      const t = weighted();
      const key = `${t.category}-${t.subcategory}`;
      if (used.has(key) && rnd() > 0.35) continue;
      used.add(key);
      const boost = isWeekend ? 1.25 : 1;
      const amount = Math.round((t.min + rnd() * (t.max - t.min)) * boost);
      const minute = Math.floor(rnd() * 50);
      transactions.push({
        id: id("tx"),
        type: "expense",
        amount,
        category: t.category,
        subcategory: t.subcategory,
        merchant: t.merchant,
        description: `${t.subcategory} at ${t.merchant}`,
        paymentMethod: pick(SAFE_METHODS),
        date,
        time: `${t.time.slice(0, 2)}:${String(minute).padStart(2, "0")}`,
        notes: rnd() > 0.82 ? "Demo entry" : undefined,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const incomeDays = [1, 6, 11, 15];
  const incomes: Array<{ category: string; sub: string; amount: number; merchant: string }> = [
    { category: "Scholarship", sub: "Stipend", amount: 6000, merchant: "College Office" },
    { category: "Freelance", sub: "Project", amount: 4500, merchant: "Design Client" },
    { category: "Allowance", sub: "Family", amount: 3000, merchant: "Home" },
    { category: "Refund", sub: "", amount: 1200, merchant: "Amazon" },
  ];
  incomeDays.forEach((offset, index) => {
    const item = incomes[index]!;
    transactions.push({
      id: id("tx"),
      type: "income",
      amount: item.amount,
      category: item.category,
      subcategory: item.sub || undefined,
      merchant: item.merchant,
      description: `${item.category} received`,
      paymentMethod: "Bank",
      date: format(addDays(start, offset), ISO),
      time: "10:00",
      createdAt: new Date().toISOString(),
    });
  });

  const debts: Debt[] = [
    {
      id: id("debt"),
      person: "Arun",
      amount: 500,
      date: format(addDays(start, 4), ISO),
      direction: "owed_to_me",
      reason: "Movie tickets",
      status: "pending",
    },
    {
      id: id("debt"),
      person: "Rahul",
      amount: 300,
      date: format(addDays(start, 9), ISO),
      direction: "i_owe",
      reason: "Borrowed for lunch",
      status: "pending",
    },
    {
      id: id("debt"),
      person: "Meera",
      amount: 1200,
      date: format(addDays(start, 2), ISO),
      direction: "owed_to_me",
      reason: "Shared textbook order",
      status: "paid",
    },
  ];

  const investments: Investment[] = [
    {
      id: id("inv"),
      name: "Sovereign gold bond",
      kind: "gold",
      principal: 15000,
      annualRate: 8.5,
      interestMode: "compound",
      startDate: format(subDays(new Date(), 420), ISO),
      notes: "Yearly interest credited to bank",
    },
    {
      id: id("inv"),
      name: "Index fund SIP",
      kind: "mutual_fund",
      principal: 12000,
      annualRate: 12,
      interestMode: "compound",
      startDate: format(subDays(new Date(), 240), ISO),
    },
    {
      id: id("inv"),
      name: "Bank fixed deposit",
      kind: "fd",
      principal: 20000,
      annualRate: 7.1,
      interestMode: "simple",
      startDate: format(subDays(new Date(), 150), ISO),
    },
  ];

  const goals: Goal[] = [
    {
      id: id("goal"),
      name: "New Laptop",
      targetAmount: 70000,
      savedAmount: 45000,
      targetDate: format(addDays(new Date(), 120), ISO),
      description: "For design and dev work",
      createdAt: new Date().toISOString(),
    },
    {
      id: id("goal"),
      name: "Emergency fund",
      targetAmount: 50000,
      savedAmount: 50000,
      targetDate: format(addDays(new Date(), 60), ISO),
      createdAt: new Date().toISOString(),
    },
    {
      id: id("goal"),
      name: "Goa trip",
      targetAmount: 20000,
      savedAmount: 8000,
      targetDate: format(subDays(new Date(), 15), ISO),
      description: "Missed the deadline — reschedule",
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    startingBalance: 10000,
    startDate,
    currency: "₹",
    overdraft: false,
    isDemo: true,
    theme: "light",
    accent: "copper",
    accentIntensity: 3,
    transactions,
    debts,
    investments,
    goals,
    budgetConfig: DEFAULT_BUDGET_CONFIG,
  };
}

export function createEmptyState(): MoneyState {
  return {
    startingBalance: 0,
    startDate: format(new Date(), ISO),
    currency: "₹",
    overdraft: false,
    isDemo: false,
    theme: "light",
    accent: "copper",
    accentIntensity: 3,
    transactions: [],
    debts: [],
    investments: [],
    goals: [],
    budgetConfig: EMPTY_BUDGET_CONFIG,
  };
}
