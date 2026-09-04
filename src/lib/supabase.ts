import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["SUPABASE_URL"] as string | undefined;
const supabaseAnonKey = import.meta.env["SUPABASE_ANON_KEY"] as string | undefined;

/**
 * Returns a Supabase client if env vars are configured, otherwise null.
 * The app falls back to localStorage when Supabase is unavailable.
 */
export const supabase =
  supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("your-project")
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = !!supabase;
