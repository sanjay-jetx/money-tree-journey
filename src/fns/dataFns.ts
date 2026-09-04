/**
 * dataFns.ts — TanStack Start server functions for cloud data persistence.
 * Load/save the entire MoneyState JSON to/from a single Supabase row.
 * Falls back gracefully to file storage when Supabase is not configured.
 */
import { createServerFn } from "@tanstack/react-start";
import { supabase } from "../lib/supabase";
import type { MoneyState } from "../lib/money/types";

const ROW_ID = "owner";

// ── Load ──────────────────────────────────────────────────────────────────
/** Reads the MoneyState blob. Tries Supabase first, then filesystem fallback. */
export const loadStateFn = createServerFn({ method: "GET" }).handler(
  async () => {
    // 1. Try Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("money_state")
          .select("data")
          .eq("id", ROW_ID)
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
        const filePath = path.resolve(process.cwd(), ".data", "money_state_owner.json");
        const content = await fs.readFile(filePath, "utf-8");
        const parsed = JSON.parse(content) as MoneyState;
        return { data: parsed, error: null };
      }
    } catch {
      // File not found — first run
    }

    return { data: null, error: "No cloud state found" };
  },
);

// ── Save ──────────────────────────────────────────────────────────────────
/** Saves the full MoneyState JSON. Tries Supabase first, then filesystem fallback. */
export const saveStateFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    if (typeof raw !== "object" || raw === null) throw new Error("Invalid state");
    return raw as MoneyState;
  })
  .handler(async ({ data }) => {
    // 1. Try Supabase
    if (supabase) {
      try {
        const { error } = await supabase.from("money_state").upsert(
          { id: ROW_ID, data, updated_at: new Date().toISOString() },
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
        const filePath = path.join(dataDir, "money_state_owner.json");
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
        return { success: true, error: null };
      }
    } catch (e) {
      console.error("Filesystem save error:", e);
    }

    return { success: false, error: "Could not save state" };
  });
