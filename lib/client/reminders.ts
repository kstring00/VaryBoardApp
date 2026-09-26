"use client";

/**
 * Reminders (opt-in). One web push a day at the patient's chosen time on their committed days,
 * sent by the server cron (app/(vb-app)/app/api/cron/reminders). Never marketing. Off in one tap.
 *  - iOS only delivers web push to an app added to the Home Screen, so we detect that first.
 *  - Fallback: a recurring calendar event (.ics) on the committed days.
 * The reminder text ("Time to move — Shoulder mobility.") is built by the service worker from
 * IndexedDB on this device, so the session name never goes to the server.
 */
import { kvSet } from "@/lib/idb";
import { getDeviceId, getHabit, type Habit, type HabitAnchor } from "@/lib/client/store";
import { brand } from "@/content/site";
import { t } from "@/lib/copy";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export const HABIT_TIMES: Record<HabitAnchor, string> = { coffee: "08:00", walk: "10:00", tv: "19:00", bed: "20:30", custom: "09:00" };
export const HABIT_KEYS: Record<HabitAnchor, Parameters<typeof t>[0]> = { coffee: "habit.coffee", walk: "habit.walk", tv: "habit.tv", bed: "habit.bed", custom: "habit.custom" };

/** Spread the committed days across the week (ISO weekdays, 1 = Monday). */
export function defaultDays(perWeek: number): number[] {
  const map: Record<number, number[]> = { 1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7] };
  return map[Math.min(7, Math.max(1, perWeek))];
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function anchorPhrase(h: Pick<Habit, "anchor" | "time">): string {
  return h.anchor === "custom" ? `at ${formatTime(h.time)}` : t(HABIT_KEYS[h.anchor]).toLowerCase();
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && !!VAPID && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iOS in the browser tab: the Add to Home Screen guide comes before any reminder offer. */
export function needsHomeScreen(): boolean {
  return isIos() && !isStandalone();
}

/** Keeps the service worker's reminder text and device id current (IndexedDB, device only). */
export function syncReminderText(sessionName: string | null) {
  void kvSet("reminder", { sessionName });
  void kvSet("deviceId", getDeviceId());
}

async function currentSubscription(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

export async function reminderStatus(): Promise<"on" | "off" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  return (await currentSubscription()) ? "on" : "off";
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enableReminders(): Promise<"on" | "denied" | "unsupported" | "error"> {
  if (!pushSupported()) return "unsupported";
  const habit = getHabit();
  if (!habit) return "error";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID) }));
    const json = sub.toJSON();
    const r = await fetch("/app/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        time: habit.time,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        days: habit.days,
      }),
    });
    if (!r.ok) return "error";
    void kvSet("deviceId", getDeviceId());
    return "on";
  } catch {
    return "error";
  }
}

/** One tap: stops the server sending and removes this browser's subscription. */
export async function disableReminders(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  try {
    await fetch("/app/api/push/off", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: getDeviceId(), endpoint: sub.endpoint }) });
  } catch {
    /* offline: the unsubscribe below still stops delivery to this browser */
  }
  await sub.unsubscribe().catch(() => {});
}

const ICS_DAYS = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const pad = (n: number) => String(n).padStart(2, "0");

/** A recurring calendar event on the committed days at the habit time (floating local time). */
export function buildIcs(habit: Pick<Habit, "time" | "days">, sessionName: string | null, now = new Date()): string {
  const [h, m] = habit.time.split(":").map(Number);
  const iso = (d: Date) => ((d.getDay() + 6) % 7) + 1;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  for (let i = 0; i < 8 && (!habit.days.includes(iso(start)) || start < now); i++) start.setDate(start.getDate() + 1);
  const local = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = sessionName ? t("remind.notification", { session: sessionName }) : t("remind.notificationFallback");
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vary Systems//Vary Board App//EN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@${brand.domain}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local(start)}`,
    "DURATION:PT15M",
    `RRULE:FREQ=WEEKLY;BYDAY=${habit.days.map((d) => ICS_DAYS[d]).join(",")}`,
    `SUMMARY:${esc(text)}`,
    `DESCRIPTION:${esc(`Open the Vary Board app: ${location.origin}/app`)}`,
    `URL:${location.origin}/app`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:PT0M",
    `DESCRIPTION:${esc(text)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadIcs(habit: Pick<Habit, "time" | "days">, sessionName: string | null) {
  const blob = new Blob([buildIcs(habit, sessionName)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vary-board-reminder.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
