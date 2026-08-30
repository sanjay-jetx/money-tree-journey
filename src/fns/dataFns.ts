/**
 * dataFns.ts — TanStack Start server functions for cloud data persistence.
 * Load/save the entire MoneyState JSON to/from a single Supabase row.
 */
import { createServerFn } from "@tanstack/react-start";
import { supabase } from "../lib/supabase";
import type { MoneyState } from "../lib/money/types";

const ROW_ID = "owner";

// ── Load ──────────────────────────────────────────────────────────────────
/** Reads the MoneyState blob from Supabase. Returns null if not found. */
export const loadStateFn = createServerFn({ method: "GET" }).handler(
  async () => {
    if (!supabase) {
      return { data: null, error: "Supabase not configured — using localStorage fallback" };
    }

    try {
      const { data, error } = await supabase
        .from("money_state")
        .select("data")
        .eq("id", ROW_ID)
        .maybeSingle();

      if (error) return { data: null, error: error.message };
      return { data: (data?.data as MoneyState) ?? null, error: null };
    } catch (e) {
      return { data: null, error: String(e) };
    }
  },
);

// ── Save ──────────────────────────────────────────────────────────────────
/** Upserts the full MoneyState JSON blob to Supabase. */
export const saveStateFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    // Accept any object — MoneyState validation is done on the client
    if (typeof raw !== "object" || raw === null) throw new Error("Invalid state");
    return raw as MoneyState;
  })
  .handler(async ({ data }) => {
    if (!supabase) {
      return { success: false, error: "Supabase not configured" };
    }

    try {
      const { error } = await supabase.from("money_state").upsert(
        { id: ROW_ID, data, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });
