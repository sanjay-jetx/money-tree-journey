export type TxType = "expense" | "income";
export type PaymentMethod = "Cash" | "GPay" | "Card" | "Bank" | "Other";
export type DebtDirection = "owed_to_me" | "i_owe";
export type DebtStatus = "pending" | "paid";
export type ViewMode = "day" | "week" | "month" | "year";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  subcategory?: string | undefined;
  description?: string | undefined;
  merchant?: string | undefined;
  paymentMethod: PaymentMethod;
  /** ISO date, yyyy-MM-dd */
  date: string;
  /** 24h clock, HH:mm */
  time: string;
  notes?: string | undefined;
  createdAt: string;
}

export interface Debt {
  id: string;
  person: string;
  amount: number;
  date: string;
  direction: DebtDirection;
  reason?: string | undefined;
  status: DebtStatus;
}

export interface MoneyState {
  startingBalance: number;
  startDate: string;
  currency: string;
  overdraft: boolean;
  isDemo: boolean;
  theme: "dark" | "light";
  accent: "copper" | "lavender" | "olive" | "teal" | "rose";
  accentIntensity: number;
  transactions: Transaction[];
  debts: Debt[];
}

export interface Filters {
  query: string;
  categories: string[];
  paymentMethods: PaymentMethod[];
  type: "all" | TxType;
  minAmount: number | null;
  maxAmount: number | null;
  from: string | null;
  to: string | null;
}

export interface CategoryDef {
  name: string;
  icon: string;
  kind: "expense" | "income";
  subcategories: string[];
}

export const EXPENSE_CATEGORIES: CategoryDef[] = [
  {
    name: "Food",
    icon: "🍔",
    kind: "expense",
    subcategories: ["Lunch", "Snacks", "Dinner", "Coffee", "Groceries"],
  },
  {
    name: "Transport",
    icon: "🚌",
    kind: "expense",
    subcategories: ["Bus", "Auto", "Metro", "Fuel", "Cab"],
  },
  {
    name: "Education",
    icon: "🎓",
    kind: "expense",
    subcategories: ["Fees", "Printing", "Stationery", "Books", "Courses"],
  },
  {
    name: "Shopping",
    icon: "🛍️",
    kind: "expense",
    subcategories: ["Clothes", "Gadgets", "Home", "Gifts"],
  },
  {
    name: "Bills",
    icon: "🧾",
    kind: "expense",
    subcategories: ["Mobile", "Internet", "Electricity", "Rent", "Subscriptions"],
  },
  {
    name: "Entertainment",
    icon: "🎬",
    kind: "expense",
    subcategories: ["Movies", "Games", "Music", "Outing"],
  },
  { name: "Health", icon: "💊", kind: "expense", subcategories: ["Medicine", "Doctor", "Gym"] },
  { name: "Other", icon: "✨", kind: "expense", subcategories: [] },
];

export const INCOME_CATEGORIES: CategoryDef[] = [
  { name: "Salary", icon: "💼", kind: "income", subcategories: ["Monthly", "Bonus"] },
  { name: "Scholarship", icon: "🎖️", kind: "income", subcategories: ["Merit", "Stipend"] },
  { name: "Freelance", icon: "🧑‍💻", kind: "income", subcategories: ["Project", "Retainer"] },
  { name: "Allowance", icon: "🏠", kind: "income", subcategories: ["Family"] },
  { name: "Refund", icon: "↩️", kind: "income", subcategories: [] },
  { name: "Gift", icon: "🎁", kind: "income", subcategories: [] },
  { name: "Other Income", icon: "➕", kind: "income", subcategories: [] },
];

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "GPay", "Card", "Bank", "Other"];

export function categoryDef(name: string): CategoryDef {
  return (
    ALL_CATEGORIES.find((c) => c.name === name) ?? {
      name,
      icon: "•",
      kind: "expense",
      subcategories: [],
    }
  );
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  categories: [],
  paymentMethods: [],
  type: "all",
  minAmount: null,
  maxAmount: null,
  from: null,
  to: null,
};
