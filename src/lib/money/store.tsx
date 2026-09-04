import { format, subDays } from "date-fns";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { accentVars } from "./accent";
import type { AccentName } from "./accent";
import { ISO, balanceOn, formatMoney, todayISO } from "./calc";
import { DEFAULT_BUDGET_CONFIG, EMPTY_BUDGET_CONFIG } from "./budget";
import { createDemoState, createEmptyState } from "./demo";
import { EMPTY_FILTERS } from "./types";
import type { Debt, Filters, Goal, Investment, MoneyState, Transaction, ViewMode } from "./types";
import { loadStateFn, saveStateFn } from "../../fns/dataFns";

const STORAGE_KEY = "moneytree.state.v1";
/** Debounce delay before writing to cloud (ms) */
const CLOUD_SAVE_DELAY = 1500;

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface MoneyStore {
  state: MoneyState;
  ready: boolean;
  filters: Filters;
  setFilters: (next: Partial<Filters>) => void;
  resetFilters: () => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  anchorDate: string;
  setAnchorDate: (d: string) => void;
  addTransaction: (tx: Omit<Transaction, "id" | "createdAt">) => boolean;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addDebt: (debt: Omit<Debt, "id">) => void;
  updateDebt: (id: string, patch: Partial<Debt>) => void;
  deleteDebt: (id: string) => void;
  addInvestment: (inv: Omit<Investment, "id">) => void;
  updateInvestment: (id: string, patch: Partial<Investment>) => void;
  deleteInvestment: (id: string) => void;
  addGoal: (goal: Omit<Goal, "id" | "createdAt">) => boolean;
  updateGoal: (id: string, patch: Partial<Omit<Goal, "id" | "createdAt">>) => boolean;
  deleteGoal: (id: string) => void;
  addToGoal: (id: string, amount: number) => boolean;
  updateOverallSpendLimit: (limit: number, monthKey?: string) => void;
  updateSavingsTarget: (target: number, monthKey?: string) => void;
  setCategoryBudget: (category: string, limit: number, monthKey?: string) => void;
  removeCategoryBudget: (category: string, monthKey?: string) => void;
  setMonthlyGoals: (
    overallLimit: number,
    savingsTarget: number,
    categoryBudgets?: Record<string, number>,
    monthKey?: string,
  ) => void;
  setStartingBalance: (amount: number) => void;
  setCurrency: (currency: string) => void;
  setOverdraft: (value: boolean) => void;
  toggleTheme: () => void;
  setAccent: (name: AccentName) => void;
  setAccentIntensity: (level: number) => void;
  loadDemo: () => void;
  clearAll: () => void;
  importState: (imported: Partial<MoneyState>) => void;
  lastAddedId: string | null;
}

const MoneyContext = createContext<MoneyStore | null>(null);

export function MoneyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MoneyState>(() => createEmptyState());
  const [ready, setReady] = useState(false);
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS);
  const [view, setView] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<string>(() => todayISO());
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Initial Load ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      // 1. Show localStorage instantly (fast start, offline resilience)
      let localState: MoneyState | null = null;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as MoneyState;
          // Refresh stale demo data
          const latestTx = parsed.transactions.length
            ? [...parsed.transactions].sort((a, b) => b.date.localeCompare(a.date))[0]
            : null;
          const isStaleDemo =
            parsed.isDemo &&
            latestTx &&
            latestTx.date < format(subDays(new Date(), 2), ISO);

          if (isStaleDemo) {
            const fresh = createDemoState();
            localState = {
              ...fresh,
              theme: parsed.theme ?? fresh.theme,
              accent: parsed.accent ?? fresh.accent,
              accentIntensity: parsed.accentIntensity ?? fresh.accentIntensity,
            };
          } else {
            localState = { ...createEmptyState(), ...parsed, budgetConfig: parsed.budgetConfig ?? (parsed.isDemo ? DEFAULT_BUDGET_CONFIG : EMPTY_BUDGET_CONFIG) };
          }
        }
      } catch { /* ignore */ }

      if (localState) {
        setState(localState);
        setReady(true); // Unblock UI immediately
      }

      // 2. Fetch fresh data from cloud (Supabase or filesystem)
      try {
        const result = await loadStateFn({ data: undefined });
        if (result.data) {
          setState({ ...createEmptyState(), ...result.data, budgetConfig: result.data.budgetConfig ?? (result.data.isDemo ? DEFAULT_BUDGET_CONFIG : EMPTY_BUDGET_CONFIG) });
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
        } else if (!localState) {
          // No cloud + no local — show demo
          setState(createDemoState());
        }
      } catch (e) {
        console.warn("Cloud load failed, using local data:", e);
        if (!localState) setState(createDemoState());
      }

      setAnchorDate(todayISO());
      setReady(true);
    }

    boot();
  }, []);

  // ── Persist on Change ────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;

    // Always update localStorage immediately (offline cache)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore quota errors */ }

    // Debounced cloud save — wait 1.5s after last change
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveStateFn({ data: state });
      } catch (e) {
        console.warn("Cloud save failed (will retry on next change):", e);
      }
    }, CLOUD_SAVE_DELAY);
  }, [state, ready]);

  // ── Theme / Accent ────────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", state.theme === "dark");
    root.style.colorScheme = state.theme;
    const vars = accentVars(state.accent, state.accentIntensity, state.theme);
    for (const [key, val] of Object.entries(vars)) root.style.setProperty(key, val);
  }, [state.theme, state.accent, state.accentIntensity]);

  const setFilters = useCallback((next: Partial<Filters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
  }, []);

  const addTransaction = useCallback(
    (tx: Omit<Transaction, "id" | "createdAt">) => {
      if (tx.amount <= 0) {
        toast.error("Amount must be greater than zero");
        return false;
      }
      let ok = true;
      setState((prev) => {
        if (tx.type === "expense" && !prev.overdraft) {
          const available = balanceOn(prev, tx.date);
          if (tx.amount > available) {
            toast.error("Not enough balance on that date", {
              description: `Available on ${tx.date} is ${formatMoney(available, prev.currency)}. Enable overdraft in Settings to allow this.`,
            });
            ok = false;
            return prev;
          }
        }
        const id = newId("tx");
        setLastAddedId(id);
        return {
          ...prev,
          transactions: [...prev.transactions, { ...tx, id, createdAt: new Date().toISOString() }],
        };
      });
      return ok;
    },
    [],
  );

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setState((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
  }, []);

  const addDebt = useCallback((debt: Omit<Debt, "id">) => {
    setState((prev) => ({ ...prev, debts: [...prev.debts, { ...debt, id: newId("debt") }] }));
  }, []);

  const updateDebt = useCallback((id: string, patch: Partial<Debt>) => {
    setState((prev) => ({
      ...prev,
      debts: prev.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }, []);

  const deleteDebt = useCallback((id: string) => {
    setState((prev) => ({ ...prev, debts: prev.debts.filter((d) => d.id !== id) }));
  }, []);

  const addInvestment = useCallback((inv: Omit<Investment, "id">) => {
    if (inv.principal <= 0) {
      toast.error("Invested amount must be greater than zero");
      return;
    }
    setState((prev) => ({
      ...prev,
      investments: [...prev.investments, { ...inv, id: newId("inv") }],
    }));
    toast.success(`${inv.name} added to your investments`);
  }, []);

  const updateInvestment = useCallback((id: string, patch: Partial<Investment>) => {
    setState((prev) => ({
      ...prev,
      investments: prev.investments.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }, []);

  const deleteInvestment = useCallback((id: string) => {
    setState((prev) => ({ ...prev, investments: prev.investments.filter((i) => i.id !== id) }));
  }, []);

  const addGoal = useCallback((goal: Omit<Goal, "id" | "createdAt">) => {
    if (!goal.name.trim()) { toast.error("Goal name is required"); return false; }
    if (goal.targetAmount <= 0) { toast.error("Target amount must be greater than zero"); return false; }
    if (goal.savedAmount < 0) { toast.error("Saved amount cannot be negative"); return false; }
    if (Number.isNaN(Date.parse(goal.targetDate))) { toast.error("Pick a valid target date"); return false; }
    setState((prev) => ({
      ...prev,
      goals: [
        ...(prev.goals ?? []),
        { ...goal, name: goal.name.trim(), id: newId("goal"), createdAt: new Date().toISOString() },
      ],
    }));
    toast.success(`${goal.name.trim()} added to your goals`);
    return true;
  }, []);

  const updateGoal = useCallback((id: string, patch: Partial<Omit<Goal, "id" | "createdAt">>) => {
    if (patch.name !== undefined && !patch.name.trim()) { toast.error("Goal name is required"); return false; }
    if (patch.targetAmount !== undefined && patch.targetAmount <= 0) { toast.error("Target amount must be greater than zero"); return false; }
    if (patch.savedAmount !== undefined && patch.savedAmount < 0) { toast.error("Saved amount cannot be negative"); return false; }
    if (patch.targetDate !== undefined && Number.isNaN(Date.parse(patch.targetDate))) { toast.error("Pick a valid target date"); return false; }
    setState((prev) => ({
      ...prev,
      goals: (prev.goals ?? []).map((g) =>
        g.id === id ? { ...g, ...patch, name: (patch.name ?? g.name).trim() } : g,
      ),
    }));
    return true;
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setState((prev) => ({ ...prev, goals: (prev.goals ?? []).filter((g) => g.id !== id) }));
    toast.success("Goal removed");
  }, []);

  const addToGoal = useCallback((id: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Enter an amount greater than zero"); return false; }
    setState((prev) => ({
      ...prev,
      goals: (prev.goals ?? []).map((g) => {
        if (g.id !== id) return g;
        const saved = g.savedAmount + amount;
        if (saved >= g.targetAmount && g.savedAmount < g.targetAmount) {
          toast.success(`${g.name} reached — goal completed!`);
        }
        return { ...g, savedAmount: saved };
      }),
    }));
    return true;
  }, []);

  const updateOverallSpendLimit = useCallback((limit: number, monthKey?: string) => {
    const val = Math.max(0, limit);
    setState((prev) => {
      const cfg = prev.budgetConfig ?? DEFAULT_BUDGET_CONFIG;
      if (!monthKey) return { ...prev, budgetConfig: { ...cfg, overallSpendLimit: val } };
      const overrides = { ...(cfg.monthOverrides ?? {}) };
      overrides[monthKey] = { ...(overrides[monthKey] ?? {}), overallSpendLimit: val };
      return { ...prev, budgetConfig: { ...cfg, monthOverrides: overrides } };
    });
  }, []);

  const updateSavingsTarget = useCallback((target: number, monthKey?: string) => {
    const val = Math.max(0, target);
    setState((prev) => {
      const cfg = prev.budgetConfig ?? DEFAULT_BUDGET_CONFIG;
      if (!monthKey) return { ...prev, budgetConfig: { ...cfg, savingsTarget: val } };
      const overrides = { ...(cfg.monthOverrides ?? {}) };
      overrides[monthKey] = { ...(overrides[monthKey] ?? {}), savingsTarget: val };
      return { ...prev, budgetConfig: { ...cfg, monthOverrides: overrides } };
    });
  }, []);

  const setCategoryBudget = useCallback((category: string, limit: number, monthKey?: string) => {
    const val = Math.max(0, limit);
    setState((prev) => {
      const cfg = prev.budgetConfig ?? DEFAULT_BUDGET_CONFIG;
      if (!monthKey) {
        return { ...prev, budgetConfig: { ...cfg, categoryBudgets: { ...cfg.categoryBudgets, [category]: val } } };
      }
      const overrides = { ...(cfg.monthOverrides ?? {}) };
      overrides[monthKey] = {
        ...(overrides[monthKey] ?? {}),
        categoryBudgets: { ...(overrides[monthKey]?.categoryBudgets ?? cfg.categoryBudgets), [category]: val },
      };
      return { ...prev, budgetConfig: { ...cfg, monthOverrides: overrides } };
    });
  }, []);

  const removeCategoryBudget = useCallback((category: string, monthKey?: string) => {
    setState((prev) => {
      const cfg = prev.budgetConfig ?? DEFAULT_BUDGET_CONFIG;
      if (!monthKey) {
        const cats = { ...cfg.categoryBudgets };
        delete cats[category];
        return { ...prev, budgetConfig: { ...cfg, categoryBudgets: cats } };
      }
      const overrides = { ...(cfg.monthOverrides ?? {}) };
      const currentMonthCats = { ...(overrides[monthKey]?.categoryBudgets ?? cfg.categoryBudgets) };
      delete currentMonthCats[category];
      overrides[monthKey] = { ...(overrides[monthKey] ?? {}), categoryBudgets: currentMonthCats };
      return { ...prev, budgetConfig: { ...cfg, monthOverrides: overrides } };
    });
  }, []);

  const setMonthlyGoals = useCallback((
    overallLimit: number,
    savingsTarget: number,
    categoryBudgets?: Record<string, number>,
    monthKey?: string,
  ) => {
    setState((prev) => {
      const cfg = prev.budgetConfig ?? DEFAULT_BUDGET_CONFIG;
      if (!monthKey) {
        return {
          ...prev,
          budgetConfig: {
            ...cfg,
            overallSpendLimit: Math.max(0, overallLimit),
            savingsTarget: Math.max(0, savingsTarget),
            categoryBudgets: categoryBudgets ? { ...categoryBudgets } : cfg.categoryBudgets,
          },
        };
      }
      const overrides = { ...(cfg.monthOverrides ?? {}) };
      overrides[monthKey] = {
        overallSpendLimit: Math.max(0, overallLimit),
        savingsTarget: Math.max(0, savingsTarget),
        categoryBudgets: categoryBudgets ? { ...categoryBudgets } : (overrides[monthKey]?.categoryBudgets ?? cfg.categoryBudgets),
      };
      return { ...prev, budgetConfig: { ...cfg, monthOverrides: overrides } };
    });
    toast.success("Monthly budget goals updated");
  }, []);

  const setCurrency = useCallback((currency: string) => {
    setState((prev) => ({ ...prev, currency }));
  }, []);

  const importState = useCallback((imported: Partial<MoneyState>) => {
    if (!imported || typeof imported !== "object") { toast.error("Invalid backup file"); return; }
    const merged: MoneyState = {
      ...createEmptyState(),
      ...imported,
      transactions: Array.isArray(imported.transactions) ? imported.transactions : [],
      debts: Array.isArray(imported.debts) ? imported.debts : [],
      investments: Array.isArray(imported.investments) ? imported.investments : [],
      budgetConfig: imported.budgetConfig ?? EMPTY_BUDGET_CONFIG,
      startingBalance: typeof imported.startingBalance === "number" ? imported.startingBalance : 0,
      currency: imported.currency || "₹",
    };
    setState(merged);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
    toast.success("Tree backup successfully restored!");
  }, []);

  const value = useMemo<MoneyStore>(
    () => ({
      state,
      ready,
      filters,
      setFilters,
      resetFilters: () => setFiltersState(EMPTY_FILTERS),
      view,
      setView,
      anchorDate,
      setAnchorDate,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addDebt,
      updateDebt,
      deleteDebt,
      addInvestment,
      updateInvestment,
      deleteInvestment,
      addGoal,
      updateGoal,
      deleteGoal,
      addToGoal,
      updateOverallSpendLimit,
      updateSavingsTarget,
      setCategoryBudget,
      removeCategoryBudget,
      setMonthlyGoals,
      setStartingBalance: (amount: number) =>
        setState((prev) => ({ ...prev, startingBalance: Math.max(0, amount) })),
      setCurrency,
      setOverdraft: (value: boolean) => setState((prev) => ({ ...prev, overdraft: value })),
      toggleTheme: () =>
        setState((prev) => ({ ...prev, theme: prev.theme === "dark" ? "light" : "dark" })),
      setAccent: (name: AccentName) => setState((prev) => ({ ...prev, accent: name })),
      setAccentIntensity: (level: number) =>
        setState((prev) => ({ ...prev, accentIntensity: Math.min(5, Math.max(1, level)) })),
      loadDemo: () => {
        setState((prev) => ({ ...createDemoState(), theme: prev.theme, accent: prev.accent, accentIntensity: prev.accentIntensity }));
        toast.success("Demo money tree restored");
      },
      clearAll: () => {
        setState((prev) => ({ ...createEmptyState(), theme: prev.theme, accent: prev.accent, accentIntensity: prev.accentIntensity }));
        toast.success("Your tree is now empty — plant your first entry");
      },
      importState,
      lastAddedId,
    }),
    [
      state,
      ready,
      filters,
      setFilters,
      view,
      anchorDate,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addDebt,
      updateDebt,
      deleteDebt,
      addInvestment,
      updateInvestment,
      deleteInvestment,
      addGoal,
      updateGoal,
      deleteGoal,
      addToGoal,
      updateOverallSpendLimit,
      updateSavingsTarget,
      setCategoryBudget,
      removeCategoryBudget,
      setMonthlyGoals,
      setCurrency,
      importState,
      lastAddedId,
    ],
  );

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoney() {
  const ctx = useContext(MoneyContext);
  if (!ctx) throw new Error("useMoney must be used inside MoneyProvider");
  return ctx;
}
