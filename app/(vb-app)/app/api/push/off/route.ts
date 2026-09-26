import { NextResponse } from "next/server";
import { demo } from "@/lib/demo/store";
import { demoBackend } from "@/lib/env";
import { publicSupabase } from "@/lib/supabase/public";

/** Turn reminders off (from Settings or the notification's "Turn off reminders" action). */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { deviceId?: unknown; endpoint?: unknown } | null;
  if (!b || typeof b.deviceId !== "string" || typeof b.endpoint !== "string") return NextResponse.json({ error: "invalid" }, { status: 400 });
  const sb = publicSupabase();
  if (sb) {
    const { error } = await sb.rpc("set_push_active", { p_device_id: b.deviceId, p_endpoint: b.endpoint, p_active: false });
    return error ? NextResponse.json({ error: "rejected" }, { status: 400 }) : new NextResponse(null, { status: 204 });
  }
  if (demoBackend) {
    demo.setPushActive(b.deviceId, b.endpoint, false);
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json({ error: "not_configured" }, { status: 501 });
}
