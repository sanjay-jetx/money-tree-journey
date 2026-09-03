import { format, subDays } from "date-fns";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { accentVars } from "./accent";
import type { AccentName } from "./accent";
import { ISO, balanceOn, formatMoney, todayISO } from "./calc";
import { DEFAULT_BUDGET_CONFIG, EMPTY_BUDGET_CONFIG } from "./budget";
import { fetchCloudState, pushCloudState } from "./cloud";
import { createDemoState, createEmptyState } from "./demo";
import { EMPTY_FILTERS } from "./types";
import type { Debt, Filters, Investment, MoneyState, Transaction, ViewMode } from "./types";

const STORAGE_KEY = "moneytree.state.v1";
const SYNC_KEY_STORAGE = "moneytree.syncKey.v1";

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
  setOverdraft: (value: boolean) => void;
  toggleTheme: () => void;
  setAccent: (name: AccentName) => void;
  setAccentIntensity: (level: number) => void;
  loadDemo: () => void;
  clearAll: () => void;
  lastAddedId: string | null;
  syncKey: string;
  setSyncKey: (key: string) => void;
  syncStatus: "idle" | "syncing" | "synced" | "error";
  lastSyncedAt: string | null;
  syncToCloud: () => Promise<boolean>;
  restoreFromCloud: (key?: string) => Promise<boolean>;
}

const MoneyContext = createContext<MoneyStore | null>(null);

export function MoneyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MoneyState>(() => createEmptyState());
  const [ready, setReady] = useState(false);
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS);
  const [view, setView] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<string>(() => todayISO());
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [syncKey, setSyncKeyState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(SYNC_KEY_STORAGE);
      if (saved) return saved;
      const gen = `tree-${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem(SYNC_KEY_STORAGE, gen);
      return gen;
    }
    return "default-tree";
  });
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MoneyState;
        const latestTx = parsed.transactions.length
          ? [...parsed.transactions].sort((a, b) => b.date.localeCompare(a.date))[0]
          : null;
        const isStaleDemo =
          parsed.isDemo &&
          latestTx &&
          latestTx.date < format(subDays(new Date(), 2), ISO);

        if (isStaleDemo) {
          const fresh = createDemoState();
          setState({
            ...fresh,
            theme: parsed.theme ?? fresh.theme,
            accent: parsed.accent ?? fresh.accent,
            accentIntensity: parsed.accentIntensity ?? fresh.accentIntensity,
          });
        } else {
          setState({
            ...createEmptyState(),
            ...parsed,
            budgetConfig:
              parsed.budgetConfig ?? (parsed.isDemo ? DEFAULT_BUDGET_CONFIG : EMPTY_BUDGET_CONFIG),
          });
        }
      } else {
        setState(createDemoState());
      }
    } catch {
      setState(createDemoState());
    }
    setAnchorDate(todayISO());
    setReady(true);

    // Initial background cloud hydration
    if (typeof window !== "undefined") {
      const savedKey = window.localStorage.getItem(SYNC_KEY_STORAGE) || "default-tree";
      fetchCloudState({ data: { syncKey: savedKey } })
        .then((res) => {
          if (res.success && res.state) {
            setState(res.state);
            setSyncStatus("synced");
            setLastSyncedAt(res.updatedAt ?? new Date().toISOString());
          }
        })
        .catch(() => {
          // Keep local state
        });
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    // Debounced auto-sync to cloud backend
    const timeout = setTimeout(() => {
      setSyncStatus("syncing");
      pushCloudState({ data: { syncKey, state } })
        .then((res) => {
          if (res.success) {
            setSyncStatus("synced");
            setLastSyncedAt(res.updatedAt ?? new Date().toISOString());
          } else {
            setSyncStatus("error");
          }
        })
        .catch(() => setSyncStatus("error"));
    }, 1500);

    return () => clearTimeout(timeout);
  }, [state, ready, syncKey]);

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

  const updateOverallSpendLimit = useCallback((limit: number, monthKey?: string) => {
    const val = Math.max(0, limit);
    setState((prev) => {
      const cfg = prev.budgetConfig ?? DEFAULT_BUDGET_CONFIG;
      if (!monthKey) {
        return { ...prev, budgetConfig: { ...cfg, overallSpendLimit: val } };
      }
      const overrides = { ...(cfg.monthOverrides ?? {}) };
      overrides[monthKey] = { ...(overrides[monthKey] ?? {}), overallSpendLimit: val };
      return { ...prev, budgetConfig: { ...cfg, monthOverrides: overrides } };
    });
  }, []);

  const updateSavingsTarget = useCallback((target: number, monthKey?: string) => {
    const val = Math.max(0, target);
    setState((prev) => {
      const cfg = prev.budgetConfig ?? DEFAULT_BUDGET_CONFIG;
      if (!monthKey) {
        return { ...prev, budgetConfig: { ...cfg, savingsTarget: val } };
      }
      const overrides = { ...(cfg.monthOverrides ?? {}) };
      overrides[monthKey] = { ...(overrides[monthKey] ?? {}), savingsTarget: val };
      return { ...prev, budgetConfig: { ...cfg, monthOverrides: overrides } };
    });
  }, []);

  const setCategoryBudget = useCallback(
    (category: string, limit: number, monthKey?: string) => {
      const val = Math.max(0, limit);
      setState((prev) => {
        const cfg = prev.budgetConfig ?? DEFAULT_BUDGET_CONFIG;
        if (!monthKey) {
          const cats = { ...cfg.categoryBudgets, [category]: val };
          return { ...prev, budgetConfig: { ...cfg, categoryBudgets: cats } };
        }
        const overrides = { ...(cfg.monthOverrides ?? {}) };
        const currentMonthCats = {
          ...(overrides[monthKey]?.categoryBudgets ?? cfg.categoryBudgets),
          [category]: val,
        };
        overrides[monthKey] = {
          ...(overrides[monthKey] ?? {}),
          categoryBudgets: currentMonthCats,
        };
        return { ...prev, budgetConfig: { ...cfg, monthOverrides: overrides } };
      });
    },
    [],
  );

  const removeCategoryBudget = useCallback((category: string, monthKey?: string) => {
    setState((prev) => {
      const cfg = prev.budgetConfig ?? DEFAULT_BUDGET_CONFIG;
      if (!monthKey) {
        const cats = { ...cfg.categoryBudgets };
        delete cats[category];
        return { ...prev, budgetConfig: { ...cfg, categoryBudgets: cats } };
      }
      const overrides = { ...(cfg.monthOverrides ?? {}) };
      const currentMonthCats = {
        ...(overrides[monthKey]?.categoryBudgets ?? cfg.categoryBudgets),
      };
      delete currentMonthCats[category];
      overrides[monthKey] = {
        ...(overrides[monthKey] ?? {}),
        categoryBudgets: currentMonthCats,
      };
      return { ...prev, budgetConfig: { ...cfg, monthOverrides: overrides } };
    });
  }, []);

  const setMonthlyGoals = useCallback(
    (
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
          categoryBudgets: categoryBudgets
            ? { ...categoryBudgets }
            : (overrides[monthKey]?.categoryBudgets ?? cfg.categoryBudgets),
        };
        return { ...prev, budgetConfig: { ...cfg, monthOverrides: overrides } };
      });
      toast.success("Monthly budget goals updated");
    },
    [],
  );

  const setSyncKey = useCallback((k: string) => {
    const clean = k.trim();
    if (!clean) return;
    setSyncKeyState(clean);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SYNC_KEY_STORAGE, clean);
    }
  }, []);

  const syncToCloud = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const res = await pushCloudState({ data: { syncKey, state } });
      if (res.success) {
        setSyncStatus("synced");
        setLastSyncedAt(res.updatedAt ?? new Date().toISOString());
        toast.success("Money tree synced to cloud backend");
        return true;
      }
      setSyncStatus("error");
      toast.error("Failed to sync to cloud");
      return false;
    } catch {
      setSyncStatus("error");
      toast.error("Cloud sync error");
      return false;
    }
  }, [syncKey, state]);

  const restoreFromCloud = useCallback(
    async (targetKey?: string) => {
      const keyToUse = targetKey?.trim() || syncKey;
      setSyncStatus("syncing");
      try {
        const res = await fetchCloudState({ data: { syncKey: keyToUse } });
        if (res.success && res.state) {
          setState(res.state);
          setSyncStatus("synced");
          setLastSyncedAt(res.updatedAt ?? new Date().toISOString());
          if (targetKey) setSyncKey(targetKey);
          toast.success("Restored tree from cloud backend");
          return true;
        }
        setSyncStatus("error");
        toast.error(res.message || "No cloud backup found for this key");
        return false;
      } catch {
        setSyncStatus("error");
        toast.error("Failed to fetch from cloud");
        return false;
      }
    },
    [syncKey, setSyncKey],
  );

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
      updateOverallSpendLimit,
      updateSavingsTarget,
      setCategoryBudget,
      removeCategoryBudget,
      setMonthlyGoals,
      setStartingBalance: (amount: number) =>
        setState((prev) => ({ ...prev, startingBalance: Math.max(0, amount) })),
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
      lastAddedId,
      syncKey,
      setSyncKey,
      syncStatus,
      lastSyncedAt,
      syncToCloud,
      restoreFromCloud,
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
      updateOverallSpendLimit,
      updateSavingsTarget,
      setCategoryBudget,
      removeCategoryBudget,
      setMonthlyGoals,
      lastAddedId,
      syncKey,
      setSyncKey,
      syncStatus,
      lastSyncedAt,
      syncToCloud,
      restoreFromCloud,
    ],
  );

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoney() {
  const ctx = useContext(MoneyContext);
  if (!ctx) throw new Error("useMoney must be used inside MoneyProvider");
  return ctx;
}
