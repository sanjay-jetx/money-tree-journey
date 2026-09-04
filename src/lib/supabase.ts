import { createClient } from "@supabase/supabase-js";

function getEnv(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key];
  }
  return (import.meta.env as any)?.[key];
}

const supabaseUrl = getEnv("SUPABASE_URL");
const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");

/**
 * Returns a Supabase client if env vars are configured, otherwise null.
 * The app falls back to localStorage when Supabase is unavailable.
 */
export const supabase =
  supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("your-project")
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = !!supabase;
