import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { hasSupabase, supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Cookie-backed client for clinician pages, server actions and route handlers. */
export async function serverSupabase() {
  if (!hasSupabase) return null;
  const store = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there. proxy.ts refreshes them.
        }
      },
    },
  });
}

/** The signed-in clinician's auth user, or null. */
export async function currentUser() {
  const sb = await serverSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}
