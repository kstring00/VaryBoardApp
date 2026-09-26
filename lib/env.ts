/**
 * Environment. Everything optional: with no Supabase keys the app runs on the built-in seed
 * content (content/seed.ts) and patients' sessions stay on the device.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "") || "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
export const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);

/** "production" | "preview" | "development" | undefined (not on Vercel). */
export const vercelEnv = process.env.VERCEL_ENV;

/**
 * Local demo backend: clinician mode and completions kept in server memory, for local testing
 * without Supabase (`next dev`, or NEXT_PUBLIC_VB_DEMO=true). Never on Vercel production, and
 * never when Supabase is configured.
 */
export const demoBackend =
  !hasSupabase && vercelEnv !== "production" && (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_VB_DEMO === "true");

/** Canonical public URL of the app host, without a trailing slash. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  if (vercelEnv === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Video host: Mux when its token is configured, otherwise Supabase Storage. */
export const videoProvider: "mux" | "supabase" = process.env.MUX_TOKEN_ID ? "mux" : "supabase";
