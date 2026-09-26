import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasSupabase, supabaseAnonKey, supabaseUrl } from "@/lib/env";

let client: SupabaseClient | null = null;

/** Anonymous server-side client for public content (genres, movements, get_program). */
export function publicSupabase(): SupabaseClient | null {
  if (!hasSupabase) return null;
  client ??= createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
