import { NextResponse } from "next/server";
import { demo } from "@/lib/demo/store";
import { demoBackend } from "@/lib/env";
import { publicSupabase } from "@/lib/supabase/public";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Save this device's reminder subscription: device id, push endpoint + keys, time, time zone,
 * days. No names or health data. Written through the save_push_subscription RPC (the table
 * itself is unreadable to the public key).
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const days = Array.isArray(b?.days) ? (b!.days as unknown[]).map(Number) : [];
  const ok =
    b &&
    typeof b.deviceId === "string" && UUID.test(b.deviceId) &&
    typeof b.endpoint === "string" && /^https:\/\//.test(b.endpoint) && b.endpoint.length <= 1024 &&
    typeof b.p256dh === "string" && b.p256dh.length <= 200 &&
    typeof b.auth === "string" && b.auth.length <= 100 &&
    typeof b.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.time) &&
    typeof b.timezone === "string" && b.timezone.length <= 64 &&
    days.length >= 1 && days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (!ok) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const sub = { deviceId: b.deviceId as string, endpoint: b.endpoint as string, p256dh: b.p256dh as string, auth: b.auth as string, time: b.time as string, timezone: b.timezone as string, days: [...new Set(days)].sort() };

  const sb = publicSupabase();
  if (sb) {
    const { error } = await sb.rpc("save_push_subscription", { p_device_id: sub.deviceId, p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth, p_time: sub.time, p_timezone: sub.timezone, p_days: sub.days });
    if (error) return NextResponse.json({ error: "rejected" }, { status: 400 });
    return new NextResponse(null, { status: 204 });
  }
  if (demoBackend) {
    demo.savePush({ deviceId: sub.deviceId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, reminderLocalTime: sub.time, timezone: sub.timezone, reminderDays: sub.days });
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json({ error: "not_configured" }, { status: 501 });
}
