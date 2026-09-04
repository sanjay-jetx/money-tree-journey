/**
 * authFns.ts — TanStack Start server functions for auth.
 * These run exclusively on the server and can safely use cookies.
 */
import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifyCredentials,
  verifySessionToken,
} from "../lib/auth.server";

// ── Check Auth ────────────────────────────────────────────────────────────
/** Called from beforeLoad — returns whether a valid session exists. */
export const checkAuthFn = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const token = getCookie(SESSION_COOKIE);
      if (!token) return { isAuthenticated: false };
      const valid = await verifySessionToken(token);
      return { isAuthenticated: valid };
    } catch {
      return { isAuthenticated: false };
    }
  },
);

// ── Login ─────────────────────────────────────────────────────────────────
/** Verifies credentials and sets a signed JWT session cookie on success. */
export const loginFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const data = raw as { email: string; password: string };
    if (!data.email || !data.password) throw new Error("Email and password are required");
    return data;
  })
  .handler(async ({ data }) => {
    const valid = verifyCredentials(data.email, data.password);
    if (!valid) {
      return { success: false as const, error: "Invalid email or password" };
    }

    const token = await createSessionToken();

    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return { success: true as const, error: null };
  });

// ── Logout ────────────────────────────────────────────────────────────────
/** Clears the session cookie. */
export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(SESSION_COOKIE);
  return { success: true };
});
