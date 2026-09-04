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
  type SessionUser,
} from "../lib/auth.server";
import { createUser, verifyUserPassword } from "../lib/userStore.server";

// ── Check Auth ────────────────────────────────────────────────────────────
/** Called from beforeLoad — returns whether a valid session exists and user profile. */
export const checkAuthFn = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const token = getCookie(SESSION_COOKIE);
      if (!token) return { isAuthenticated: false, user: null as SessionUser | null };
      const { valid, user } = await verifySessionToken(token);
      return { isAuthenticated: valid, user };
    } catch {
      return { isAuthenticated: false, user: null as SessionUser | null };
    }
  },
);

// ── Sign Up ───────────────────────────────────────────────────────────────
/** Creates a new user account with Name, Email, and Password, then sets session cookie. */
export const signupFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const data = raw as { name?: string; email?: string; password?: string };
    const name = data.name?.trim() ?? "";
    const email = data.email?.trim() ?? "";
    const password = data.password ?? "";

    if (!name || name.length < 2) {
      throw new Error("Please enter your full name (at least 2 characters).");
    }
    if (!email || !email.includes("@") || !email.includes(".")) {
      throw new Error("Please enter a valid email address.");
    }
    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    return { name, email, password };
  })
  .handler(async ({ data }) => {
    const result = await createUser(data);
    if (!result.user || result.error) {
      return { success: false as const, error: result.error ?? "Failed to create account" };
    }

    const sessionUser: SessionUser = {
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
    };

    const token = await createSessionToken(sessionUser);

    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return { success: true as const, user: sessionUser, error: null };
  });

// ── Login ─────────────────────────────────────────────────────────────────
/** Verifies credentials against userStore and sets a signed JWT session cookie. */
export const loginFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const data = raw as { email: string; password: string };
    if (!data.email || !data.password) throw new Error("Email and password are required");
    return { email: data.email.trim(), password: data.password };
  })
  .handler(async ({ data }) => {
    // 1. Check user store
    const { user, valid } = await verifyUserPassword(data.email, data.password);

    // 2. Fallback check for owner in env vars
    const isOwnerFallback = !valid && verifyCredentials(data.email, data.password);

    if (!valid && !isOwnerFallback) {
      return { success: false as const, error: "Invalid email or password", user: null };
    }

    const sessionUser: SessionUser = {
      userId: user?.id ?? "owner",
      email: user?.email ?? data.email,
      name: user?.name ?? "Sanjay",
    };

    const token = await createSessionToken(sessionUser);

    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return { success: true as const, error: null, user: sessionUser };
  });

// ── Logout ────────────────────────────────────────────────────────────────
/** Clears the session cookie. */
export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(SESSION_COOKIE);
  return { success: true };
});
