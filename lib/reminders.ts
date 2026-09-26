/**
 * Reminder scheduling (server). Pure logic, tested in tests/reminders.test.ts; the cron route
 * supplies the store and the web-push sender.
 * One reminder per device per day: sent on the first cron run at or after the local reminder
 * time on a committed day, within a 2-hour grace window, and never twice on the same local date.
 */
export interface ReminderSub {
  endpoint: string;
  p256dh: string;
  auth: string;
  /** "HH:MM" or "HH:MM:SS", local to `timezone`. */
  reminderLocalTime: string;
  timezone: string;
  /** ISO weekdays, 1 = Monday. */
  reminderDays: number[];
  active: boolean;
  lastSentOn: string | null;
}

export const GRACE_MINUTES = 120;

export function localParts(now: Date, timeZone: string): { date: string; minutes: number; isoDay: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const isoDay = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday) + 1;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), isoDay };
}

export function isDue(sub: ReminderSub, now: Date): { due: boolean; localDate: string } {
  let local: ReturnType<typeof localParts>;
  try {
    local = localParts(now, sub.timezone);
  } catch {
    return { due: false, localDate: "" };
  }
  const [h, m] = sub.reminderLocalTime.split(":").map(Number);
  const target = h * 60 + m;
  const due =
    sub.active &&
    sub.reminderDays.includes(local.isoDay) &&
    sub.lastSentOn !== local.date &&
    local.minutes >= target &&
    local.minutes < target + GRACE_MINUTES;
  return { due, localDate: local.date };
}

export interface ReminderDeps {
  now: Date;
  load: () => Promise<ReminderSub[]>;
  /** Returns the push service's HTTP status. */
  send: (sub: ReminderSub) => Promise<number>;
  markSent: (endpoint: string, localDate: string) => Promise<void>;
  deactivate: (endpoint: string) => Promise<void>;
}

export async function runReminders(d: ReminderDeps): Promise<{ checked: number; sent: number; removed: number }> {
  const subs = await d.load();
  let sent = 0;
  let removed = 0;
  for (const s of subs) {
    const { due, localDate } = isDue(s, d.now);
    if (!due) continue;
    const status = await d.send(s);
    if (status === 404 || status === 410) {
      await d.deactivate(s.endpoint); // the browser dropped the subscription
      removed++;
    } else if (status >= 200 && status < 300) {
      await d.markSent(s.endpoint, localDate);
      sent++;
    }
  }
  return { checked: subs.length, sent, removed };
}
