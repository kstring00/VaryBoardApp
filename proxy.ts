import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 proxy (formerly middleware).
 *  1. noindex: every /app route except the /app landing says X-Robots-Tag: noindex (the pages'
 *     meta robots say the same). Vercel previews are noindex everywhere.
 *  2. Clinician routes: refresh the Supabase auth cookie so server components see a live session.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key && (path.startsWith("/app/clinician") || path.startsWith("/app/auth"))) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });
    await supabase.auth.getUser();
  }

  const landing = path === "/app" || path === "/app/";
  if (!landing || process.env.VERCEL_ENV === "preview") response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/app"],
};
