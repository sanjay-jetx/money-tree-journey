import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { checkAuthFn } from "../fns/authFns";
import { AuthPage } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create Account — MoneyTree" },
      { name: "description", content: "Create your private MoneyTree account." },
    ],
  }),
  beforeLoad: async () => {
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
  component: SignUpPage,
});

function SignUpPage() {
  return <AuthPage defaultMode="signup" />;
}
