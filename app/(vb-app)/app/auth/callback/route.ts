import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { serverSupabase } from "@/lib/supabase/server";

/**
 * Magic-link landing. Handles both link styles:
 *  - PKCE (?code=...): the default when the link is opened in the same browser that asked for it.
 *  - Token hash (?token_hash=...&type=email): works on any device; use it in the Supabase
 *    "Magic Link" email template (see README).
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = url.searchParams.get("next") ?? "/app/clinician";
  const safeNext = next.startsWith("/app/") && !next.startsWith("//") ? next : "/app/clinician";
  const sb = await serverSupabase();
  if (!sb) return NextResponse.redirect(new URL("/app/clinician/login", url.origin));

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  let ok = false;
  if (code) ok = !(await sb.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await sb.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  return NextResponse.redirect(new URL(ok ? safeNext : "/app/clinician/login?error=link", url.origin));
}
