import { NextResponse } from "next/server";
import { getPatientProgram } from "@/lib/data";

/** GET /app/api/program/ABC234 — the gated program for a code, as the patient device stores it. */
export async function GET(_req: Request, ctx: RouteContext<"/app/api/program/[code]">) {
  const { code } = await ctx.params;
  try {
    const program = await getPatientProgram(code);
    if (!program) return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(program, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
