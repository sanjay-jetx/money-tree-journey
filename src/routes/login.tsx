import { createFileRoute, isRedirect, redirect, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Leaf, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { checkAuthFn, loginFn } from "../fns/authFns";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — MoneyTree" },
      { name: "description", content: "Sign in to your private MoneyTree." },
    ],
  }),
  beforeLoad: async () => {
    // If already authenticated, go straight to the tree
    try {
      const { isAuthenticated } = await checkAuthFn();
      if (isAuthenticated) throw redirect({ to: "/" });
    } catch (e) {
      // Redirect errors should propagate; auth errors are fine to swallow
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
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("sanjaynathiya81@gmail.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await loginFn({ data: { email, password } });

      if (result.success) {
        await navigate({ to: "/" });
      } else {
        setError(result.error ?? "Login failed. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4"
      style={{
        backgroundImage:
          "radial-gradient(circle at 18% 12%, var(--grain-1, color-mix(in oklab, #d08c3c 14%, transparent)), transparent 55%), radial-gradient(circle at 82% 82%, var(--grain-2, color-mix(in oklab, #7bb07b 10%, transparent)), transparent 58%)",
      }}
    >
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary, #915519) 40%, transparent) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Login card */}
      <div
        className="glass-panel relative w-full max-w-md space-y-7 rounded-3xl px-8 py-10"
        style={{ backdropFilter: "blur(24px)" }}
      >
        {/* Logo & Branding */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="flex size-16 items-center justify-center rounded-2xl shadow-[var(--shadow-glow)]"
            style={{ background: "var(--gradient-accent, linear-gradient(135deg, #e0a154, #915519))" }}
          >
            <Leaf className="size-8 text-white" strokeWidth={1.6} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              MoneyTree
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Your private financial journey
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60 transition-all duration-200"
                placeholder="your@email.com"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-12 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60 transition-all duration-200"
                placeholder="••••••••"
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

          {/* Error */}
          {error && (
            <div
              className="rounded-xl border border-expense/30 bg-expense-soft px-4 py-2.5 text-sm text-expense"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            id="login-submit"
            disabled={loading}
            className="relative w-full overflow-hidden rounded-xl py-3 text-sm font-bold text-white shadow-[var(--shadow-glow)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_24px_var(--glow)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "var(--gradient-accent, linear-gradient(135deg, #e0a154, #915519))",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Signing in…
              </span>
            ) : (
              "Sign in to MoneyTree"
            )}
          </button>
        </form>

        <div className="rounded-2xl border border-border/60 bg-surface-2/60 p-3.5 text-center text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">🔒 Single-User Private App</p>
          <p className="mt-1 leading-relaxed text-[11px]">
            Public sign-up is disabled to protect your finances. Your account credentials are configured in your environment. Enter your password to sign in.
          </p>
        </div>
      </div>
    </div>
  );
}
