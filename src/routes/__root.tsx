import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  redirect,
  isRedirect,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppShell } from "@/components/layout/AppShell";
import { TransactionDialogProvider } from "@/components/transactions/TransactionDialog";
import { MoneyProvider } from "@/lib/money/store";
import { Toaster } from "@/components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { checkAuthFn } from "../fns/authFns";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MoneyTree" },
      {
        name: "description",
        content: "Visualise your money as a living tree of dates, branches and transactions.",
      },
      { property: "og:title", content: "MoneyTree" },
      {
        property: "og:description",
        content: "Visualise your money as a living tree of dates, branches and transactions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap",
      },
    ],
  }),
  beforeLoad: async ({ location }) => {
    // Skip auth guard for auth pages (login & signup)
    if (location.pathname === "/login" || location.pathname === "/signup") return;

    try {
      const { isAuthenticated } = await checkAuthFn();
      if (!isAuthenticated) {
        throw redirect({ to: "/login" });
      }
    } catch (e) {
      // Re-throw redirect errors so TanStack Router handles the navigation
      if (
        isRedirect(e) ||
        (e instanceof Response && e.status >= 300 && e.status < 400) ||
        (e != null &&
          typeof e === "object" &&
          ("href" in e || "__isRedirect" in e || "routeId" in e))
      ) {
        throw e;
      }
      // On genuine auth errors (e.g. server unavailable), allow access
      // so a transient API failure doesn't lock the user out
      console.warn("Auth check failed — allowing access:", e);
    }
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Auth pages render without the sidebar shell
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  return (
    <QueryClientProvider client={queryClient}>
      {isAuthPage ? (
        // Bare layout for auth — no sidebar/nav
        <>
          <Outlet />
          <Toaster position="top-center" />
        </>
      ) : (
        // Full app layout with MoneyProvider and AppShell
        <MoneyProvider>
          <TransactionDialogProvider>
            <AppShell>
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <Outlet />
            </AppShell>
            <Toaster position="top-center" />
          </TransactionDialogProvider>
        </MoneyProvider>
      )}
    </QueryClientProvider>
  );
}
