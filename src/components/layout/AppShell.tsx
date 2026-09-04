import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Menu, Moon, Plus, Sun } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { logoutFn } from "@/fns/authFns";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTxDialog } from "@/components/transactions/TransactionDialog";
import { currentBalance, formatMoney } from "@/lib/money/calc";
import { useMoney } from "@/lib/money/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Money Tree", icon: "🌳", desc: "Interactive money graph" },
  { to: "/spending", label: "Spending", icon: "💸", desc: "Outflows & expense log" },
  { to: "/income", label: "Income", icon: "💰", desc: "Inflows & earnings" },
  { to: "/budget", label: "Budget & Goals", icon: "🎯", desc: "Spending limits & targets" },
  { to: "/investments", label: "Investments", icon: "📈", desc: "Portfolio & growth assets" },
  { to: "/time-machine", label: "Time Machine", icon: "⏳", desc: "Historical simulation & scrub" },
  { to: "/insights", label: "Insights", icon: "📊", desc: "Trends & cash velocity" },
  { to: "/owed", label: "Owed", icon: "🤝", desc: "Loans & settlements" },
  { to: "/settings", label: "Settings", icon: "⚙️", desc: "Currency, cloud sync & rules" },
] as const;

const MOBILE_NAV_LEFT = [
  { to: "/", label: "Tree", icon: "🌳" },
  { to: "/spending", label: "Spend", icon: "💸" },
  { to: "/income", label: "Income", icon: "💰" },
] as const;

const MOBILE_NAV_RIGHT = [
  { to: "/budget", label: "Budget", icon: "🎯" },
  { to: "/investments", label: "Invest", icon: "📈" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { state, ready, toggleTheme } = useMoney();
  const { openDialog } = useTxDialog();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logoutFn();
    } finally {
      await navigate({ to: "/login" });
    }
  }

  const isMoreActive =
    !MOBILE_NAV_LEFT.some((i) => i.to === pathname) &&
    !MOBILE_NAV_RIGHT.some((i) => i.to === pathname);

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

        <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm transition-all duration-200",
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

        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4 mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="gap-2 text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground"
          >
            {state.theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {state.theme === "dark" ? "Light" : "Dark"}
          </Button>
          {state.isDemo && (
            <span className="rounded-full bg-pending-soft px-2 py-1 text-[10px] font-semibold tracking-wide text-pending uppercase">
              Demo data
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="gap-1.5 text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground"
            title="Sign out"
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl">🌳</span>
          <span className="font-display font-semibold text-foreground">MoneyTree</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="num text-sm text-balance font-semibold">
            {ready ? formatMoney(currentBalance(state), state.currency) : "—"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMoreOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </header>

      <main className="pb-24 lg:pb-0 lg:pl-[262px]">{children}</main>

      <nav className="fixed bottom-0 left-0 z-30 flex w-full items-center justify-between gap-0.5 border-t border-border bg-background/95 px-1.5 py-1.5 backdrop-blur lg:hidden">
        {MOBILE_NAV_LEFT.map((item) => (
          <MobileNavItem key={item.to} {...item} active={pathname === item.to} />
        ))}
        <button
          type="button"
          onClick={() => openDialog({ kind: "expense" })}
          className="accent-gradient mx-1 flex size-11 shrink-0 items-center justify-center rounded-2xl text-primary-foreground shadow-[0_14px_30px_-12px_var(--glow)] active:scale-95 transition-transform"
          aria-label="Add transaction"
        >
          <Plus className="size-5" />
        </button>
        {MOBILE_NAV_RIGHT.map((item) => (
          <MobileNavItem key={item.to} {...item} active={pathname === item.to} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] transition-colors",
            isMoreActive ? "text-foreground font-semibold" : "text-muted-foreground",
          )}
          aria-label="More navigation options"
        >
          <span className="text-base leading-none">⋯</span>
          <span className="max-w-full truncate">More</span>
        </button>
      </nav>

      {/* Mobile Navigation Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl p-5">
          <SheetHeader className="text-left pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌳</span>
                <SheetTitle className="text-lg font-bold">MoneyTree</SheetTitle>
              </div>
              <div className="text-right pr-6">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Balance
                </div>
                <div className="num text-sm font-bold text-foreground">
                  {ready ? formatMoney(currentBalance(state), state.currency) : "—"}
                </div>
              </div>
            </div>
            <SheetDescription className="text-xs">
              Explore your cashflow tree and all features.
            </SheetDescription>
          </SheetHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-3">
            {NAV.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-sm transition-all",
                    active
                      ? "border-primary/50 bg-primary/10 text-foreground font-semibold shadow-sm"
                      : "border-border bg-surface hover:bg-surface-2 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground">{item.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.desc}</div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="gap-2 text-xs"
            >
              {state.theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              {state.theme === "dark" ? "Light canvas" : "Dark canvas"}
            </Button>
            {state.isDemo && (
              <span className="rounded-full bg-pending-soft px-2 py-1 text-[10px] font-semibold tracking-wide text-pending uppercase">
                Demo data
              </span>
            )}
          </div>
        </SheetContent>
      </Sheet>

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
        active ? "text-foreground font-semibold" : "text-muted-foreground",
      )}
    >
      <span className="text-base">{icon}</span>
      <span className="max-w-full truncate">{label.split(" ")[0]}</span>
    </Link>
  );
}
