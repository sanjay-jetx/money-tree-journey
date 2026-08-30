import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { accentVars } from "./accent";
import type { AccentName } from "./accent";
import { balanceOn, formatMoney, todayISO } from "./calc";
import { createDemoState, createEmptyState } from "./demo";
import { EMPTY_FILTERS } from "./types";
import type { Debt, Filters, MoneyState, Transaction, ViewMode } from "./types";
import { loadStateFn, saveStateFn } from "../../fns/dataFns";

const STORAGE_KEY = "moneytree.state.v1";
/** Debounce delay before writing to Supabase (ms) */
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
  setStartingBalance: (amount: number) => void;
  setOverdraft: (value: boolean) => void;
  toggleTheme: () => void;
  setAccent: (name: AccentName) => void;
  setAccentIntensity: (level: number) => void;
  loadDemo: () => void;
  clearAll: () => void;
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

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Initial Load ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      // 1. Show localStorage instantly (fast start)
      let localState: MoneyState | null = null;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) localState = { ...createEmptyState(), ...(JSON.parse(raw) as MoneyState) };
      } catch { /* ignore */ }

      if (localState) {
        setState(localState);
        setReady(true); // Unblock UI immediately
      }

      // 2. Try fetching fresh data from Supabase
      try {
        const result = await loadStateFn();
        if (result.data) {
          setState({ ...createEmptyState(), ...result.data });
          // Update local cache with server data
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
        } else if (!localState) {
          // No cloud data AND no local data — show demo
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
