import { createFileRoute, isRedirect, redirect, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Leaf, Lock, Mail, User, UserPlus, LogIn, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { checkAuthFn, loginFn, signupFn } from "../fns/authFns";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Welcome — MoneyTree" },
      { name: "description", content: "Sign in or create your private MoneyTree account." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { mode?: "login" | "signup" } => {
    return {
      mode: search["mode"] === "signup" ? "signup" : "login",
    };
  },
  beforeLoad: async () => {
    // If already authenticated, go straight to the tree
    try {
      const { isAuthenticated } = await checkAuthFn();
      if (isAuthenticated) throw redirect({ to: "/" });
    } catch (e) {
      if (
        isRedirect(e) ||
        (e instanceof Response && e.status >= 300 && e.status < 400) ||
        (e != null &&
          typeof e === "object" &&
          ("href" in e || "__isRedirect" in e || "routeId" in e))
      ) {
        throw e;
      }
    }
  },
  component: AuthPage,
});

export function AuthPage({ defaultMode = "login" }: { defaultMode?: "login" | "signup" }) {
  const search = Route.useSearch?.() ?? { mode: defaultMode };
  const [mode, setMode] = useState<"login" | "signup">(
    search.mode === "signup" ? "signup" : defaultMode,
  );

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        if (!name.trim()) {
          setError("Please enter your name");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }

        const res = await signupFn({ data: { name, email, password } });
        if (res.success && res.user) {
          toast.success(`Account created! Welcome, ${res.user.name}!`);
          await navigate({ to: "/" });
        } else {
          setError(res.error ?? "Failed to create account. Please try again.");
        }
      } else {
        const res = await loginFn({ data: { email, password } });
        if (res.success && res.user) {
          toast.success(`Welcome back, ${res.user.name}!`);
          await navigate({ to: "/" });
        } else {
          setError(res.error ?? "Invalid email or password. Please try again.");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8"
      style={{
        backgroundImage:
          "radial-gradient(circle at 18% 12%, var(--grain-1, color-mix(in oklab, #d08c3c 14%, transparent)), transparent 55%), radial-gradient(circle at 82% 82%, var(--grain-2, color-mix(in oklab, #7bb07b 10%, transparent)), transparent 58%)",
      }}
    >
      {/* Decorative ambient glows */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary, #915519) 40%, transparent) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Main Auth Card */}
      <div
        className="glass-panel relative w-full max-w-md space-y-6 rounded-3xl border border-border/60 px-8 py-9 shadow-2xl transition-all duration-300"
        style={{ backdropFilter: "blur(24px)" }}
      >
        {/* Branding header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="flex size-14 items-center justify-center rounded-2xl shadow-[var(--shadow-glow)] transition-transform hover:scale-105"
            style={{ background: "var(--gradient-accent, linear-gradient(135deg, #e0a154, #915519))" }}
          >
            <Leaf className="size-7 text-white" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
              MoneyTree
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {mode === "signup"
                ? "Create your private financial ledger"
                : "Sign in to access your money tree"}
            </p>
          </div>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border/60 bg-surface/60 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all duration-200 ${
              mode === "login"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LogIn className="size-3.5" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all duration-200 ${
              mode === "signup"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="size-3.5" />
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field (Sign Up Only) */}
          {mode === "signup" && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <label
                htmlFor="auth-name"
                className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="auth-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60 transition-all duration-200"
                  placeholder="e.g. Sanjay Nathiya"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="auth-email"
              className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60 transition-all duration-200"
                placeholder="you@example.com"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase"
              >
                Password
              </label>
              {mode === "signup" && (
                <span className="text-[11px] text-muted-foreground">Min. 6 characters</span>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-12 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60 transition-all duration-200"
                placeholder={mode === "signup" ? "Create password" : "Enter password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="rounded-xl border border-expense/30 bg-expense-soft px-4 py-2.5 text-xs font-medium text-expense animate-in fade-in"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            id="auth-submit"
            disabled={loading}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3 text-sm font-bold text-white shadow-[var(--shadow-glow)] transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_0_24px_var(--glow)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "var(--gradient-accent, linear-gradient(135deg, #e0a154, #915519))",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                {mode === "signup" ? "Creating account…" : "Signing in…"}
              </span>
            ) : (
              <>
                <span>{mode === "signup" ? "Create My MoneyTree" : "Sign In to MoneyTree"}</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        {/* Toggle switch text */}
        <div className="text-center text-xs text-muted-foreground">
          {mode === "signup" ? (
            <span>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              First time here?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
              >
                Create an account
              </button>
            </span>
          )}
        </div>

        {/* Security badge */}
        <div className="rounded-2xl border border-border/50 bg-surface-2/40 p-3 text-center text-[11px] text-muted-foreground">
          🔒 Private & Encrypted • Your personal financial records are securely stored and protected.
        </div>
      </div>
    </div>
  );
}
