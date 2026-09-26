import { NextResponse } from "next/server";
import webpush from "web-push";
import { demo } from "@/lib/demo/store";
import { demoBackend } from "@/lib/env";
import { runReminders, type ReminderSub } from "@/lib/reminders";
import { serviceSupabase } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron, every 15 minutes (vercel.json). Secured with CRON_SECRET: Vercel sends
 * "Authorization: Bearer <CRON_SECRET>". Sends at most one reminder per device per day.
 * The payload carries no text: the service worker writes "Time to move — {session}." from
 * what the device itself knows.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return NextResponse.json({ error: "vapid_not_configured" }, { status: 500 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:info@varysystems.com", pub, priv);

  const send = async (s: ReminderSub) => {
    try {
      const r = await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ kind: "reminder" }), { TTL: 4 * 3600, urgency: "normal", topic: "vb-reminder" });
      return r.statusCode;
    } catch (e) {
      return (e as { statusCode?: number }).statusCode ?? 500;
    }
  };

  const sb = serviceSupabase();
  if (sb) {
    const result = await runReminders({
      now: new Date(),
      load: async () => {
        const { data, error } = await sb.from("push_subscriptions").select("endpoint, p256dh, auth, reminder_local_time, timezone, reminder_days, active, last_sent_on").eq("active", true);
        if (error) throw new Error(error.message);
        return (data ?? []).map((r) => ({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth, reminderLocalTime: r.reminder_local_time, timezone: r.timezone, reminderDays: r.reminder_days, active: r.active, lastSentOn: r.last_sent_on }));
      },
      send,
      markSent: async (endpoint, localDate) => void (await sb.from("push_subscriptions").update({ last_sent_on: localDate }).eq("endpoint", endpoint)),
      deactivate: async (endpoint) => void (await sb.from("push_subscriptions").update({ active: false }).eq("endpoint", endpoint)),
    });
    return NextResponse.json(result);
  }
  if (demoBackend) {
    const result = await runReminders({
      now: new Date(),
      load: async () => demo.activePush(),
      send,
      markSent: async (endpoint, localDate) => demo.markSent(endpoint, localDate),
      deactivate: async (endpoint) => demo.deactivate(endpoint),
    });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "not_configured" }, { status: 501 });
}
