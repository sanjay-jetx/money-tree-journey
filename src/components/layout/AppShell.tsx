import { Link, useRouterState } from "@tanstack/react-router";
import { Moon, Plus, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTxDialog } from "@/components/transactions/TransactionDialog";
import { currentBalance, formatMoney } from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Money Tree", icon: "🌳" },
  { to: "/insights", label: "Insights", icon: "📊" },
  { to: "/time-machine", label: "Time Machine", icon: "⏳" },
  { to: "/income", label: "Income", icon: "💰" },
  { to: "/spending", label: "Spending", icon: "💸" },
  { to: "/owed", label: "Owed", icon: "🤝" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { state, ready, toggleTheme } = useMoney();
  const { openDialog } = useTxDialog();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <aside className="sidebar-gradient fixed top-0 left-0 z-30 hidden h-screen w-[262px] flex-col px-5 py-7 text-sidebar-foreground shadow-[8px_0_40px_-24px_rgba(11,32,92,0.6)] lg:flex">
        <Link to="/" className="flex items-center gap-3 px-1">
          <span className="accent-gradient flex size-11 items-center justify-center rounded-2xl text-xl shadow-[0_10px_24px_-10px_var(--glow)]">
            🌳
          </span>
          <div>
            <div className="font-display text-xl leading-none font-bold tracking-tight text-white">
              MoneyTree
            </div>
            <div className="mt-1 text-[11px] text-sidebar-muted">the story of your money</div>
          </div>
        </Link>

        <div className="mt-8 rounded-[22px] border border-white/10 bg-white/8 p-5 backdrop-blur">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-sidebar-muted uppercase">
            Current balance
          </div>
          <div className="stat-figure mt-2 text-[28px] leading-none text-sidebar-foreground">
            {ready ? formatMoney(currentBalance(state), state.currency) : "—"}
          </div>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1.5">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm transition-all duration-200",
                  active
                    ? "accent-gradient font-bold text-white shadow-[0_14px_30px_-12px_var(--glow)]"
                    : "font-medium text-sidebar-muted hover:translate-x-0.5 hover:bg-white/10 hover:text-sidebar-foreground",
                )}
              >
                {active && (
                  <span className="absolute -left-5 h-7 w-1.5 rounded-r-full bg-white/90" />
                )}
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>


        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-5">
          <Button variant="ghost" size="sm" onClick={toggleTheme} className="gap-2 text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground">
            {state.theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {state.theme === "dark" ? "Light" : "Dark"}
          </Button>
          {state.isDemo && (
            <span className="rounded-full bg-pending-soft px-2 py-1 text-[10px] font-semibold tracking-wide text-pending uppercase">
              Demo data
            </span>
          )}
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl">🌳</span>
          <span className="font-display font-semibold">MoneyTree</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="num text-sm text-balance">
            {ready ? formatMoney(currentBalance(state), state.currency) : "—"}
          </span>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {state.theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>

      <main className="pb-24 lg:pb-0 lg:pl-[262px]">{children}</main>

      <nav className="fixed bottom-0 left-0 z-30 flex w-full items-center justify-between gap-1 border-t border-border bg-background/95 px-2 py-1.5 backdrop-blur lg:hidden">
        {NAV.slice(0, 3).map((item) => (
          <MobileNavItem key={item.to} {...item} active={pathname === item.to} />
        ))}
        <button
          type="button"
          onClick={() => openDialog({ kind: "expense" })}
          className="accent-gradient mx-1 flex size-12 shrink-0 items-center justify-center rounded-2xl text-primary-foreground shadow-[0_14px_30px_-12px_var(--glow)]"
          aria-label="Add transaction"
        >
          <Plus className="size-6" />
        </button>
        {NAV.slice(4, 7).map((item) => (
          <MobileNavItem key={item.to} {...item} active={pathname === item.to} />
        ))}
      </nav>

      <button
        type="button"
        onClick={() => openDialog({ kind: "expense" })}
        className="fixed right-8 bottom-8 z-30 hidden items-center gap-2 accent-gradient rounded-[20px] px-6 py-4 text-sm font-bold tracking-tight text-primary-foreground shadow-[0_18px_40px_-14px_var(--glow)] transition-transform hover:scale-[1.04] lg:flex"
      >
        <Plus className="size-4" /> Add money entry
      </button>
    </div>
  );
}

function MobileNavItem({
  to,
  label,
  icon,
  active,
}: {
  to: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px]",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span className="text-base">{icon}</span>
      <span className="max-w-full truncate">{label.split(" ")[0]}</span>
    </Link>
  );
}
