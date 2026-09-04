/**
 * dataFns.ts — TanStack Start server functions for cloud data persistence.
 * Load/save the entire MoneyState JSON per authenticated user.
 * Falls back gracefully to file storage when Supabase is not configured.
 */
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { SESSION_COOKIE, verifySessionToken } from "../lib/auth.server";
import { supabase } from "../lib/supabase";
import type { MoneyState } from "../lib/money/types";

/** Retrieves the current authenticated user's ID from session cookie. */
async function getSessionUserId(): Promise<string> {
  try {
    const token = getCookie(SESSION_COOKIE);
    if (!token) return "owner";
    const { valid, user } = await verifySessionToken(token);
    if (valid && user?.userId) return user.userId;
  } catch {
    // fallback
  }
  return "owner";
}

// ── Load ──────────────────────────────────────────────────────────────────
/** Reads the MoneyState blob for the current user. Tries Supabase first, then filesystem fallback. */
export const loadStateFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await getSessionUserId();

    // 1. Try Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("money_state")
          .select("data")
          .eq("id", userId)
          .maybeSingle();

        if (!error && data?.data) {
          return { data: data.data as MoneyState, error: null };
        }
      } catch (e) {
        console.warn("Supabase load error:", e);
      }
    }

    // 2. Filesystem fallback (works on Railway / Node servers)
    try {
      if (typeof process !== "undefined" && process.versions?.node) {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const userFilePath = path.resolve(process.cwd(), ".data", `money_state_${userId}.json`);

        try {
          const content = await fs.readFile(userFilePath, "utf-8");
          const parsed = JSON.parse(content) as MoneyState;
          return { data: parsed, error: null };
        } catch {
          // If user file does not exist, check if legacy owner file exists to migrate
          const ownerFilePath = path.resolve(process.cwd(), ".data", "money_state_owner.json");
          const content = await fs.readFile(ownerFilePath, "utf-8");
          const parsed = JSON.parse(content) as MoneyState;
          // Clone to new user file
          await fs.writeFile(userFilePath, content, "utf-8");
          return { data: parsed, error: null };
        }
      }
    } catch {
      // File not found — first run
    }

    return { data: null, error: "No cloud state found" };
  },
);

// ── Save ──────────────────────────────────────────────────────────────────
/** Saves the full MoneyState JSON for the current user. Tries Supabase first, then filesystem fallback. */
export const saveStateFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    if (typeof raw !== "object" || raw === null) throw new Error("Invalid state");
    return raw as MoneyState;
  })
  .handler(async ({ data }) => {
    const userId = await getSessionUserId();

    // 1. Try Supabase
    if (supabase) {
      try {
        const { error } = await supabase.from("money_state").upsert(
          { id: userId, data, updated_at: new Date().toISOString() },
          { onConflict: "id" },
        );

        if (!error) return { success: true, error: null };
        console.warn("Supabase save error:", error.message);
      } catch (e) {
        console.warn("Supabase save exception:", e);
      }
    }

    // 2. Filesystem fallback
    try {
      if (typeof process !== "undefined" && process.versions?.node) {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const dataDir = path.resolve(process.cwd(), ".data");
        await fs.mkdir(dataDir, { recursive: true });

        const userFilePath = path.join(dataDir, `money_state_${userId}.json`);
        await fs.writeFile(userFilePath, JSON.stringify(data, null, 2), "utf-8");

        // Keep owner file updated as a mirror for safety if this is the owner
        if (userId === "owner") {
          const ownerFilePath = path.join(dataDir, "money_state_owner.json");
          await fs.writeFile(ownerFilePath, JSON.stringify(data, null, 2), "utf-8");
        }

        return { success: true, error: null };
      }
    } catch (e) {
      console.error("Filesystem save error:", e);
    }

    return { success: false, error: "Could not save state" };
  });
